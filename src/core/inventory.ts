import { NordUser } from '@n1xyz/nord-ts';
import { CONFIG } from '../config';
import { RiskManager } from './risk';
import { logger } from '../logger';

export interface SkewedPrice {
  bidPrice: number;
  askPrice: number;
  skewFactor: number;
  bias: number;
  positionRatio: number;
}

export class InventoryManager {
  private riskManager: RiskManager;

  constructor() {
    this.riskManager = new RiskManager();
  }

  /**
   * Apply inventory skew + bias to prices
   * - Inventory skew: moves quotes away from position to reduce risk
   * - Bias: fixed adjustment to encourage buying/selling
   * 
   * Long position → worse sell prices (encourage selling)
   * Short position → worse buy prices (encourage buying)
   * Positive bias → quotes higher (encourage selling)
   * Negative bias → quotes lower (encourage buying)
   */
  applyInventorySkew(
    user: NordUser,
    marketId: number,
    basePrice: number,
    spread: number
  ): SkewedPrice {
    // Get per-market bias or default
    const bias = CONFIG.assets[marketId]?.bias || CONFIG.defaultBias;

    if (!CONFIG.inventorySkewEnabled) {
      // Even without skew, apply bias if configured
      const bidPrice = basePrice * (1 - spread / 2 + bias);
      const askPrice = basePrice * (1 + spread / 2 + bias);

      if (bias !== 0) {
        logger.debug('Bias applied (skew disabled)', {
          marketId,
          bias,
          basePrice,
          bidPrice,
          askPrice,
        });
      }

      return {
        bidPrice,
        askPrice,
        skewFactor: 0,
        bias,
        positionRatio: 0,
      };
    }

    // Calculate position-based skew
    const positionRatio = this.riskManager.getPositionRatio(user, marketId, basePrice);

    let skewFactor = 0;
    if (Math.abs(positionRatio) > 0.05) {
      // Only apply skew if position is > 5% of max
      skewFactor = positionRatio * CONFIG.inventorySkewFactor;
    }

    // Combine skew and bias
    const totalAdjustment = skewFactor + bias;

    // Apply total adjustment to base price
    const adjustedBasePrice = basePrice * (1 + totalAdjustment);

    const bidPrice = adjustedBasePrice * (1 - spread / 2);
    const askPrice = adjustedBasePrice * (1 + spread / 2);

    logger.debug('Inventory skew + bias applied', {
      marketId,
      positionRatio: positionRatio.toFixed(4),
      skewFactor: skewFactor.toFixed(6),
      bias: bias.toFixed(6),
      totalAdjustment: totalAdjustment.toFixed(6),
      basePrice: basePrice.toFixed(2),
      adjustedBasePrice: adjustedBasePrice.toFixed(2),
      bidPrice: bidPrice.toFixed(2),
      askPrice: askPrice.toFixed(2),
    });

    return {
      bidPrice,
      askPrice,
      skewFactor,
      bias,
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
        positionRatio: positionRatio.toFixed(4),
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
    bias: number;
  } {
    const position = user.positions[marketId];
    const bias = CONFIG.assets[marketId]?.bias || CONFIG.defaultBias;

    if (!position || position.size === 0) {
      return {
        hasPosition: false,
        positionSize: 0,
        positionValue: 0,
        positionRatio: 0,
        needsSkew: false,
        bias,
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
      bias,
    };
  }

  /**
   * Calculate effective spread after skew + bias
   */
  getEffectiveSpread(
    user: NordUser,
    marketId: number,
    basePrice: number,
    baseSpread: number
  ): number {
    const skewed = this.applyInventorySkew(user, marketId, basePrice, baseSpread);
    const effectiveSpread = (skewed.askPrice - skewed.bidPrice) / basePrice;
    
    return effectiveSpread;
  }
}