\# Command Reference - 01.xyz Market Maker Bot



Quick reference for all available commands.



\## 🚀 Setup Commands



```bash

\# Initial setup

bash scripts/setup.sh



\# Install dependencies

npm install



\# Build project

npm run build



\# Clean build artifacts

npm run clean



\# Type check without compiling

npm run typecheck

```



\## 🧪 Testing Commands



```bash

\# Test connection and configuration

npm run test:live



\# Run backtest with synthetic data (1000 bars)

npm run backtest -- --steps 1000



\# Run backtest with custom steps

npm run backtest -- --steps 5000



\# Run backtest with historical data file

npm run backtest -- --data ./data/history.json



\# Run backtest and export results

npm run backtest -- --data ./data/history.json --output results.json



\# Run backtest with CSV data

npm run backtest -- --data ./data/history.csv

```



\## 📊 Simulation Commands



```bash

\# Simulate illiquid market (default)

npm run simulate -- --steps 10000



\# Simulate illiquid market with export

npm run simulate -- --steps 10000 --output sim-data.json



\# Simulate trending market (uptrend)

npm run simulate -- --steps 10000 --type trending



\# Simulate ranging market (sideways)

npm run simulate -- --steps 10000 --type ranging



\# Simulate with custom steps

npm run simulate -- --steps 50000 --type illiquid

```



\## 💰 Live Trading Commands



```bash

\# Start live trading (all markets)

npm run start:live



\# Start with paper trading mode (TEST MODE)

npm run start:live -- --test



\# Trade specific market by ID

npm run start:live -- --market 1



\# Trade specific market by ID in test mode

npm run start:live -- --test --market 1



\# Development mode (auto-restart on changes)

npm run dev

```



\## 🐳 Docker Commands



```bash

\# Build Docker image

docker-compose build



\# Start bot in background

docker-compose up -d



\# Start bot in foreground (see logs)

docker-compose up



\# View logs

docker-compose logs



\# Follow logs in real-time

docker-compose logs -f



\# View logs for last 100 lines

docker-compose logs --tail=100



\# Stop bot

docker-compose down



\# Stop and remove volumes

docker-compose down -v



\# Restart bot

docker-compose restart



\# View bot status

docker-compose ps



\# Execute command in running container

docker-compose exec mm-bot sh



\# View bot resource usage

docker stats 01xyz-market-maker

```



\## 📝 Log Commands



```bash

\# View all logs

tail -f logs/combined.log



\# View error logs only

tail -f logs/error.log



\# View last 100 lines

tail -n 100 logs/combined.log



\# Search logs for specific market

grep "marketId: 1" logs/combined.log



\# Search for risk violations

grep "Risk violation" logs/combined.log



\# Search for order placements

grep "Order placed" logs/combined.log



\# Count total trades

grep -c "Order filled" logs/combined.log



\# View logs by date

grep "2024-01-15" logs/combined.log

```



\## 🔍 Monitoring Commands



```bash

\# Check if bot is running

ps aux | grep "start:live"



\# Monitor CPU and memory usage

top -p $(pgrep -f "start:live")



\# Check network connections

netstat -an | grep 01.xyz



\# Monitor log file size

ls -lh logs/



\# Count errors in last hour

grep "ERROR" logs/combined.log | grep "$(date +%Y-%m-%d)" | wc -l



\# Check disk space

df -h

```



\## 🛠️ Maintenance Commands



```bash

\# Update dependencies

npm update



\# Check for outdated packages

npm outdated



\# Audit security vulnerabilities

npm audit



\# Fix security issues automatically

npm audit fix



\# Clear npm cache

npm cache clean --force



\# Reinstall all dependencies

rm -rf node\_modules package-lock.json \&\& npm install



\# Rotate logs manually

mv logs/combined.log logs/combined.log.$(date +%Y%m%d)

touch logs/combined.log

```



\## 📦 Data Management Commands



```bash

\# Create backup of configuration

cp src/config.ts src/config.backup.ts



\# Export backtest results

npm run backtest -- --data ./data/history.json --output results.json



\# Compress logs

tar -czf logs-$(date +%Y%m%d).tar.gz logs/



\# Clear old logs (older than 7 days)

find logs/ -name "\*.log" -mtime +7 -delete



\# Backup data directory

tar -czf data-backup-$(date +%Y%m%d).tar.gz data/

```



\## 🔒 Security Commands



