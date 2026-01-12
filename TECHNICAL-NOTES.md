\# Technical Notes - 01.xyz Market Maker Bot



\## Architecture Overview



\### Core Components



```

┌─────────────────────────────────────────────────┐

│              MarketMakerLive                    │

│  (Main orchestrator for live trading)           │

└─────────────────────────────────────────────────┘

&nbsp;         │

&nbsp;         ├─► RiskManager

&nbsp;         │   ├─ Margin checks

&nbsp;         │   ├─ Position limits

&nbsp;         │   ├─ Exposure monitoring

&nbsp;         │   └─ Emergency cancel

&nbsp;         │

&nbsp;         ├─► SpreadCalculator

&nbsp;         │   ├─ Dynamic spread

&nbsp;         │   ├─ Order book analysis

&nbsp;         │   ├─ Imbalance detection

&nbsp;         │   └─ Mid price calculation

&nbsp;         │

&nbsp;         ├─► SizingCalculator

&nbsp;         │   ├─ Fixed mode

&nbsp;         │   ├─ Percentage mode

&nbsp;         │   └─ Tiered mode

&nbsp;         │

&nbsp;         ├─► InventoryManager

&nbsp;         │   ├─ Position ratio

&nbsp;         │   ├─ Skew application

&nbsp;         │   └─ Hedge detection

&nbsp;         │

&nbsp;         └─► HedgingEngine

&nbsp;             └─ Auto-hedge execution

```



\## Key Algorithms



\### 1. Dynamic Spread Calculation



```typescript

spread = MIN\_SPREAD + abs(imbalance) \* (MAX\_SPREAD - MIN\_SPREAD)



where:

&nbsp; imbalance = (bidDepth - askDepth) / (bidDepth + askDepth)

&nbsp; bidDepth = sum of top N bid levels

&nbsp; askDepth = sum of top N ask levels

```



\*\*Purpose\*\*: Widen spread when order book is imbalanced to avoid adverse selection.



\### 2. Inventory Skew



```typescript

if (positionRatio > 0.05):

&nbsp; // Long position → shift prices up (encourage selling)

&nbsp; skewFactor = positionRatio \* 0.002

&nbsp; newPrice = basePrice \* (1 + skewFactor)

&nbsp; 

else if (positionRatio < -0.05):

&nbsp; // Short position → shift prices down (encourage buying)

&nbsp; skewFactor = abs(positionRatio) \* 0.002

&nbsp; newPrice = basePrice \* (1 - skewFactor)

```



\*\*Purpose\*\*: Automatically move quotes away from current position to reduce inventory risk.



\### 3. Multi-Level Quoting



```typescript

for (level = 0; level < maxLevels; level++):

&nbsp; spacing = spread \* (level + 1) \* 0.5

&nbsp; 

&nbsp; bidPrice\[level] = baseBidPrice \* (1 - spacing)

&nbsp; askPrice\[level] = baseAskPrice \* (1 + spacing)

&nbsp; 

&nbsp; size\[level] = calculateSize(level, mode)

```



\*\*Purpose\*\*: Provide liquidity at multiple price points, capturing more fills.



\### 4. Risk Gates



Before placing any quote:



```typescript

1\. Check margin fraction >= 18%

2\. Check free collateral >= MIN\_THRESHOLD

3\. Check market exposure <= 30%

4\. Check total exposure <= 60%

```



\*\*Purpose\*\*: Prevent over-leveraging and liquidation.



\## Data Flow



\### Order Placement Flow



```

WebSocket Update

&nbsp;   │

&nbsp;   ▼

Check Orderbook Health

&nbsp;   │

&nbsp;   ▼

Risk Check

&nbsp;   │

&nbsp;   ▼

Calculate Mid Price

&nbsp;   │

&nbsp;   ▼

Calculate Dynamic Spread

&nbsp;   │

&nbsp;   ▼

Apply Inventory Skew

&nbsp;   │

&nbsp;   ▼

Calculate Level Sizes

&nbsp;   │

&nbsp;   ▼

Generate Quote Levels

&nbsp;   │

&nbsp;   ▼

Cancel Old Orders

&nbsp;   │

&nbsp;   ▼

Place New Orders

&nbsp;   │

&nbsp;   ▼

Update State

```



\### Backtest Flow



```

Load Historical Data

&nbsp;   │

&nbsp;   ▼

For Each Bar:

&nbsp;   │

&nbsp;   ├─► Check Fills (probabilistic)

&nbsp;   │

&nbsp;   ├─► Cancel Old Orders

&nbsp;   │

&nbsp;   ├─► Update Unrealized PnL

&nbsp;   │

&nbsp;   ├─► Place New Quotes

&nbsp;   │

&nbsp;   └─► Track Equity

&nbsp;   │

&nbsp;   ▼

Calculate Metrics

```



\## Performance Considerations



\### WebSocket Handling



\- \*\*Throttling\*\*: Orders placed only on significant orderbook changes

\- \*\*Debouncing\*\*: Minimum 100ms between requotes

\- \*\*Reconnection\*\*: Automatic reconnection with exponential backoff



\### Order Management



\- \*\*Batch Cancellation\*\*: Cancel all orders for a market in one call

\- \*\*Level Validation\*\*: Pre-validate all levels before placement

\- \*\*Error Recovery\*\*: Retry failed orders up to 3 times



\### Memory Usage



\- \*\*Order History\*\*: Keep only last 1000 orders in memory

\- \*\*Equity Tracking\*\*: Circular buffer for equity curve

\- \*\*Log Rotation\*\*: Automatic log file rotation at 10MB



\## Testing Strategy



\### Unit Tests (Future)



