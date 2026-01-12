import { Orderbook, OrderbookLevel } from '@n1xyz/nord-ts';
import { CONFIG } from '../config';
import { logger } from '../logger';

export interface SpreadCalculation {
  spread: number;
  imbalance: number;
  bidDepth: number;
  askDepth: number;
}

export class SpreadCalculator {
  /**
   * Calculate dynamic spread based on orderbook depth and imbalance
   */
  computeDynamicSpread(orderbook: Orderbook): SpreadCalculation {
    const { bids, asks } = orderbook;

    // Calculate depth at top N levels
    const depthLevels = Math.min(CONFIG.spread.depthLevels, Math.min(bids.length, asks.length));
    
    const bidDepth = this.sumDepth(bids.slice(0, depthLevels));
    const askDepth = this.sumDepth(asks.slice(0, depthLevels));

    // Calculate imbalance (-1 to 1)
    const totalDepth = bidDepth + askDepth;
    const imbalance = totalDepth > 0 ? (bidDepth - askDepth) / totalDepth : 0;

    // Widen spread based on imbalance
    const imbalanceFactor = Math.abs(imbalance);
    const spread = CONFIG.spread.min + imbalanceFactor * (CONFIG.spread.max - CONFIG.spread.min);

    // Clamp to configured range
    const clampedSpread = this.clamp(spread, CONFIG.spread.min, CONFIG.spread.max);

    logger.debug('Spread calculated', {
      marketId: orderbook.marketId,
      spread: clampedSpread,
      imbalance,
      bidDepth,
      askDepth,
    });

    return {
      spread: clampedSpread,
      imbalance,
      bidDepth,
      askDepth,
    };
  }

  /**
   * Get mid price from orderbook
   */
  getMidPrice(orderbook: Orderbook): number | null {
    const { bids, asks } = orderbook;

    if (bids.length === 0 || asks.length === 0) {
      logger.warn('Empty orderbook', { marketId: orderbook.marketId });
      return null;
    }

    const bestBid = bids[0].price;
    const bestAsk = asks[0].price;

    return (bestBid + bestAsk) / 2;
  }

  /**
   * Calculate orderbook imbalance at specific price level
   */
  getOrderbookImbalance(orderbook: Orderbook, levels: number = 5): number {
    const { bids, asks } = orderbook;

    const bidDepth = this.sumDepth(bids.slice(0, levels));
    const askDepth = this.sumDepth(asks.slice(0, levels));

    const totalDepth = bidDepth + askDepth;
    
    return totalDepth > 0 ? (bidDepth - askDepth) / totalDepth : 0;
  }

  /**
   * Check if orderbook is healthy enough to quote
   */
  isOrderbookHealthy(orderbook: Orderbook): boolean {
    const { bids, asks } = orderbook;

    // Must have at least some depth
    if (bids.length < 2 || asks.length < 2) {
      return false;
    }

    const midPrice = this.getMidPrice(orderbook);
    if (!midPrice) {
      return false;
    }

    // Check spread is not too wide (e.g., > 5%)
    const bestBid = bids[0].price;
    const bestAsk = asks[0].price;
    const currentSpread = (bestAsk - bestBid) / midPrice;

    if (currentSpread > 0.05) {
      logger.warn('Orderbook spread too wide', {
        marketId: orderbook.marketId,
        spread: currentSpread,
      });
      return false;
    }

    return true;
  }

  private sumDepth(levels: OrderbookLevel[]): number {
    return levels.reduce((sum, level) => sum + level.size, 0);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}