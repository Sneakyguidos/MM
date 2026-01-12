import { NordUser, Position } from '@n1xyz/nord-ts';
import { CONFIG, USDC_MINT_INDEX } from '../config';
import { logger, logRiskViolation } from '../logger';

export interface RiskCheckResult {
  canTrade: boolean;
  reason?: string;
  details?: Record<string, any>;
}

export class RiskManager {
  /**
   * Performs comprehensive risk checks before allowing trading
   */
  async canQuote(user: NordUser, marketId: number): Promise<RiskCheckResult> {
    try {
      await user.fetchInfo();

      // Check 1: Margin Fraction
      const marginCheck = await this.checkMarginFraction(user);
      if (!marginCheck.canTrade) return marginCheck;

      // Check 2: Free Collateral
      const collateralCheck = this.checkFreeCollateral(user);
      if (!collateralCheck.canTrade) return collateralCheck;

      // Check 3: Market Exposure
      const marketCheck = this.checkMarketExposure(user, marketId);
      if (!marketCheck.canTrade) return marketCheck;

      // Check 4: Total Exposure
      const totalCheck = this.checkTotalExposure(user);
      if (!totalCheck.canTrade) return totalCheck;

      return { canTrade: true };
    } catch (error) {
      logger.error('Risk check failed', { error, marketId });
      return {
        canTrade: false,
        reason: 'Risk check error',
        details: { error: (error as Error).message },
      };
    }
  }

  private async checkMarginFraction(user: NordUser): Promise<RiskCheckResult> {
    const marginFraction = await user.getLeverage();
    
    if (marginFraction < CONFIG.risk.minMarginFraction) {
      const result = {
        canTrade: false,
        reason: 'Margin fraction too low',
        details: { marginFraction, required: CONFIG.risk.minMarginFraction },
      };
      logRiskViolation(result.reason!, result.details!);
      return result;
    }

    return { canTrade: true };
  }

  private checkFreeCollateral(user: NordUser): RiskCheckResult {
    const balance = user.balances[USDC_MINT_INDEX];
    
    if (!balance) {
      return {
        canTrade: false,
        reason: 'No USDC balance found',
      };
    }

    const freeCollateral = balance.availableAmount;

    if (freeCollateral < CONFIG.risk.minFreeCollateral) {
      const result = {
        canTrade: false,
        reason: 'Insufficient free collateral',
        details: { freeCollateral, required: CONFIG.risk.minFreeCollateral },
      };
      logRiskViolation(result.reason!, result.details!);
      return result;
    }

    return { canTrade: true };
  }

  private checkMarketExposure(user: NordUser, marketId: number): RiskCheckResult {
    const position = user.positions[marketId];
    
    if (!position) {
      return { canTrade: true };
    }

    const balance = user.balances[USDC_MINT_INDEX];
    const freeCollateral = balance?.availableAmount || 0;
    const maxPosition = freeCollateral * CONFIG.risk.maxExposurePerMarket;
    const currentExposure = Math.abs(position.size * position.entryPrice);

    if (currentExposure > maxPosition) {
      const result = {
        canTrade: false,
        reason: 'Market exposure limit exceeded',
        details: {
          marketId,
          currentExposure,
          maxPosition,
          positionSize: position.size,
        },
      };
      logRiskViolation(result.reason!, result.details!);
      return result;
    }

    return { canTrade: true };
  }

  private checkTotalExposure(user: NordUser): RiskCheckResult {
    const balance = user.balances[USDC_MINT_INDEX];
    const totalCollateral = balance?.amount || 0;

    let totalExposure = 0;
    
    for (const position of Object.values(user.positions)) {
      totalExposure += Math.abs(position.size * position.entryPrice);
    }

    const exposureRatio = totalExposure / totalCollateral;

    if (exposureRatio > CONFIG.risk.maxTotalExposure) {
      const result = {
        canTrade: false,
        reason: 'Total exposure limit exceeded',
        details: {
          totalExposure,
          totalCollateral,
          exposureRatio,
          maxAllowed: CONFIG.risk.maxTotalExposure,
        },
      };
      logRiskViolation(result.reason!, result.details!);
      return result;
    }

    return { canTrade: true };
  }

  /**
   * Calculate position ratio for inventory skew
   * Returns value between -1 and 1
   */
  getPositionRatio(user: NordUser, marketId: number, midPrice: number): number {
    const position = user.positions[marketId];
    
    if (!position || position.size === 0) {
      return 0;
    }

    const balance = user.balances[USDC_MINT_INDEX];
    const freeCollateral = balance?.availableAmount || 0;
    
    if (freeCollateral === 0) {
      return 0;
    }

    const positionValue = position.size * midPrice;
    const maxPositionValue = freeCollateral * CONFIG.risk.maxExposurePerMarket;

    return positionValue / maxPositionValue;
  }

  /**
   * Emergency cancel all orders
   */
  async emergencyCancelAll(user: NordUser): Promise<void> {
    try {
      logger.warn('Emergency cancel triggered - cancelling all orders');
      await user.cancelAllOrders();
      logger.info('Emergency cancel completed');
    } catch (error) {
      logger.error('Emergency cancel failed', { error });
      throw error;
    }
  }
}