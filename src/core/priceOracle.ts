import { logger } from '../logger';
import { OracleConfig } from '../config';

export interface ExchangePrice {
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  volume24h: number;
  timestamp: number;
  source: string;
}

export class PriceOracle {
  private cache: Map<string, ExchangePrice> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private config: OracleConfig;

  constructor(config: OracleConfig) {
    this.config = config;
  }

  /**
   * Get reference price from multiple CEX sources
   */
  async getPrice(symbol: string): Promise<ExchangePrice | null> {
    // Check cache first
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
      return cached;
    }

    // Fetch from all sources in parallel
    const promises = this.config.sources.map(source => 
      this.fetchFromSource(symbol, source)
    );

    const results = await Promise.allSettled(promises);
    const prices: ExchangePrice[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        prices.push(result.value);
      }
    }

    if (prices.length === 0) {
      logger.warn('No CEX prices available', { symbol });
      return cached || null;
    }

    // Use median price from multiple sources
    const aggregatedPrice = this.aggregatePrices(prices);
    this.cache.set(symbol, aggregatedPrice);

    return aggregatedPrice;
  }

  /**
   * Fetch price from specific exchange
   */
  private async fetchFromSource(
    symbol: string,
    source: 'binance' | 'bybit' | 'coinbase'
  ): Promise<ExchangePrice | null> {
    try {
      switch (source) {
        case 'binance':
          return await this.fetchBinance(symbol);
        case 'bybit':
          return await this.fetchBybit(symbol);
        case 'coinbase':
          return await this.fetchCoinbase(symbol);
        default:
          return null;
      }
    } catch (error) {
      logger.debug('Failed to fetch from source', { source, symbol, error });
      return null;
    }
  }

  /**
   * Fetch from Binance
   */
  private async fetchBinance(symbol: string): Promise<ExchangePrice | null> {
    const ticker = `${symbol}USDT`;
    
    const bookResponse = await fetch(
      `https://api.binance.com/api/v3/ticker/bookTicker?symbol=${ticker}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!bookResponse.ok) {
      return null;
    }

    const book = await bookResponse.json();

    const bid = parseFloat(book.bidPrice);
    const ask = parseFloat(book.askPrice);
    const mid = (bid + ask) / 2;

    return {
      bid,
      ask,
      mid,
      spread: (ask - bid) / mid,
      volume24h: 0, // Binance bookTicker doesn't include volume
      timestamp: Date.now(),
      source: 'binance',
    };
  }

  /**
   * Fetch from Bybit
   */
  private async fetchBybit(symbol: string): Promise<ExchangePrice | null> {
    const response = await fetch(
      `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}USDT`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const ticker = data.result?.list?.[0];

    if (!ticker) {
      return null;
    }

    const bid = parseFloat(ticker.bid1Price);
    const ask = parseFloat(ticker.ask1Price);
    const mid = (bid + ask) / 2;

    return {
      bid,
      ask,
      mid,
      spread: (ask - bid) / mid,
      volume24h: parseFloat(ticker.volume24h) || 0,
      timestamp: Date.now(),
      source: 'bybit',
    };
  }

  /**
   * Fetch from Coinbase
   */
  private async fetchCoinbase(symbol: string): Promise<ExchangePrice | null> {
    const pair = `${symbol}-USD`;
    
    const response = await fetch(
      `https://api.exchange.coinbase.com/products/${pair}/ticker`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      return null;
    }

    const ticker = await response.json();

    const bid = parseFloat(ticker.bid);
    const ask = parseFloat(ticker.ask);
    const mid = (bid + ask) / 2;

    return {
      bid,
      ask,
      mid,
      spread: (ask - bid) / mid,
      volume24h: parseFloat(ticker.volume) || 0,
      timestamp: Date.now(),
      source: 'coinbase',
    };
  }

  /**
   * Aggregate prices from multiple sources using median
   */
  private aggregatePrices(prices: ExchangePrice[]): ExchangePrice {
    const mids = prices.map(p => p.mid).sort((a, b) => a - b);
    const bids = prices.map(p => p.bid).sort((a, b) => a - b);
    const asks = prices.map(p => p.ask).sort((a, b) => a - b);

    const medianIndex = Math.floor(prices.length / 2);

    const bid = bids[medianIndex];
    const ask = asks[medianIndex];
    const mid = mids[medianIndex];

    const totalVolume = prices.reduce((sum, p) => sum + p.volume24h, 0);
    const avgVolume = totalVolume / prices.length;

    return {
      bid,
      ask,
      mid,
      spread: (ask - bid) / mid,
      volume24h: avgVolume,
      timestamp: Date.now(),
      source: `aggregated(${prices.map(p => p.source).join(',')})`,
    };
  }

  /**
   * Start periodic price updates for multiple symbols
   */
  startUpdates(symbols: string[]): void {
    if (!this.config.enabled) {
      logger.info('Price oracle disabled');
      return;
    }

    logger.info('Starting price oracle', {
      symbols,
      sources: this.config.sources,
      interval: this.config.updateInterval,
    });

    this.updateInterval = setInterval(async () => {
      for (const symbol of symbols) {
        await this.getPrice(symbol);
      }
    }, this.config.updateInterval);

    // Initial fetch
    Promise.all(symbols.map(symbol => this.getPrice(symbol)));
  }

  /**
   * Stop price updates
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      logger.info('Price oracle stopped');
    }
  }

  /**
   * Get price age in milliseconds
   */
  getPriceAge(symbol: string): number {
    const cached = this.cache.get(symbol);
    if (!cached) {
      return Infinity;
    }
    return Date.now() - cached.timestamp;
  }

  /**
   * Check if cached price is fresh
   */
  isPriceFresh(symbol: string): boolean {
    return this.getPriceAge(symbol) < this.config.cacheTimeout;
  }

  /**
   * Clear all cached prices
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Price oracle cache cleared');
  }
}