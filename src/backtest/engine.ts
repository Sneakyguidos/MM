import { CONFIG } from '../config';
import { SpreadCalculator } from '../core/spread';
import { SizingCalculator } from '../core/sizing';
import { logger } from '../logger';

export interface HistoricalBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bidDepth: number;
  askDepth: number;
}

export interface BacktestOrder {
  id: string;
  side: 'bid' | 'ask';
  price: number;
  size: number;
  timestamp: number;
  filled: boolean;
  fillPrice?: number;
  fillTimestamp?: number;
}

export interface BacktestPosition {
  size: number;
  entryPrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
}

export interface BacktestResult {
  totalPnl: number;
  totalVolume: number;
  numTrades: number;
  numWins: number;
  numLosses: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgSpread: number;
  fillRate: number;
  startBalance: number;
  endBalance: number;
}

export class BacktestEngine {
  private spreadCalculator: SpreadCalculator;
  private sizingCalculator: SizingCalculator;
  
  private orders: BacktestOrder[];
  private position: BacktestPosition;
  private balance: number;
  private equity: number[];
  private timestamps: number[];
  
  constructor(initialBalance: number = 10000) {
    this.spreadCalculator = new SpreadCalculator();
    this.sizingCalculator = new SizingCalculator();
    
    this.orders = [];
    this.position = {
      size: 0,
      entryPrice: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
    };
    this.balance = initialBalance;
    this.equity = [initialBalance];
    this.timestamps = [];
  }

  /**
   * Run backtest on historical data
   */
  async run(historicalData: HistoricalBar[]): Promise<BacktestResult> {
    logger.info('Starting backtest', { bars: historicalData.length });

    for (let i = 0; i < historicalData.length; i++) {
      const bar = historicalData[i];
      
      // Check for fills on existing orders
      this.checkFills(bar);
      
      // Cancel unfilled orders
      this.cancelOldOrders(bar.timestamp);
      
      // Update unrealized PnL
      this.updateUnrealizedPnl(bar.close);
      
      // Place new quotes
      await this.placeQuotes(bar);
      
      // Track equity
      const totalEquity = this.balance + this.position.unrealizedPnl;
      this.equity.push(totalEquity);
      this.timestamps.push(bar.timestamp);
    }

    // Calculate final metrics
    const result = this.calculateMetrics();
    
    logger.info('Backtest completed', result);
    
    return result;
  }

  /**
   * Check if any orders got filled
   */
  private checkFills(bar: HistoricalBar): void {
    for (const order of this.orders) {
      if (order.filled) continue;

      // Probabilistic fill based on price action
      const fillProbability = this.calculateFillProbability(order, bar);
      
      if (Math.random() < fillProbability) {
        this.fillOrder(order, bar);
      }
    }
  }

  /**
   * Calculate probability of order being filled
   */
  private calculateFillProbability(order: BacktestOrder, bar: HistoricalBar): number {
    if (order.side === 'bid') {
      // Bid fills if price goes down
      if (bar.low <= order.price) {
        return 0.8; // High probability if price touched our level
      }
      if (bar.close < order.price) {
        return 0.3; // Lower probability if just close is better
      }
    } else {
      // Ask fills if price goes up
      if (bar.high >= order.price) {
        return 0.8;
      }
      if (bar.close > order.price) {
        return 0.3;
      }
    }
    
    return 0.05; // Small probability even if not touched
  }

  /**
   * Fill an order
   */
  private fillOrder(order: BacktestOrder, bar: HistoricalBar): void {
    order.filled = true;
    order.fillPrice = order.price;
    order.fillTimestamp = bar.timestamp;

    // Update position
    const sizeChange = order.side === 'bid' ? order.size : -order.size;
    const oldSize = this.position.size;
    const newSize = oldSize + sizeChange;

    // Calculate realized PnL if closing/reducing position
    if ((oldSize > 0 && sizeChange < 0) || (oldSize < 0 && sizeChange > 0)) {
      const closedSize = Math.min(Math.abs(oldSize), Math.abs(sizeChange));
      const pnl = oldSize > 0
        ? closedSize * (order.price - this.position.entryPrice)
        : closedSize * (this.position.entryPrice - order.price);
      
      this.position.realizedPnl += pnl;
      this.balance += pnl;
    }

    // Update position
    if (newSize === 0) {
      this.position.size = 0;
      this.position.entryPrice = 0;
    } else if (Math.sign(newSize) !== Math.sign(oldSize)) {
      // Flipped position
      this.position.size = newSize;
      this.position.entryPrice = order.price;
    } else if (Math.abs(newSize) > Math.abs(oldSize)) {
      // Increased position
      const weightedPrice = (oldSize * this.position.entryPrice + sizeChange * order.price) / newSize;
      this.position.entryPrice = weightedPrice;
      this.position.size = newSize;
    } else {
      // Reduced position
      this.position.size = newSize;
    }

    logger.debug('Order filled', {
      side: order.side,
      price: order.price,
      size: order.size,
      newPosition: this.position.size,
    });
  }

