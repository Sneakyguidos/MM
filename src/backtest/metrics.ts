import { BacktestResult } from './engine';
import { logger } from '../logger';

export class MetricsCalculator {
  /**
   * Print formatted backtest results
   */
  static printResults(result: BacktestResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('BACKTEST RESULTS');
    console.log('='.repeat(60));
    
    console.log('\n📊 PERFORMANCE METRICS');
    console.log(`Total PnL:           $${result.totalPnl.toFixed(2)}`);
    console.log(`Start Balance:       $${result.startBalance.toFixed(2)}`);
    console.log(`End Balance:         $${result.endBalance.toFixed(2)}`);
    console.log(`Return:              ${((result.totalPnl / result.startBalance) * 100).toFixed(2)}%`);
    
    console.log('\n📈 TRADING METRICS');
    console.log(`Total Trades:        ${result.numTrades}`);
    console.log(`Winning Trades:      ${result.numWins}`);
    console.log(`Losing Trades:       ${result.numLosses}`);
    console.log(`Win Rate:            ${(result.winRate * 100).toFixed(2)}%`);
    console.log(`Fill Rate:           ${(result.fillRate * 100).toFixed(2)}%`);
    console.log(`Total Volume:        $${result.totalVolume.toFixed(2)}`);
    
    console.log('\n📉 RISK METRICS');
    console.log(`Sharpe Ratio:        ${result.sharpeRatio.toFixed(2)}`);
    console.log(`Max Drawdown:        ${(result.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`Avg Spread:          ${(result.avgSpread * 100).toFixed(3)}%`);
    
    console.log('\n' + '='.repeat(60) + '\n');
  }

  /**
   * Calculate additional risk metrics
   */
  static calculateRiskMetrics(equity: number[]): {
    maxDrawdown: number;
    avgDrawdown: number;
    drawdownDuration: number;
    calmarRatio: number;
  } {
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let drawdownStart = 0;
    let maxDrawdownDuration = 0;
    let totalDrawdown = 0;
    let drawdownCount = 0;
    let peak = equity[0];

    for (let i = 0; i < equity.length; i++) {
      if (equity[i] > peak) {
        // New peak - end of drawdown
        if (currentDrawdown > 0) {
          maxDrawdownDuration = Math.max(maxDrawdownDuration, i - drawdownStart);
          drawdownCount++;
          totalDrawdown += currentDrawdown;
          currentDrawdown = 0;
        }
        peak = equity[i];
      } else {
        // In drawdown
        if (currentDrawdown === 0) {
          drawdownStart = i;
        }
        currentDrawdown = (peak - equity[i]) / peak;
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
      }
    }

    const avgDrawdown = drawdownCount > 0 ? totalDrawdown / drawdownCount : 0;
    
    // Calmar Ratio = Annual Return / Max Drawdown
    const totalReturn = (equity[equity.length - 1] - equity[0]) / equity[0];
    const calmarRatio = maxDrawdown > 0 ? totalReturn / maxDrawdown : 0;

    return {
      maxDrawdown,
      avgDrawdown,
      drawdownDuration: maxDrawdownDuration,
      calmarRatio,
    };
  }

  /**
   * Calculate win/loss statistics
   */
  static calculateWinLossStats(trades: { pnl: number }[]): {
    avgWin: number;
    avgLoss: number;
    largestWin: number;
    largestLoss: number;
    profitFactor: number;
  } {
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);

    const avgWin = wins.length > 0
      ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length
      : 0;

    const avgLoss = losses.length > 0
      ? losses.reduce((sum, t) => sum + Math.abs(t.pnl), 0) / losses.length
      : 0;

    const largestWin = wins.length > 0
      ? Math.max(...wins.map(t => t.pnl))
      : 0;

    const largestLoss = losses.length > 0
      ? Math.min(...losses.map(t => t.pnl))
      : 0;

    const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

    return {
      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
      profitFactor,
    };
  }

  /**
   * Export results to JSON
   */
  static exportToJSON(result: BacktestResult, equity: number[], timestamps: number[]): string {
    const data = {
      summary: result,
      equity: equity.map((e, i) => ({
        timestamp: timestamps[i],
        equity: e,
      })),
      generatedAt: new Date().toISOString(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Export results to CSV
   */
  static exportToCSV(equity: number[], timestamps: number[]): string {
    let csv = 'timestamp,equity\n';
    
    for (let i = 0; i < equity.length; i++) {
      csv += `${timestamps[i]},${equity[i]}\n`;
    }

    return csv;
  }

  /**
   * Calculate expectancy (average profit per trade)
   */
  static calculateExpectancy(winRate: number, avgWin: number, avgLoss: number): number {
    return (winRate * avgWin) - ((1 - winRate) * avgLoss);
  }

  /**
   * Calculate Kelly Criterion (optimal position size)
   */
  static calculateKellyCriterion(winRate: number, winLossRatio: number): number {
    if (winLossRatio <= 0) return 0;
    return winRate - ((1 - winRate) / winLossRatio);
  }
}