import { NordUser } from '@n1xyz/nord-ts';
import { CONFIG } from '../config';
import { RiskManager } from './risk';
import { logger } from '../logger';

export interface SkewedPrice {
  bidPrice: number;
  askPrice: number;
  skewFactor: number;
  positionRatio: number;
}

export class InventoryManager {
  private riskManager: RiskManager;

  constructor() {
    this.riskManager = new RiskManager();
  }

  /**
   * Apply inventory skew to prices to encourage reducing position
   * Long position → worse sell prices (encourage selling)
   * Short position → worse buy prices (encourage buying)
   */
  applyInventorySkew(
    user: NordUser,
    marketId: number,
    basePrice: number,
    spread: number
  ): SkewedPrice {
    if (!CONFIG.inventorySkewEnabled) {
      return {
        bidPrice: basePrice * (1 - spread / 2),
        askPrice: basePrice * (1 + spread / 2),
        skewFactor: 0,
        positionRatio: 0,
      };
    }

    const positionRatio = this.riskManager.getPositionRatio(user, marketId, basePrice);

    // Calculate skew factor based on position size
    let skewFactor = 0;

    if (Math.abs(positionRatio) > 0.05) {
      // Only apply skew if position is > 5% of max
      skewFactor = positionRatio * CONFIG.inventorySkewFactor;
    }

    // Apply skew
    // Positive positionRatio (long) → increase both prices (worse sells)
    // Negative positionRatio (short) → decrease both prices (worse buys)
    const skewedBasePrice = basePrice * (1 + skewFactor);

    const bidPrice = skewedBasePrice * (1 - spread / 2);
    const askPrice = skewedBasePrice * (1 + spread / 2);

    logger.debug('Inventory skew applied', {
      marketId,
      positionRatio,
      skewFactor,
      basePrice,
      skewedBasePrice,
      bidPrice,
      askPrice,
    });

    return {
      bidPrice,
      askPrice,
      skewFactor,
      positionRatio,
    };
  }

  /**
   * Check if position needs hedging
   */
  needsHedge(user: NordUser, marketId: number, midPrice: number): boolean {
    if (!CONFIG.autoHedge.enabled) {
      return false;
    }

    const positionRatio = this.riskManager.getPositionRatio(user, marketId, midPrice);
    const needsHedge = Math.abs(positionRatio) > CONFIG.autoHedge.imbalanceThreshold;

    if (needsHedge) {
      logger.info('Position needs hedging', {
        marketId,
        positionRatio,
        threshold: CONFIG.autoHedge.imbalanceThreshold,
      });
    }

    return needsHedge;
  }

  /**
   * Get current inventory status
   */
  getInventoryStatus(user: NordUser, marketId: number, midPrice: number): {
    hasPosition: boolean;
    positionSize: number;
    positionValue: number;
    positionRatio: number;
    needsSkew: boolean;
  } {
    const position = user.positions[marketId];

    if (!position || position.size === 0) {
      return {
        hasPosition: false,
        positionSize: 0,
        positionValue: 0,
        positionRatio: 0,
        needsSkew: false,
      };
    }

    const positionRatio = this.riskManager.getPositionRatio(user, marketId, midPrice);
    const positionValue = position.size * midPrice;
    const needsSkew = Math.abs(positionRatio) > 0.05;

    return {
      hasPosition: true,
      positionSize: position.size,
      positionValue,
      positionRatio,
      needsSkew,
    };
  }
}