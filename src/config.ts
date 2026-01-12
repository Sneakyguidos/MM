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
}