\# 🚀 Quick Start Guide - 01.xyz Market Maker Bot



\## Step-by-Step Setup (5 minutes)



\### 1️⃣ Install Dependencies



```bash

npm install

```



\### 2️⃣ Setup Environment



Create your `.env` file:



```bash

cp .env.example .env

```



Edit `.env` and add your credentials:



```bash

PRIVATE\_KEY\_BASE58=your\_base58\_encoded\_private\_key\_here

RPC\_ENDPOINT=https://api.mainnet-beta.solana.com

WEB\_SERVER\_URL=wss://trade.01.xyz

LOG\_LEVEL=info

MODE=test

```



\### 3️⃣ Get Your Private Key in Base58



If you have a Solana wallet keypair:



```javascript

// Node.js script to convert

const bs58 = require('bs58');

const fs = require('fs');



// Load your keypair file

const keypairFile = fs.readFileSync('/path/to/your/keypair.json');

const keypair = JSON.parse(keypairFile.toString());



// Convert to Base58

const privateKeyBase58 = bs58.encode(Buffer.from(keypair));

console.log('PRIVATE\_KEY\_BASE58:', privateKeyBase58);

```



Or use Phantom/Solflare export function.



\### 4️⃣ Build the Project



```bash

npm run build

```



\### 5️⃣ Test Connection



```bash

npm run test:live

```



Expected output:

```

✓ Testing configuration...

✓ Configuration valid

✓ Testing environment variables...

✓ Environment variables present

✓ Testing Nord connection...

✓ Nord connection successful

&nbsp; Balance: 10000 USDC

&nbsp; Free Collateral: 10000 USDC

✓ Testing market data...

✓ Fetched 12 markets

&nbsp; - SOL-PERP (ID: 1)

&nbsp; - BTC-PERP (ID: 2)

&nbsp; ...

✅ All tests passed!

```



\## 📊 Run Your First Backtest



Test the strategy without risking capital:



```bash

npm run backtest -- --steps 1000

```



Expected output:

```

============================================================

BACKTEST RESULTS

============================================================



📊 PERFORMANCE METRICS

Total PnL:           $245.67

Start Balance:       $10000.00

End Balance:         $10245.67

Return:              2.46%



📈 TRADING METRICS

Total Trades:        156

Winning Trades:      89

Losing Trades:       67

Win Rate:            57.05%

Fill Rate:           78.00%

Total Volume:        $125,430.25



📉 RISK METRICS

Sharpe Ratio:        1.42

Max Drawdown:        3.45%

Avg Spread:          0.325%

============================================================

```



\## 🧪 Simulate Illiquid Markets



Test how the bot handles low liquidity:



```bash

npm run simulate -- --steps 10000 --type illiquid

```



This generates:

\- Wide spreads (up to 5%)

\- Low orderbook depth

\- High volatility

\- Stress tests inventory accumulation



\## 🎯 Start Paper Trading



Safe testing without real money:



```bash

npm run start:live -- --test

```



The bot will:

\- Connect to 01.xyz

\- Subscribe to all markets

\- Place quotes based on real orderbooks

\- Track paper PnL

\- Log all actions



Monitor logs:

```bash

tail -f logs/combined.log

```



\## 💰 Go Live (Use Caution!)



When ready for real trading:



1\. \*\*Start Small\*\*: Reduce sizes in `src/config.ts`

```typescript

fixedSize: 0.01,  // Very small size

tieredMultipliers: \[0.01, 0.005, 0.005],  // Conservative

```



2\. \*\*Test on One Market\*\*:

```bash

npm run start:live -- --market 1

```



3\. \*\*Monitor Closely\*\*: Watch logs in real-time

```bash

tail -f logs/combined.log

```



4\. \*\*Stop Anytime\*\*: Press `Ctrl+C` for graceful shutdown



\## 🐳 Docker Deployment



For production deployment:



```bash

\# Build and start

docker-compose up -d



\# View logs

docker-compose logs -f



\# Stop

docker-compose down

```



