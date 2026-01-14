# Technical Notes - 01.xyz Market Maker Bot

## Architecture Overview

### Core Components

```
┌─────────────────────────────────────────────────┐
│              MarketMakerLive                    │
│  (Main orchestrator for live trading)           │
└─────────────────────────────────────────────────┘
          │
          ├─► RiskManager
          │   ├─ Margin checks
          │   ├─ Position limits
          │   ├─ Exposure monitoring
          │   └─ Emergency cancel
          │
          ├─► SpreadCalculator
          │   ├─ Dynamic spread
          │   ├─ Order book analysis
          │   ├─ Imbalance detection
          │   └─ Mid price calculation
          │
          ├─► SizingCalculator
          │   ├─ Fixed mode
          │   ├─ Percentage mode
          │   └─ Tiered mode
          │
          ├─► InventoryManager
          │   ├─ Position ratio
          │   ├─ Skew application
          │   └─ Hedge detection
          │
          └─► HedgingEngine
              └─ Auto-hedge execution
```

## Key Algorithms

### 1. Dynamic Spread Calculation

```typescript
spread = MIN_SPREAD + abs(imbalance) * (MAX_SPREAD - MIN_SPREAD)

where:
  imbalance = (bidDepth - askDepth) / (bidDepth + askDepth)
  bidDepth = sum of top N bid levels
  askDepth = sum of top N ask levels
```

**Purpose**: Widen spread when order book is imbalanced to avoid adverse selection.

### 2. Inventory Skew

```typescript
if (positionRatio > 0.05):
  // Long position → shift prices up (encourage selling)
  skewFactor = positionRatio * 0.002
  newPrice = basePrice * (1 + skewFactor)
  
else if (positionRatio < -0.05):
  // Short position → shift prices down (encourage buying)
  skewFactor = abs(positionRatio) * 0.002
  newPrice = basePrice * (1 - skewFactor)
```

**Purpose**: Automatically move quotes away from current position to reduce inventory risk.

### 3. Multi-Level Quoting

```typescript
for (level = 0; level < maxLevels; level++):
  spacing = spread * (level + 1) * 0.5
  
  bidPrice[level] = baseBidPrice * (1 - spacing)
  askPrice[level] = baseAskPrice * (1 + spacing)
  
  size[level] = calculateSize(level, mode)
```

**Purpose**: Provide liquidity at multiple price points, capturing more fills.

### 4. Risk Gates

Before placing any quote:

```typescript
1. Check margin fraction >= 18%
2. Check free collateral >= MIN_THRESHOLD
3. Check market exposure <= 30%
4. Check total exposure <= 60%
```

**Purpose**: Prevent over-leveraging and liquidation.

## Data Flow

### Order Placement Flow

```
WebSocket Update
    │
    ▼
Check Orderbook Health
    │
    ▼
Risk Check
    │
    ▼
Calculate Mid Price
    │
    ▼
Calculate Dynamic Spread
    │
    ▼
Apply Inventory Skew
    │
    ▼
Calculate Level Sizes
    │
    ▼
Generate Quote Levels
    │
    ▼
Cancel Old Orders
    │
    ▼
Place New Orders
    │
    ▼
Update State
```

### Backtest Flow

```
Load Historical Data
    │
    ▼
For Each Bar:
    │
    ├─► Check Fills (probabilistic)
    │
    ├─► Cancel Old Orders
    │
    ├─► Update Unrealized PnL
    │
    ├─► Place New Quotes
    │
    └─► Track Equity
    │
    ▼
Calculate Metrics
```

## Performance Considerations

### WebSocket Handling

- **Throttling**: Orders placed only on significant orderbook changes
- **Debouncing**: Minimum 100ms between requotes
- **Reconnection**: Automatic reconnection with exponential backoff

### Order Management

- **Batch Cancellation**: Cancel all orders for a market in one call
- **Level Validation**: Pre-validate all levels before placement
- **Error Recovery**: Retry failed orders up to 3 times

### Memory Usage

- **Order History**: Keep only last 1000 orders in memory
- **Equity Tracking**: Circular buffer for equity curve
- **Log Rotation**: Automatic log file rotation at 10MB

## Testing Strategy

### Unit Tests (Future)

```typescript
describe('SpreadCalculator', () => {
  it('should widen spread on imbalanced orderbook')
  it('should respect min/max bounds')
  it('should handle empty orderbook')
})

describe('RiskManager', () => {
  it('should block trading on low margin')
  it('should enforce position limits')
  it('should calculate exposure correctly')
})
```

