\# 01.xyz Market Maker Bot



Professional market making bot for 01.xyz perpetual markets on Solana.



\## 🎯 Features



\### Core Trading

\- \*\*Multi-Market Support\*\*: Trade all available perpetual markets simultaneously

\- \*\*Dynamic Spread Engine\*\*: Adjusts spreads (0.15% - 1.25%) based on order book depth and imbalance

\- \*\*Multi-Level Quoting\*\*: Places 3 levels of bids/asks by default

\- \*\*Inventory Skew Protection\*\*: Automatically adjusts quotes to reduce one-sided exposure

\- \*\*Real-time WebSocket Updates\*\*: Instant requoting on market changes



\### Sizing Modes

\- \*\*Fixed\*\*: Same size for all levels

\- \*\*Percentage\*\*: Each level uses a % of free collateral

\- \*\*Tiered\*\*: Larger sizes closer to mid price (recommended)



\### Risk Management

\- \*\*Margin Protection\*\*: Stops trading if margin fraction < 18%

\- \*\*Per-Market Limits\*\*: Max 30% exposure per market

\- \*\*Global Exposure Cap\*\*: Max 60% total capital exposure

\- \*\*Emergency Cancel\*\*: Instant order cancellation on risk breach

\- \*\*Real-time Monitoring\*\*: Continuous balance and position tracking



\### Advanced Features

\- \*\*Auto-Hedging\*\*: Optional automatic position rebalancing

\- \*\*Backtest Engine\*\*: Test strategies on historical data

\- \*\*Market Simulator\*\*: Generate synthetic illiquid market scenarios

\- \*\*Performance Metrics\*\*: Sharpe ratio, max drawdown, win rate, fill rate



\## 📋 Requirements



\- Node.js >= 18.0.0

\- npm >= 9.0.0

\- Docker (optional, for containerized deployment)

\- Solana wallet with USDC



\## 🚀 Quick Start



\### 1. Clone and Install



```bash

git clone <your-repo>

cd mm-bot

npm install

```



\### 2. Configure Environment



```bash

cp .env.example .env

\# Edit .env with your credentials

```



\*\*Required variables:\*\*

```bash

PRIVATE\_KEY\_BASE58=your\_base58\_private\_key

RPC\_ENDPOINT=https://api.mainnet-beta.solana.com

WEB\_SERVER\_URL=wss://trade.01.xyz

```



\### 3. Test Connection



```bash

npm run test:live

```



\### 4. Run Backtest



```bash

npm run backtest -- --steps 1000

```



\### 5. Start Live Trading



```bash

\# Paper trading mode

npm run start:live -- --test



\# Live trading (all markets)

npm run start:live



\# Single market

npm run start:live -- --market 1

```



\## 🐳 Docker Deployment



\### Build and Run



```bash

docker-compose up -d

```



\### View Logs



```bash

docker-compose logs -f

```



\### Stop Bot



```bash

docker-compose down

```



\## 📊 CLI Commands



\### Live Trading

```bash

\# Start market making on all markets

npm run start:live



\# Trade specific market

npm run start:live -- --market SOL-PERP



\# Paper trading mode

npm run start:live -- --test

```



\### Backtesting

```bash

\# Backtest with synthetic data

npm run backtest -- --steps 5000



\# Backtest with historical data

npm run backtest -- --data ./data/history.json



\# Export results

npm run backtest -- --data ./data/history.json --output results.json

```



\### Simulation

```bash

\# Simulate illiquid market

npm run simulate -- --steps 10000 --type illiquid



\# Simulate trending market

npm run simulate -- --steps 10000 --type trending



\# Simulate ranging market

npm run simulate -- --steps 10000 --type ranging



\# Export simulation data

npm run simulate -- --steps 10000 --output sim-data.json

```



\### Testing

```bash

\# Run connection and config tests

npm run test:live

```



\## ⚙️ Configuration



Edit `src/config.ts` to customize:



```typescript

export const CONFIG = {

&nbsp; // Sizing mode: 'fixed' | 'percentage' | 'tiered'

&nbsp; quantityMode: 'tiered',

&nbsp; 

&nbsp; // Spread range

&nbsp; spread: {

&nbsp;   min: 0.0015,    // 0.15%

&nbsp;   max: 0.0125,    // 1.25%

&nbsp;   depthLevels: 5,

&nbsp; },

&nbsp; 

&nbsp; // Risk limits

&nbsp; risk: {

&nbsp;   minMarginFraction: 0.18,

&nbsp;   maxExposurePerSide: 0.25,

&nbsp;   maxExposurePerMarket: 0.30,

&nbsp;   maxTotalExposure: 0.60,

&nbsp;   minFreeCollateral: 100,

&nbsp; },

&nbsp; 

&nbsp; // Trading

&nbsp; maxLevels: 3,

&nbsp; 

&nbsp; // Auto-hedge (optional)

&nbsp; autoHedge: {

&nbsp;   enabled: false,

&nbsp;   imbalanceThreshold: 0.35,

&nbsp; },

};

```



