import { HistoricalBar } from './engine';
import { logger } from '../logger';

export interface SimulatorConfig {
  startPrice: number;
  numBars: number;
  volatility: number;
  trendStrength: number;
  spreadMin: number;
  spreadMax: number;
  depthMin: number;
  depthMax: number;
}

export class MarketSimulator {
  private config: SimulatorConfig;

  constructor(config: Partial<SimulatorConfig> = {}) {
    this.config = {
      startPrice: config.startPrice || 100,
      numBars: config.numBars || 1000,
      volatility: config.volatility || 0.02,
      trendStrength: config.trendStrength || 0.0001,
      spreadMin: config.spreadMin || 0.001,
      spreadMax: config.spreadMax || 0.05,
      depthMin: config.depthMin || 10,
      depthMax: config.depthMax || 100,
    };
  }

  /**
   * Generate synthetic market data for backtesting
   */
  generate(): HistoricalBar[] {
    logger.info('Generating simulated market data', this.config);

    const bars: HistoricalBar[] = [];
    let currentPrice = this.config.startPrice;
    let timestamp = Date.now() - this.config.numBars * 60000; // Start from past

    for (let i = 0; i < this.config.numBars; i++) {
      const bar = this.generateBar(currentPrice, timestamp);
      bars.push(bar);
      
      currentPrice = bar.close;
      timestamp += 60000; // 1 minute bars
    }

    logger.info('Market data generated', { bars: bars.length });

    return bars;
  }

  /**
   * Generate illiquid market scenario
   */
  generateIlliquidMarket(steps: number = 1000): HistoricalBar[] {
    logger.info('Generating illiquid market scenario', { steps });

    const bars: HistoricalBar[] = [];
    let currentPrice = this.config.startPrice;
    let timestamp = Date.now() - steps * 60000;

    for (let i = 0; i < steps; i++) {
      // Wide spreads for illiquid markets
      const spread = this.config.spreadMax * (0.5 + Math.random() * 0.5);
      
      // Low depth
      const depth = this.config.depthMin * (0.5 + Math.random() * 0.5);

      // High volatility
      const volatility = this.config.volatility * 2;
      
      const bar = this.generateBar(currentPrice, timestamp, spread, depth, volatility);
      bars.push(bar);
      
      currentPrice = bar.close;
      timestamp += 60000;
    }

    logger.info('Illiquid market data generated', { bars: bars.length });

    return bars;
  }

  /**
   * Generate single OHLCV bar
   */
  private generateBar(
    currentPrice: number,
    timestamp: number,
    forcedSpread?: number,
    forcedDepth?: number,
    forcedVolatility?: number
  ): HistoricalBar {
    const volatility = forcedVolatility || this.config.volatility;
    
    // Price movement with drift
    const drift = this.config.trendStrength * (Math.random() - 0.5);
    const randomWalk = volatility * this.randomNormal();
    const priceChange = currentPrice * (drift + randomWalk);

    const close = currentPrice + priceChange;
    
    // Generate OHLC
    const high = close * (1 + Math.abs(randomWalk) * 0.5);
    const low = close * (1 - Math.abs(randomWalk) * 0.5);
    const open = currentPrice;

    // Generate volume
    const volume = 1000 + Math.random() * 9000;

    // Generate orderbook depth
    const spread = forcedSpread || (this.config.spreadMin + Math.random() * (this.config.spreadMax - this.config.spreadMin));
    const bidDepth = forcedDepth || (this.config.depthMin + Math.random() * (this.config.depthMax - this.config.depthMin));
    const askDepth = forcedDepth || (this.config.depthMin + Math.random() * (this.config.depthMax - this.config.depthMin));

    return {
      timestamp,
      open,
      high,
      low,
      close,
      volume,
      bidDepth,
      askDepth,
    };
  }

  /**
   * Generate normally distributed random number (Box-Muller transform)
   */
  private randomNormal(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  /**
   * Generate trending market
   */
  generateTrendingMarket(steps: number = 1000, uptrend: boolean = true): HistoricalBar[] {
    const originalTrend = this.config.trendStrength;
    this.config.trendStrength = uptrend ? 0.001 : -0.001;

    const bars = this.generate();
    
    this.config.trendStrength = originalTrend;

    return bars;
  }

  /**
   * Generate ranging market (low trend, moderate volatility)
   */
  generateRangingMarket(steps: number = 1000): HistoricalBar[] {
    const originalTrend = this.config.trendStrength;
    const originalVol = this.config.volatility;

    this.config.trendStrength = 0.0001;
    this.config.volatility = 0.01;

    const bars = this.generate();

    this.config.trendStrength = originalTrend;
    this.config.volatility = originalVol;

    return bars;
  }

  /**
   * Load data from JSON file (for real historical data)
   */
  static fromJSON(jsonData: any[]): HistoricalBar[] {
    return jsonData.map(bar => ({
      timestamp: bar.timestamp || Date.now(),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      bidDepth: bar.bidDepth || 50,
      askDepth: bar.askDepth || 50,
    }));
  }

  /**
   * Load data from CSV string
   */
  static fromCSV(csvData: string): HistoricalBar[] {
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',');
    
    const bars: HistoricalBar[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const bar: any = {};
      
      headers.forEach((header, index) => {
        bar[header.trim()] = parseFloat(values[index]) || values[index];
      });

      bars.push({
        timestamp: bar.timestamp || Date.now() + i * 60000,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        bidDepth: bar.bidDepth || 50,
        askDepth: bar.askDepth || 50,
      });
    }

    return bars;
  }
}