```typescript

describe('SpreadCalculator', () => {

&nbsp; it('should widen spread on imbalanced orderbook')

&nbsp; it('should respect min/max bounds')

&nbsp; it('should handle empty orderbook')

})



describe('RiskManager', () => {

&nbsp; it('should block trading on low margin')

&nbsp; it('should enforce position limits')

&nbsp; it('should calculate exposure correctly')

})

```



\### Integration Tests



```bash

\# Test full flow with simulated data

npm run backtest -- --steps 1000



\# Test illiquid market handling

npm run simulate -- --type illiquid --steps 10000



\# Test connection to 01.xyz

npm run test:live

```



\## Deployment Best Practices



\### Production Checklist



\- \[ ] Use dedicated VPS/server

\- \[ ] Setup monitoring (Datadog, Prometheus)

\- \[ ] Configure log aggregation

\- \[ ] Setup alerts for:

&nbsp; - Risk violations

&nbsp; - Connection drops

&nbsp; - PnL thresholds

&nbsp; - Error rates

\- \[ ] Backup private keys securely

\- \[ ] Document recovery procedures

\- \[ ] Test failover scenarios



\### Monitoring Metrics



Key metrics to track:



```typescript

{

&nbsp; // Trading

&nbsp; fillRate: number,

&nbsp; avgSpread: number,

&nbsp; dailyVolume: number,

&nbsp; dailyPnL: number,

&nbsp; 

&nbsp; // Risk

&nbsp; currentExposure: number,

&nbsp; marginFraction: number,

&nbsp; largestPosition: number,

&nbsp; 

&nbsp; // Operations

&nbsp; uptime: number,

&nbsp; websocketReconnects: number,

&nbsp; orderFailureRate: number,

&nbsp; avgLatency: number,

}

```



\### Scaling Considerations



\*\*Single Bot Instance\*\*:

\- Can handle ~50 markets

\- 1-2 CPU cores

\- 512MB RAM

\- 100 Mbps network



\*\*Multiple Instances\*\*:

\- Use separate wallets

\- Deploy across regions

\- Load balance via DNS

\- Coordinate via Redis



\## Security Considerations



\### Private Key Management



```bash

\# Store in environment variable (development)

export PRIVATE\_KEY\_BASE58="..."



\# Use secrets manager (production)

aws secretsmanager get-secret-value --secret-id mm-bot-key



\# Hardware wallet (advanced)

\# Connect via USB and sign transactions

```



\### Network Security



```typescript

// Whitelist RPC endpoints

const ALLOWED\_RPC = \[

&nbsp; 'https://api.mainnet-beta.solana.com',

&nbsp; 'https://solana-api.projectserum.com',

];



// Use HTTPS only

const WS\_URL = 'wss://trade.01.xyz'; // Not ws://



// Validate responses

if (!response.signature) {

&nbsp; throw new Error('Invalid response');

}

```



\### Rate Limiting



```typescript

// Implement rate limiting

const RATE\_LIMIT = {

&nbsp; ordersPerSecond: 10,

&nbsp; cancelsPerSecond: 20,

&nbsp; requestsPerMinute: 600,

};



// Track and throttle

if (ordersThisSecond > RATE\_LIMIT.ordersPerSecond) {

&nbsp; await sleep(1000);

}

```



\## Optimization Opportunities



\### Low-Hanging Fruit



1\. \*\*Caching\*\*: Cache market data for 100ms

2\. \*\*Batch Operations\*\*: Batch order placements

3\. \*\*Connection Pooling\*\*: Reuse WebSocket connections

4\. \*\*Lazy Loading\*\*: Load markets on-demand



\### Advanced Optimizations



1\. \*\*Machine Learning\*\*: Predict fill probabilities

2\. \*\*Order Flow Analysis\*\*: Detect informed traders

3\. \*\*Cross-Market Correlation\*\*: Hedge across markets

4\. \*\*Smart Order Routing\*\*: Split orders across venues



\## Troubleshooting Guide



\### Common Issues



\*\*Issue\*\*: Orders not filling

```

Cause: Spreads too wide

Fix: Reduce spread.min in config.ts

```



\*\*Issue\*\*: Frequent risk violations

```

Cause: Position limits too tight

Fix: Increase risk.maxExposurePerMarket

```



\*\*Issue\*\*: High memory usage

```

Cause: Order history not cleared

Fix: Clear old orders periodically

```



\*\*Issue\*\*: WebSocket disconnects

```

Cause: Network instability

Fix: Implement exponential backoff retry

```



\### Debug Mode



```bash

\# Enable debug logging

LOG\_LEVEL=debug npm run start:live



\# Trace WebSocket messages

LOG\_LEVEL=trace npm run start:live



\# Profile performance

node --prof dist/cli.js live

node --prof-process isolate-\*.log > profile.txt

```



\## Future Enhancements



\### Planned Features



\- \[ ] Multi-venue support (Drift, Mango)

\- \[ ] Advanced hedging strategies

\- \[ ] ML-based spread optimization

\- \[ ] Grid trading mode

\- \[ ] Telegram notifications

\- \[ ] Web dashboard

\- \[ ] Performance attribution



\### Research Areas



\- Optimal quote placement

\- Adverse selection detection

\- Market impact modeling

\- Dynamic sizing algorithms

\- Cross-market arbitrage



\## References



\- \[01.xyz Documentation](https://docs.01.xyz/)

\- \[Market Making Literature](https://arxiv.org/pdf/1105.3353.pdf)

\- \[Solana Program Library](https://spl.solana.com/)

\- \[Nord SDK Source](https://github.com/01protocol/nord-ts)



---



\*\*Last Updated\*\*: January 2026

\*\*Version\*\*: 1.0.0

\*\*Author\*\*: Market Maker Bot Team