\## 🛡️ Safety Features



\### Liquidation Prevention

\- Immediate stop if margin fraction < 18%

\- Emergency cancel all orders

\- Real-time margin monitoring



\### Position Limits

\- Max 30% free collateral per market

\- Max 60% total exposure

\- 3 levels max per side



\### Inventory Protection

\- Quotes shift away from current position

\- Prevents one-sided accumulation

\- Reduces liquidation risk in illiquid markets



\## 📈 Performance Metrics



The backtest engine calculates:



\- \*\*PnL\*\*: Total profit/loss

\- \*\*Win Rate\*\*: % of profitable trades

\- \*\*Fill Rate\*\*: % of orders filled

\- \*\*Sharpe Ratio\*\*: Risk-adjusted returns

\- \*\*Max Drawdown\*\*: Largest equity decline

\- \*\*Volume\*\*: Total trading volume



\## 🔧 Project Structure



```

mm-bot/

├── src/

│   ├── core/

│   │   ├── risk.ts          # Risk management

│   │   ├── sizing.ts        # Order sizing (3 modes)

│   │   ├── spread.ts        # Dynamic spread calculation

│   │   ├── inventory.ts     # Inventory skew logic

│   │   └── hedging.ts       # Auto-hedge engine

│   ├── live/

│   │   └── mmLive.ts        # Live trading engine

│   ├── backtest/

│   │   ├── engine.ts        # Backtest runner

│   │   ├── simulator.ts     # Market simulator

│   │   └── metrics.ts       # Performance metrics

│   ├── config.ts            # Configuration

│   ├── logger.ts            # Logging utility

│   └── cli.ts               # CLI interface

├── types/

│   └── nord-ts.d.ts         # Type declarations

├── Dockerfile

├── docker-compose.yml

└── package.json

```



\## ⚠️ Important Notes



\### Security

\- \*\*NEVER\*\* commit `.env` to git

\- Store private keys securely

\- Use separate wallets for testing



\### 01.xyz Specifics

\- Always use `bs58.encode()` for private key conversion

\- Always call `updateAccountId()` after `fromPrivateKey()`

\- Use `Side.Bid`/`Side.Ask` (not strings)

\- Use `FillMode.Limit`/`FillMode.Market` (not strings)



\### Trading Considerations

\- 01.xyz markets are often illiquid

\- Start with small sizes

\- Test on DEVNET first

\- Monitor closely initially

\- Inventory skew is CRITICAL for illiquid markets



\## 🐛 Troubleshooting



\### Connection Issues

```bash

\# Test connection

npm run test:live



\# Check logs

tail -f logs/combined.log

```



\### Order Failures

\- Check margin requirements

\- Verify tick size compliance

\- Ensure minimum size met

\- Check free collateral



\### Risk Violations

\- Review `logs/error.log`

\- Adjust risk parameters in `config.ts`

\- Reduce position sizes

\- Increase `minFreeCollateral`



\## 📚 Resources



\- \[01.xyz Documentation](https://docs.01.xyz/)

\- \[Trading Examples](https://docs.01.xyz/examples/trading)

\- \[API Reference](https://docs.01.xyz/reference/nord-user)

\- \[Original Bot](https://github.com/Sneakyguidos/01xyz-bot2-trader)



\## 🤝 Support



For issues or questions:

1\. Check logs in `logs/` directory

2\. Review configuration in `src/config.ts`

3\. Run `npm run test:live` to diagnose

4\. Check 01.xyz documentation



\## ⚖️ License



MIT License - use at your own risk



\## ⚠️ Disclaimer



This software is provided for educational purposes. Trading cryptocurrency perpetuals involves substantial risk. You may lose your entire investment. Always test on devnet first and trade with caution.



---



\*\*Built with:\*\*

\- TypeScript

\- @n1xyz/nord-ts SDK

\- Solana Web3.js

\- Docker



\*\*Ready for production deployment on 01.xyz perpetual markets.\*\*