\## ⚙️ Key Configuration Options



Edit `src/config.ts`:



```typescript

// Conservative settings (recommended for start)

quantityMode: 'fixed',

fixedSize: 0.01,  // Small size



spread: {

&nbsp; min: 0.003,  // 0.3% min spread

&nbsp; max: 0.02,   // 2% max spread

},



risk: {

&nbsp; minMarginFraction: 0.20,  // Stop at 20% margin

&nbsp; maxExposurePerMarket: 0.20,  // Only 20% per market

&nbsp; maxTotalExposure: 0.40,  // Only 40% total

&nbsp; minFreeCollateral: 500,  // Keep $500 free

},



maxLevels: 2,  // Only 2 levels



autoHedge: {

&nbsp; enabled: true,  // Enable auto-hedge

&nbsp; imbalanceThreshold: 0.25,  // Hedge at 25%

},

```



\## 📈 Monitor Performance



\### View Status

The bot logs key metrics every minute:

\- Current positions

\- Active orders

\- Free collateral

\- PnL



\### Check Logs

```bash

\# All logs

tail -f logs/combined.log



\# Errors only

tail -f logs/error.log



\# Filter specific market

grep "marketId: 1" logs/combined.log

```



\## 🛑 Emergency Stop



\### Manual Stop

Press `Ctrl+C` - the bot will:

1\. Cancel all orders

2\. Close connections

3\. Save final state



\### Docker Stop

```bash

docker-compose down

```



\### Force Kill (if needed)

```bash

\# Find process

ps aux | grep "start:live"



\# Kill it

kill -9 <PID>

```



\## ✅ Success Checklist



Before going live, ensure:



\- \[ ] Backtest shows positive results

\- \[ ] Simulation handles illiquid markets well

\- \[ ] Paper trading works for 24+ hours

\- \[ ] Config is conservative (small sizes)

\- \[ ] Risk limits are appropriate

\- \[ ] You understand all parameters

\- \[ ] You can monitor 24/7 initially

\- \[ ] Emergency stop process is clear

\- \[ ] Wallet has sufficient USDC

\- \[ ] RPC endpoint is reliable



\## 🎓 Next Steps



1\. \*\*Read Full README\*\*: `README.md`

2\. \*\*Understand Config\*\*: `src/config.ts`

3\. \*\*Review Risk Manager\*\*: `src/core/risk.ts`

4\. \*\*Check Strategy\*\*: `src/live/mmLive.ts`

5\. \*\*Monitor \& Optimize\*\*: Adjust based on performance



\## ⚠️ Common Mistakes to Avoid



❌ \*\*DON'T\*\*:

\- Start with large sizes

\- Trade all markets immediately

\- Ignore risk violations

\- Run without monitoring

\- Commit `.env` to git

\- Use mainnet funds for testing



✅ \*\*DO\*\*:

\- Start small and scale up

\- Test one market first

\- Watch logs closely

\- Have stop-loss plans

\- Keep backups of configs

\- Use devnet for learning



\## 🆘 Troubleshooting



\### "Connection failed"

```bash

\# Check RPC endpoint

curl -X POST https://api.mainnet-beta.solana.com \\

&nbsp; -H "Content-Type: application/json" \\

&nbsp; -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

```



\### "Risk violation"

\- Check free collateral

\- Review open positions

\- Adjust risk limits in config

\- Reduce order sizes



\### "Orders not filling"

\- Spreads may be too wide

\- Check orderbook depth

\- Reduce spread range

\- Increase levels



\## 📞 Support Resources



\- \*\*Logs\*\*: Check `logs/` directory first

\- \*\*Config\*\*: Review `src/config.ts` 

\- \*\*Docs\*\*: Read full `README.md`

\- \*\*01.xyz\*\*: https://docs.01.xyz/



---



\*\*You're ready! Start with paper trading and scale up gradually. Good luck! 🚀\*\*

