import { Nord, NordUser, Side, FillMode, Orderbook, Market } from '@n1xyz/nord-ts';
import { RiskManager } from '../core/risk';
import { SpreadCalculator } from '../core/spread';
import { SizingCalculator } from '../core/sizing';
import { InventoryManager } from '../core/inventory';
import { HedgingEngine } from '../core/hedging';
import { PriceOracle } from '../core/priceOracle';
import { CONFIG } from '../config';
import { logger, logOrderPlaced, logOrderCancelled } from '../logger';

interface QuoteLevel {
  price: number;
  size: number;
}

interface MarketQuotes {
  marketId: number;
  bids: QuoteLevel[];
  asks: QuoteLevel[];
  timestamp: number;
}

interface LastQuotePrices {
  bid: number;
  ask: number;
  timestamp: number;
}

export class MarketMakerLive {
  private nord: Nord;
  private user: NordUser;
  private riskManager: RiskManager;
  private spreadCalculator: SpreadCalculator;
  private sizingCalculator: SizingCalculator;
  private inventoryManager: InventoryManager;
  private hedgingEngine: HedgingEngine;
  private priceOracle: PriceOracle;
  
  private activeMarkets: Map<number, Market>;
  private currentQuotes: Map<number, MarketQuotes>;
  private lastQuotePrices: Map<number, LastQuotePrices>;
  private isRunning: boolean;
  private requoteTimers: Map<number, NodeJS.Timeout>;

  constructor(nord: Nord, user: NordUser) {
    this.nord = nord;
    this.user = user;
    this.riskManager = new RiskManager();
    this.spreadCalculator = new SpreadCalculator();
    this.sizingCalculator = new SizingCalculator();
    this.inventoryManager = new InventoryManager();
    this.hedgingEngine = new HedgingEngine();
    this.priceOracle = new PriceOracle(CONFIG.oracle);
    
    this.activeMarkets = new Map();
    this.currentQuotes = new Map();
    this.lastQuotePrices = new Map();
    this.isRunning = false;
    this.requoteTimers = new Map();
  }

  /**
   * Start market making on all or specific markets
   */
  async start(specificMarketId?: number): Promise<void> {
    try {
      logger.info('Starting Market Maker Bot', {
        oracleEnabled: CONFIG.oracle.enabled,
        requoteThreshold: CONFIG.requoteThreshold,
        inventorySkew: CONFIG.inventorySkewEnabled,
      });

      // Initialize user account
      await this.user.updateAccountId();
      await this.user.fetchInfo();

      // Load markets
      const allMarkets = await this.nord.getAllMarkets();
      
      if (specificMarketId) {
        const market = allMarkets.find(m => m.marketId === specificMarketId);
        if (!market) {
          throw new Error(`Market ${specificMarketId} not found`);
        }
        this.activeMarkets.set(market.marketId, market);
      } else {
        allMarkets.forEach(market => {
          this.activeMarkets.set(market.marketId, market);
        });
      }

      logger.info(`Loaded ${this.activeMarkets.size} markets`);

      // Start CEX price oracle if enabled
      if (CONFIG.oracle.enabled) {
        const symbols = Array.from(this.activeMarkets.values())
          .map(m => m.symbol.replace('-PERP', ''));
        
        this.priceOracle.startUpdates(symbols);
        logger.info('Price oracle started', { 
          sources: CONFIG.oracle.sources,
          symbols,
        });
      }

      // Subscribe to orderbook updates
      for (const [marketId, market] of this.activeMarkets) {
        await this.nord.subscribeOrderbook(marketId);
        logger.info(`Subscribed to ${market.symbol} (${marketId})`);
      }

      // Setup orderbook handler
      this.nord.onOrderbookUpdate(async (orderbook: Orderbook) => {
        await this.handleOrderbookUpdate(orderbook);
      });

      this.isRunning = true;
      logger.info('Market Maker Bot started successfully');

      // Setup periodic requote for safety
      for (const marketId of this.activeMarkets.keys()) {
        this.setupPeriodicRequote(marketId);
      }

    } catch (error) {
      logger.error('Failed to start Market Maker', { error });
      throw error;
    }
  }

