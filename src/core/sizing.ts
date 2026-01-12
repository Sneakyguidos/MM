import { NordUser } from '@n1xyz/nord-ts';
import { CONFIG, USDC_MINT_INDEX } from '../config';
import { logger } from '../logger';

export interface LevelSize {
  level: number;
  size: number;
}

export class SizingCalculator {
  /**
   * Calculate order sizes for all levels based on configured mode
   */
  calculateLevelSizes(user: NordUser, marketId: number): LevelSize[] {
    const balance = user.balances[USDC_MINT_INDEX];
    const freeCollateral = balance?.availableAmount || 0;

    if (freeCollateral === 0) {
      logger.warn('Zero free collateral for sizing', { marketId });
      return [];
    }

    switch (CONFIG.quantityMode) {
      case 'fixed':
        return this.calculateFixedSizes();
      case 'percentage':
        return this.calculatePercentageSizes(freeCollateral);
      case 'tiered':
        return this.calculateTieredSizes(freeCollateral);
      default:
        logger.error('Unknown quantity mode', { mode: CONFIG.quantityMode });
        return this.calculateFixedSizes();
    }
  }

  /**
   * Fixed size mode: same size for all levels
   */
  private calculateFixedSizes(): LevelSize[] {
    const sizes: LevelSize[] = [];

    for (let i = 0; i < CONFIG.maxLevels; i++) {
      sizes.push({
        level: i,
        size: CONFIG.fixedSize,
      });
    }

    return sizes;
  }

  /**
   * Percentage mode: each level uses a percentage of free collateral
   */
  private calculatePercentageSizes(freeCollateral: number): LevelSize[] {
    const sizes: LevelSize[] = [];
    const sizePerLevel = freeCollateral * CONFIG.percentPerLevel;

    for (let i = 0; i < CONFIG.maxLevels; i++) {
      sizes.push({
        level: i,
        size: sizePerLevel,
      });
    }

    return sizes;
  }

  /**
   * Tiered mode: larger sizes closer to mid price
   */
  private calculateTieredSizes(freeCollateral: number): LevelSize[] {
    const sizes: LevelSize[] = [];
    const maxPosition = freeCollateral * CONFIG.risk.maxExposurePerMarket;

    for (let i = 0; i < CONFIG.maxLevels; i++) {
      const multiplier = CONFIG.tieredMultipliers[i] || 0;
      const size = maxPosition * multiplier;

      sizes.push({
        level: i,
        size,
      });
    }

    return sizes;
  }

  /**
   * Round size to meet exchange requirements
   */
  roundSize(size: number, minSize: number, stepSize: number = 0.01): number {
    if (size < minSize) {
      return minSize;
    }

    // Round to nearest step
    const steps = Math.floor(size / stepSize);
    return steps * stepSize;
  }

  /**
   * Calculate total size for all levels
   */
  getTotalSize(levelSizes: LevelSize[]): number {
    return levelSizes.reduce((sum, ls) => sum + ls.size, 0);
  }

  /**
   * Validate sizes don't exceed risk limits
   */
  validateSizes(levelSizes: LevelSize[], freeCollateral: number, midPrice: number): boolean {
    const totalSize = this.getTotalSize(levelSizes);
    const totalValue = totalSize * midPrice;
    const maxAllowed = freeCollateral * CONFIG.risk.maxExposurePerSide;

    if (totalValue > maxAllowed) {
      logger.warn('Level sizes exceed risk limit', {
        totalValue,
        maxAllowed,
        totalSize,
        midPrice,
      });
      return false;
    }

    return true;
  }
}