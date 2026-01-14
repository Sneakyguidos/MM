export type QuantityMode = 'fixed' | 'percentage' | 'tiered';

export interface SpreadConfig {
  min: number;
  max: number;
  depthLevels: number;
}

export interface RiskConfig {
  minMarginFraction: number;
  maxExposurePerSide: number;
  maxExposurePerMarket: number;
  maxTotalExposure: number;
  minFreeCollateral: number;
}

export interface AutoHedgeConfig {
  enabled: boolean;
  imbalanceThreshold: number;
}

export interface AssetConfig {
  bias: number; // Fixed bias: -0.0005 = -5bps (quote lower), +0.0005 = +5bps (quote higher)
}

export interface OracleConfig {
  enabled: boolean;
  sources: ('binance' | 'bybit' | 'coinbase')[];
  updateInterval: number;
  fallbackToOrderbook: boolean;
  cacheTimeout: number;
}

export interface ClusterConfig {
  enabled: boolean;
  processGroups: number[][];
  workerRestartDelay: number;
  maxRestarts: number;
}

export interface BotConfig {
  quantityMode: QuantityMode;
  fixedSize: number;
  percentPerLevel: number;
  tieredMultipliers: number[];
  spread: SpreadConfig;
  risk: RiskConfig;
  maxLevels: number;
  autoHedge: AutoHedgeConfig;
  requoteIntervalMs: number;
  inventorySkewEnabled: boolean;
  inventorySkewFactor: number;
  requoteThreshold: number;
  assets: Record<number, AssetConfig>;
  defaultBias: number;
  oracle: OracleConfig;
  cluster: ClusterConfig;
}

export const CONFIG: BotConfig = {
  // Quantity Modes
  quantityMode: 'tiered' as QuantityMode,
  fixedSize: 0.1,
  percentPerLevel: 0.01,
  tieredMultipliers: [0.5, 0.3, 0.2],
  
  // Spread Settings
  spread: {
    min: 0.0015,    // 0.15%
    max: 0.0125,    // 1.25%
    depthLevels: 5,
  },
  
  // Risk Limits
  risk: {
    minMarginFraction: 0.18,
    maxExposurePerSide: 0.25,
    maxExposurePerMarket: 0.30,
    maxTotalExposure: 0.60,
    minFreeCollateral: 100,
  },
  
  // Trading
  maxLevels: 3,
  
  // Auto-Hedge (optional)
  autoHedge: {
    enabled: false,
    imbalanceThreshold: 0.35,
  },

  // Timing
  requoteIntervalMs: 5000,

  // Inventory Management
  inventorySkewEnabled: true,
  inventorySkewFactor: 0.002,
  
  // NEW: Requote Threshold (from Blockworks)
  // Only requote if price changes by more than this threshold
  // Saves gas by avoiding unnecessary requotes
  requoteThreshold: 0.0002, // 2 bps = 0.02%
  
  // NEW: Per-Market Bias (from Blockworks)
  // Allows forcing bot to quote higher/lower on specific markets
  // Useful for aggressive inventory management
  assets: {
    // Example configurations:
    // 1: { bias: 0 },      // SOL-PERP - neutral
    // 2: { bias: -0.001 }, // BTC-PERP - bias 10bps lower (encourage selling if long)
    // 3: { bias: 0.0005 }, // ETH-PERP - bias 5bps higher (encourage buying if short)
  },
  defaultBias: 0, // Default bias for markets not specified in assets
  
  // NEW: CEX Price Oracle
  // Uses centralized exchange prices as reference
  // Critical for illiquid markets like 01.xyz
  oracle: {
    enabled: true,
    sources: ['binance', 'bybit'], // Will use median from multiple sources
    updateInterval: 5000, // Update every 5 seconds
    fallbackToOrderbook: true, // Fall back to local orderbook if CEX unavailable
    cacheTimeout: 10000, // Cache prices for 10 seconds max
  },
  
  // NEW: Multi-Process Clustering
  // Distribute markets across multiple processes for better performance
  // Each process handles a subset of markets
  cluster: {
    enabled: false, // Set to true for production with many markets
    processGroups: [
      // Example: distribute 12 markets across 3 workers
      // [1, 2, 3, 4],  // Worker 0: markets 1-4
      // [5, 6, 7, 8],  // Worker 1: markets 5-8
      // [9, 10, 11, 12], // Worker 2: markets 9-12
    ],
    workerRestartDelay: 5000, // Wait 5s before restarting failed worker
    maxRestarts: 5, // Max restarts per worker before giving up
  },
};

export const USDC_MINT_INDEX = 0;

export function validateConfig(config: BotConfig): void {
  if (config.spread.min >= config.spread.max) {
    throw new Error('spread.min must be less than spread.max');
  }
  
  if (config.risk.minMarginFraction <= 0 || config.risk.minMarginFraction >= 1) {
    throw new Error('risk.minMarginFraction must be between 0 and 1');
  }
  
  if (config.maxLevels < 1 || config.maxLevels > 10) {
    throw new Error('maxLevels must be between 1 and 10');
  }

  if (config.quantityMode === 'tiered' && config.tieredMultipliers.length < config.maxLevels) {
    throw new Error('tieredMultipliers length must match or exceed maxLevels');
  }

  const sumMultipliers = config.tieredMultipliers.reduce((a, b) => a + b, 0);
  if (Math.abs(sumMultipliers - 1.0) > 0.01) {
    throw new Error('tieredMultipliers must sum to approximately 1.0');
  }

  if (config.requoteThreshold < 0 || config.requoteThreshold > 0.01) {
    throw new Error('requoteThreshold must be between 0 and 0.01 (1%)');
  }

  if (config.oracle.enabled && config.oracle.sources.length === 0) {
    throw new Error('oracle.sources must contain at least one source');
  }

  if (config.cluster.enabled && config.cluster.processGroups.length === 0) {
    throw new Error('cluster.processGroups must contain at least one group');
  }
}