```bash

\# Check file permissions

ls -la .env



\# Secure .env file (read-only for owner)

chmod 600 .env



\# Verify private key format

node -e "const bs58 = require('bs58'); console.log(bs58.decode(process.env.PRIVATE\_KEY\_BASE58));"



\# Test RPC endpoint

curl -X POST https://api.mainnet-beta.solana.com \\

&nbsp; -H "Content-Type: application/json" \\

&nbsp; -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'



\# Check WebSocket connection

wscat -c wss://trade.01.xyz

```



\## 🎯 Quick Actions



\### Emergency Stop

```bash

\# Graceful stop (recommended)

Ctrl+C in terminal



\# Force stop

pkill -9 -f "start:live"



\# Docker force stop

docker-compose kill

```



\### Quick Health Check

```bash

\# One-liner health check

echo "Bot Status:" \&\& ps aux | grep "start:live" \&\& \\

echo "Logs:" \&\& tail -n 5 logs/combined.log \&\& \\

echo "Disk:" \&\& df -h | grep "/$"

```



\### Quick Restart

```bash

\# Stop, rebuild, and start

npm run clean \&\& npm run build \&\& npm run start:live

```



\### View Performance Summary

```bash

\# Extract PnL from logs

grep "totalPnl" logs/combined.log | tail -10



\# Count successful trades

grep "Order filled" logs/combined.log | wc -l



\# Calculate fill rate

echo "scale=2; $(grep -c "Order filled" logs/combined.log) / $(grep -c "Order placed" logs/combined.log) \* 100" | bc

```



\## 🔄 Git Commands (if using version control)



```bash

\# Initialize git

git init



\# Add files (excluding .env)

git add .



\# Commit changes

git commit -m "Initial commit"



\# Create remote repository and push

git remote add origin <your-repo-url>

git push -u origin main



\# Pull latest changes

git pull



\# View commit history

git log --oneline



\# Restore file from last commit

git checkout -- src/config.ts

```



\## 📊 Analysis Commands



```bash

\# Calculate average spread from logs

grep "Spread calculated" logs/combined.log | \\

&nbsp; awk '{print $NF}' | \\

&nbsp; awk '{sum+=$1; n++} END {print sum/n}'



\# Find most active market

grep "marketId" logs/combined.log | \\

&nbsp; awk '{print $NF}' | \\

&nbsp; sort | uniq -c | sort -rn | head -1



\# Analyze trading hours

grep "Order placed" logs/combined.log | \\

&nbsp; awk '{print $2}' | \\

&nbsp; cut -d':' -f1 | \\

&nbsp; sort | uniq -c



\# Calculate daily PnL trend

grep "totalPnl" logs/combined.log | \\

&nbsp; awk '{print $1, $NF}' | \\

&nbsp; tail -7

```



\## 🆘 Troubleshooting Commands



```bash

\# Check if port is in use

lsof -i :3000



\# Test network connectivity

ping -c 4 trade.01.xyz



\# Check system resources

free -h \&\& df -h



\# View system logs

journalctl -xe



\# Check Node.js process details

node -v \&\& npm -v \&\& which node



\# Validate JSON files

cat data/history.json | jq .



\# Test TypeScript compilation

npx tsc --noEmit

```



\## 📱 Notification Setup (Advanced)



```bash

\# Send Telegram notification on error

grep "ERROR" logs/combined.log | tail -1 | \\

&nbsp; xargs -I {} curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \\

&nbsp; -d "chat\_id=<CHAT\_ID>\&text={}"



\# Email on critical error

grep "CRITICAL" logs/combined.log | tail -1 | \\

&nbsp; mail -s "Market Maker Alert" your@email.com



\# Slack notification

curl -X POST -H 'Content-type: application/json' \\

&nbsp; --data '{"text":"Bot Status: Running"}' \\

&nbsp; <SLACK\_WEBHOOK\_URL>

```



---



\## 💡 Pro Tips



1\. \*\*Always use `--test` flag first\*\* when trying new configurations

2\. \*\*Monitor logs actively\*\* for the first 24 hours of live trading

3\. \*\*Create cron jobs\*\* for automated health checks and log rotation

4\. \*\*Keep backups\*\* of working configurations

5\. \*\*Document changes\*\* to config.ts with comments and git commits



\## 🔗 Quick Links



\- Full Documentation: `README.md`

\- Quick Start: `QUICKSTART.md`

\- Technical Details: `TECHNICAL-NOTES.md`

\- Configuration: `src/config.ts`

\- Risk Management: `src/core/risk.ts`



---



\*\*Remember\*\*: Test thoroughly before deploying with real capital! 🚀

