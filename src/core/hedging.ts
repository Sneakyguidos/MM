import { NordUser, Side, FillMode } from '@n1xyz/nord-ts';
import { CONFIG } from '../config';
import { logger } from '../logger';

export class HedgingEngine {
  /**
   * Execute hedge order to reduce position imbalance
   */
  async executeHedge(
    user: NordUser,
    marketId: number,
    midPrice: number
  ): Promise<void> {
    if (!CONFIG.autoHedge.enabled) {
      return;
    }

    try {
      const position = user.positions[marketId];

      if (!position || position.size === 0) {
        return;
      }

      // Determine hedge side (opposite of current position)
      const hedgeSide = position.size > 0 ? Side.Ask : Side.Bid;
      
      // Calculate hedge size (partial reduction, not full close)
      const hedgeSize = Math.abs(position.size) * 0.3; // Hedge 30% of position

      logger.info('Executing hedge order', {
        marketId,
        currentSize: position.size,
        hedgeSide: hedgeSide === Side.Bid ? 'BID' : 'ASK',
        hedgeSize,
      });

      // Place market order to hedge
      const orderId = await user.placeOrder({
        marketId,
        side: hedgeSide,
        fillMode: FillMode.Market,
        isReduceOnly: true,
        size: hedgeSize,
      });

      logger.info('Hedge order placed', {
        orderId,
        marketId,
        size: hedgeSize,
      });
    } catch (error) {
      logger.error('Hedge execution failed', {
        marketId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Check if hedging conditions are met
   */
  shouldHedge(
    position: { size: number; entryPrice: number },
    midPrice: number,
    freeCollateral: number
  ): boolean {
    if (!CONFIG.autoHedge.enabled) {
      return false;
    }

    const positionValue = Math.abs(position.size * midPrice);
    const maxPosition = freeCollateral * CONFIG.risk.maxExposurePerMarket;
    const positionRatio = positionValue / maxPosition;

    return positionRatio > CONFIG.autoHedge.imbalanceThreshold;
  }
}