### Integration Tests

```bash
# Test full flow with simulated data
npm run backtest -- --steps 1000

# Test illiquid market handling
npm run simulate -- --type illiquid --steps 10000

# Test connection to 01.xyz
npm run test:live
```

## Deployment Best Practices

### Production Checklist

- [ ] Use dedicated VPS/server
- [ ] Setup monitoring (Datadog, Prometheus)
- [ ] Configure log aggregation
- [ ] Setup alerts for:
  - Risk violations
  - Connection drops
  - PnL thresholds
  - Error rates
- [ ] Backup private keys securely
- [ ] Document recovery procedures
- [ ] Test failover scenarios

### Monitoring Metrics

Key metrics to track:

```typescript
{
  // Trading
  fillRate: number,
  avgSpread: number,
  dailyVolume: number,
  dailyPnL: number,
  
  // Risk
  currentExposure: number,
  marginFraction: number,
  largestPosition: number,
  
  // Operations
  uptime: number,
  websocketReconnects: number,
  orderFailureRate: number,
  avgLatency: number,
}
```

### Scaling Considerations

**Single Bot Instance**:
- Can handle ~50 markets
- 1-2 CPU cores
- 512MB RAM
- 100 Mbps network

**Multiple Instances**:
- Use separate wallets
- Deploy across regions
- Load balance via DNS
- Coordinate via Redis

## Security Considerations

### Private Key Management

```bash
# Store in environment variable (development)
export PRIVATE_KEY_BASE58="..."

# Use secrets manager (production)
aws secretsmanager get-secret-value --secret-id mm-bot-key

# Hardware wallet (advanced)
# Connect via USB and sign transactions
```

### Network Security

```typescript
// Whitelist RPC endpoints
const ALLOWED_RPC = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
];

// Use HTTPS only
const WS_URL = 'wss://trade.01.xyz'; // Not ws://

// Validate responses
if (!response.signature) {
  throw new Error('Invalid response');
}
```

### Rate Limiting

```typescript
// Implement rate limiting
const RATE_LIMIT = {
  ordersPerSecond: 10,
  cancelsPerSecond: 20,
  requestsPerMinute: 600,
};

// Track and throttle
if (ordersThisSecond > RATE_LIMIT.ordersPerSecond) {
  await sleep(1000);
}
```

## Optimization Opportunities

### Low-Hanging Fruit

1. **Caching**: Cache market data for 100ms
2. **Batch Operations**: Batch order placements
3. **Connection Pooling**: Reuse WebSocket connections
4. **Lazy Loading**: Load markets on-demand

### Advanced Optimizations

1. **Machine Learning**: Predict fill probabilities
2. **Order Flow Analysis**: Detect informed traders
3. **Cross-Market Correlation**: Hedge across markets
4. **Smart Order Routing**: Split orders across venues

## Troubleshooting Guide

### Common Issues

**Issue**: Orders not filling
```
Cause: Spreads too wide
Fix: Reduce spread.min in config.ts
```

**Issue**: Frequent risk violations
```
Cause: Position limits too tight
Fix: Increase risk.maxExposurePerMarket
```

**Issue**: High memory usage
```
Cause: Order history not cleared
Fix: Clear old orders periodically
```

**Issue**: WebSocket disconnects
```
Cause: Network instability
Fix: Implement exponential backoff retry
```

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm run start:live

# Trace WebSocket messages
LOG_LEVEL=trace npm run start:live

# Profile performance
node --prof dist/cli.js live
node --prof-process isolate-*.log > profile.txt
```

## Future Enhancements

### Planned Features

- [ ] Multi-venue support (Drift, Mango)
- [ ] Advanced hedging strategies
- [ ] ML-based spread optimization
- [ ] Grid trading mode
- [ ] Telegram notifications
- [ ] Web dashboard
- [ ] Performance attribution

### Research Areas

- Optimal quote placement
- Adverse selection detection
- Market impact modeling
- Dynamic sizing algorithms
- Cross-market arbitrage

## References

- [01.xyz Documentation](https://docs.01.xyz/)
- [Market Making Literature](https://arxiv.org/pdf/1105.3353.pdf)
- [Solana Program Library](https://spl.solana.com/)
- [Nord SDK Source](https://github.com/01protocol/nord-ts)

---

**Last Updated**: January 2026
**Version**: 1.0.0
**Author**: Market Maker Bot Team