  /**
   * Handle orderbook update from WebSocket
   */
  private async handleOrderbookUpdate(orderbook: Orderbook): Promise<void> {
    const { marketId } = orderbook;

    if (!this.activeMarkets.has(marketId)) {
      return;
    }

    try {
      // Check if orderbook is healthy
      if (!this.spreadCalculator.isOrderbookHealthy(orderbook)) {
        logger.warn('Unhealthy orderbook, skipping quote', { marketId });
        return;
      }

      // Risk check
      const riskCheck = await this.riskManager.canQuote(this.user, marketId);
      if (!riskCheck.canTrade) {
        logger.warn('Risk check failed, skipping quote', {
          marketId,
          reason: riskCheck.reason,
        });
        return;
      }

      // Generate and place quotes
      await this.requote(marketId, orderbook);

      // Check if hedging is needed
      const midPrice = await this.getMidPrice(marketId, orderbook);
      if (midPrice && this.inventoryManager.needsHedge(this.user, marketId, midPrice)) {
        await this.hedgingEngine.executeHedge(this.user, marketId, midPrice);
      }

    } catch (error) {
      logger.error('Error handling orderbook update', {
        marketId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get mid price - prefer CEX oracle, fallback to orderbook
   */
  private async getMidPrice(marketId: number, orderbook: Orderbook): Promise<number | null> {
    const market = this.activeMarkets.get(marketId);
    if (!market) return null;

    // Try CEX price first if oracle enabled
    if (CONFIG.oracle.enabled) {
      const symbol = market.symbol.replace('-PERP', '');
      const cexPrice = await this.priceOracle.getPrice(symbol);
      
      if (cexPrice && this.priceOracle.isPriceFresh(symbol)) {
        logger.debug('Using CEX price', {
          marketId,
          symbol,
          price: cexPrice.mid,
          source: cexPrice.source,
          age: this.priceOracle.getPriceAge(symbol),
        });
        return cexPrice.mid;
      }

      if (!CONFIG.oracle.fallbackToOrderbook) {
        logger.warn('CEX price unavailable and fallback disabled', { marketId, symbol });
        return null;
      }

      logger.debug('Falling back to orderbook price', { marketId, symbol });
    }

    // Fallback to orderbook
    return this.spreadCalculator.getMidPrice(orderbook);
  }

  /**
   * Check if we should requote based on price change threshold
   */
  private shouldRequote(
    marketId: number,
    newBidPrice: number,
    newAskPrice: number
  ): boolean {
    const lastPrices = this.lastQuotePrices.get(marketId);
    
    if (!lastPrices) {
      return true; // First quote
    }

    // Calculate price change percentage
    const bidChange = Math.abs(newBidPrice - lastPrices.bid) / lastPrices.bid;
    const askChange = Math.abs(newAskPrice - lastPrices.ask) / lastPrices.ask;

    const shouldRequote = bidChange > CONFIG.requoteThreshold || 
                         askChange > CONFIG.requoteThreshold;

    if (!shouldRequote) {
      logger.debug('Skipping requote - below threshold', {
        marketId,
        bidChange: (bidChange * 100).toFixed(4) + '%',
        askChange: (askChange * 100).toFixed(4) + '%',
        threshold: (CONFIG.requoteThreshold * 100).toFixed(4) + '%',
        timeSinceLastQuote: Date.now() - lastPrices.timestamp,
      });
    }

    return shouldRequote;
  }

  /**
   * Cancel existing orders and place new quotes
   */
  private async requote(marketId: number, orderbook: Orderbook): Promise<void> {
    try {
      // Get mid price (CEX or orderbook)
      const midPrice = await this.getMidPrice(marketId, orderbook);
      if (!midPrice) {
        logger.warn('Cannot calculate mid price', { marketId });
        return;
      }

      // Calculate dynamic spread
      const { spread, imbalance } = this.spreadCalculator.computeDynamicSpread(orderbook);

      // Apply inventory skew + bias
      const { bidPrice, askPrice, skewFactor, bias, positionRatio } = 
        this.inventoryManager.applyInventorySkew(
          this.user,
          marketId,
          midPrice,
          spread
        );

      // Check requote threshold
      if (!this.shouldRequote(marketId, bidPrice, askPrice)) {
        return; // Skip requote - price hasn't changed enough
      }

      // Store new prices for next threshold check
      this.lastQuotePrices.set(marketId, {
        bid: bidPrice,
        ask: askPrice,
        timestamp: Date.now(),
      });

      // Cancel existing orders for this market
      await this.cancelMarketOrders(marketId);

      // Calculate sizes for each level
      const levelSizes = this.sizingCalculator.calculateLevelSizes(this.user, marketId);

      if (levelSizes.length === 0) {
        logger.warn('No level sizes calculated', { marketId });
        return;
      }

      // Validate sizes
      if (!this.sizingCalculator.validateSizes(levelSizes, 
          this.user.balances[0]?.availableAmount || 0, midPrice)) {
        logger.warn('Size validation failed', { marketId });
        return;
      }

      // Generate quote levels
      const quotes = this.generateQuoteLevels(bidPrice, askPrice, spread, levelSizes);

      // Place orders
      await this.placeQuotes(marketId, quotes);

      // Store current quotes
      this.currentQuotes.set(marketId, {
        marketId,
        bids: quotes.bids,
        asks: quotes.asks,
        timestamp: Date.now(),
      });

      logger.info('Requoted successfully', {
        marketId,
        midPrice: midPrice.toFixed(2),
        spread: (spread * 100).toFixed(3) + '%',
        imbalance: imbalance.toFixed(3),
        skewFactor: skewFactor.toFixed(6),
        bias: bias.toFixed(6),
        positionRatio: positionRatio.toFixed(4),
        bidPrice: bidPrice.toFixed(2),
        askPrice: askPrice.toFixed(2),
        levels: levelSizes.length,
      });

    } catch (error) {
      logger.error('Requote failed', {
        marketId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Generate bid/ask quote levels
   */
  private generateQuoteLevels(
    baseBidPrice: number,
    baseAskPrice: number,
    spread: number,
    levelSizes: any[]
  ): { bids: QuoteLevel[]; asks: QuoteLevel[] } {
    const bids: QuoteLevel[] = [];
    const asks: QuoteLevel[] = [];

    for (let i = 0; i < Math.min(CONFIG.maxLevels, levelSizes.length); i++) {
      const spacing = spread * (i + 1) * 0.5; // Increase spacing with level

      bids.push({
        price: baseBidPrice * (1 - spacing),
        size: levelSizes[i].size,
      });

      asks.push({
        price: baseAskPrice * (1 + spacing),
        size: levelSizes[i].size,
      });
    }

    return { bids, asks };
  }

  /**
   * Place bid and ask quotes
   */
  private async placeQuotes(marketId: number, quotes: { bids: QuoteLevel[]; asks: QuoteLevel[] }): Promise<void> {
    const market = this.activeMarkets.get(marketId);
    if (!market) return;

    // Place bid orders
    for (const bid of quotes.bids) {
      try {
        const roundedPrice = this.roundPrice(bid.price, market.tickSize);
        const roundedSize = this.sizingCalculator.roundSize(bid.size, market.minSize);

        await this.user.placeOrder({
          marketId,
          side: Side.Bid,
          fillMode: FillMode.Limit,
          isReduceOnly: false,
          size: roundedSize,
          price: roundedPrice,
        });

        logOrderPlaced(marketId, 'BID', roundedPrice, roundedSize);
      } catch (error) {
        logger.error('Failed to place bid', {
          marketId,
          price: bid.price,
          size: bid.size,
          error: (error as Error).message,
        });
      }
    }

    // Place ask orders
    for (const ask of quotes.asks) {
      try {
        const roundedPrice = this.roundPrice(ask.price, market.tickSize);
        const roundedSize = this.sizingCalculator.roundSize(ask.size, market.minSize);

        await this.user.placeOrder({
          marketId,
          side: Side.Ask,
          fillMode: FillMode.Limit,
          isReduceOnly: false,
          size: roundedSize,
          price: roundedPrice,
        });

        logOrderPlaced(marketId, 'ASK', roundedPrice, roundedSize);
      } catch (error) {
        logger.error('Failed to place ask', {
          marketId,
          price: ask.price,
          size: ask.size,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Cancel all orders for a specific market
   */
  private async cancelMarketOrders(marketId: number): Promise<void> {
    try {
      await this.user.fetchInfo();
      
      const marketOrders = Object.entries(this.user.orders)
        .filter(([_, order]) => order.marketId === marketId);

      for (const [orderId, _] of marketOrders) {
        try {
          await this.user.cancelOrder(orderId);
          logOrderCancelled(orderId, marketId);
        } catch (error) {
          logger.error('Failed to cancel order', {
            orderId,
            marketId,
            error: (error as Error).message,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to cancel market orders', {
        marketId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Setup periodic requote as safety mechanism
   */
  private setupPeriodicRequote(marketId: number): void {
    const timer = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(timer);
        return;
      }

      logger.debug('Periodic requote check', { marketId });
      
      // Fetch fresh account info
      try {
        await this.user.fetchInfo();
      } catch (error) {
        logger.error('Failed to fetch info in periodic check', { marketId, error });
      }
    }, CONFIG.requoteIntervalMs);

    this.requoteTimers.set(marketId, timer);
  }

  /**
   * Stop market making
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping Market Maker Bot');
      this.isRunning = false;

      // Clear timers
      for (const timer of this.requoteTimers.values()) {
        clearInterval(timer);
      }
      this.requoteTimers.clear();

      // Stop price oracle
      if (this.priceOracle) {
        this.priceOracle.stop();
        logger.info('Price oracle stopped');
      }

      // Cancel all orders
      await this.riskManager.emergencyCancelAll(this.user);

      // Unsubscribe from orderbooks
      for (const marketId of this.activeMarkets.keys()) {
        await this.nord.unsubscribeOrderbook(marketId);
      }

      logger.info('Market Maker Bot stopped');
    } catch (error) {
      logger.error('Error stopping Market Maker', { error });
    }
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<any> {
    await this.user.fetchInfo();

    const positions = Object.entries(this.user.positions).map(([marketId, pos]) => {
      const mid = this.lastQuotePrices.get(parseInt(marketId));
      const invStatus = this.inventoryManager.getInventoryStatus(
        this.user, 
        parseInt(marketId), 
        mid?.bid || pos.entryPrice
      );

      return {
        marketId: parseInt(marketId),
        size: pos.size,
        entryPrice: pos.entryPrice,
        unrealizedPnl: pos.unrealizedPnl,
        positionRatio: invStatus.positionRatio,
        bias: invStatus.bias,
      };
    });

    const activeOrders = Object.keys(this.user.orders).length;

    return {
      isRunning: this.isRunning,
      activeMarkets: Array.from(this.activeMarkets.keys()),
      positions,
      activeOrders,
      balance: this.user.balances[0]?.amount || 0,
      freeCollateral: this.user.balances[0]?.availableAmount || 0,
      oracleStatus: CONFIG.oracle.enabled ? 'enabled' : 'disabled',
      requoteThreshold: CONFIG.requoteThreshold,
    };
  }

  private roundPrice(price: number, tickSize: number): number {
    return Math.round(price / tickSize) * tickSize;
  }
}