  /**
   * Cancel orders older than threshold
   */
  private cancelOldOrders(currentTime: number): void {
    const maxAge = 60000; // 1 minute
    
    this.orders = this.orders.filter(order => {
      if (!order.filled && currentTime - order.timestamp > maxAge) {
        return false; // Remove old unfilled orders
      }
      return true;
    });
  }

  /**
   * Update unrealized PnL
   */
  private updateUnrealizedPnl(currentPrice: number): void {
    if (this.position.size === 0) {
      this.position.unrealizedPnl = 0;
      return;
    }

    const pnl = this.position.size > 0
      ? this.position.size * (currentPrice - this.position.entryPrice)
      : this.position.size * (this.position.entryPrice - currentPrice);

    this.position.unrealizedPnl = pnl;
  }

  /**
   * Place new quotes based on current bar
   */
  private async placeQuotes(bar: HistoricalBar): Promise<void> {
    const midPrice = bar.close;
    
    // Simulate orderbook
    const simulatedOrderbook = {
      marketId: 1,
      bids: [{ price: midPrice * 0.999, size: bar.bidDepth }],
      asks: [{ price: midPrice * 1.001, size: bar.askDepth }],
      timestamp: bar.timestamp,
    };

    const { spread } = this.spreadCalculator.computeDynamicSpread(simulatedOrderbook);
    
    // Calculate quote prices
    const bidPrice = midPrice * (1 - spread / 2);
    const askPrice = midPrice * (1 + spread / 2);

    // Fixed size for backtest
    const size = CONFIG.fixedSize;

    // Place orders
    for (let i = 0; i < CONFIG.maxLevels; i++) {
      const spacing = spread * (i + 1) * 0.5;

      this.orders.push({
        id: `bid_${bar.timestamp}_${i}`,
        side: 'bid',
        price: bidPrice * (1 - spacing),
        size,
        timestamp: bar.timestamp,
        filled: false,
      });

      this.orders.push({
        id: `ask_${bar.timestamp}_${i}`,
        side: 'ask',
        price: askPrice * (1 + spacing),
        size,
        timestamp: bar.timestamp,
        filled: false,
      });
    }
  }

  /**
   * Calculate backtest metrics
   */
  private calculateMetrics(): BacktestResult {
    const filledOrders = this.orders.filter(o => o.filled);
    const totalOrders = this.orders.length;

    let totalVolume = 0;
    let numWins = 0;
    let numLosses = 0;
    let spreads: number[] = [];

    // Calculate per-trade metrics
    for (let i = 1; i < filledOrders.length; i++) {
      const prev = filledOrders[i - 1];
      const curr = filledOrders[i];
      
      totalVolume += curr.size * curr.price!;
      
      if (prev.side !== curr.side && prev.fillPrice && curr.fillPrice) {
        const pnl = prev.side === 'bid'
          ? (curr.fillPrice - prev.fillPrice) * prev.size
          : (prev.fillPrice - curr.fillPrice) * prev.size;
        
        if (pnl > 0) numWins++;
        else if (pnl < 0) numLosses++;

        const spread = Math.abs(curr.fillPrice - prev.fillPrice) / prev.fillPrice;
        spreads.push(spread);
      }
    }

    const winRate = (numWins + numLosses) > 0 ? numWins / (numWins + numLosses) : 0;
    const fillRate = totalOrders > 0 ? filledOrders.length / totalOrders : 0;
    const avgSpread = spreads.length > 0 ? spreads.reduce((a, b) => a + b, 0) / spreads.length : 0;

    // Calculate Sharpe ratio
    const returns = [];
    for (let i = 1; i < this.equity.length; i++) {
      const ret = (this.equity[i] - this.equity[i - 1]) / this.equity[i - 1];
      returns.push(ret);
    }
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = this.equity[0];
    
    for (const equity of this.equity) {
      if (equity > peak) {
        peak = equity;
      }
      const drawdown = (peak - equity) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    const endBalance = this.balance + this.position.unrealizedPnl;
    const totalPnl = endBalance - this.equity[0];

    return {
      totalPnl,
      totalVolume,
      numTrades: filledOrders.length,
      numWins,
      numLosses,
      winRate,
      sharpeRatio,
      maxDrawdown,
      avgSpread,
      fillRate,
      startBalance: this.equity[0],
      endBalance,
    };
  }
}