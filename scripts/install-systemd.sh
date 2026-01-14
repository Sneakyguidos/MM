#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "================================================"
echo "  01.xyz Market Maker Bot - Systemd Installer"
echo "================================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo -e "${RED}❌ Please run as root or with sudo${NC}"
   exit 1
fi

# Get current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Project directory: ${PROJECT_DIR}"
echo ""

# Ask for username
read -p "Enter the user to run the bot as (default: $SUDO_USER): " RUN_USER
RUN_USER=${RUN_USER:-$SUDO_USER}

# Get user's group
RUN_GROUP=$(id -gn "$RUN_USER")

echo -e "${GREEN}✓ Will run as user: $RUN_USER:$RUN_GROUP${NC}"
echo ""

# Create log directory
echo "📁 Creating log directory..."
mkdir -p /var/log/mm-bot
chown $RUN_USER:$RUN_GROUP /var/log/mm-bot
chmod 755 /var/log/mm-bot
echo -e "${GREEN}✓ Log directory created: /var/log/mm-bot${NC}"
echo ""

# Copy and configure service file
echo "📝 Configuring systemd service..."
SERVICE_FILE="/etc/systemd/system/mm-bot.service"

# Replace placeholders in service file
sed -e "s|REPLACE_WITH_YOUR_USER|$RUN_USER|g" \
    -e "s|REPLACE_WITH_YOUR_GROUP|$RUN_GROUP|g" \
    -e "s|/path/to/MM|$PROJECT_DIR|g" \
    "$PROJECT_DIR/systemd/mm-bot.service" > "$SERVICE_FILE"

echo -e "${GREEN}✓ Service file created: $SERVICE_FILE${NC}"
echo ""

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload
echo -e "${GREEN}✓ Systemd reloaded${NC}"
echo ""

# Enable service
echo "✅ Enabling service..."
systemctl enable mm-bot.service
echo -e "${GREEN}✓ Service enabled (will start on boot)${NC}"
echo ""

# Summary
echo "================================================"
echo "  Installation Complete!"
echo "================================================"
echo ""
echo "Service commands:"
echo "  Start:   sudo systemctl start mm-bot"
echo "  Stop:    sudo systemctl stop mm-bot"
echo "  Restart: sudo systemctl restart mm-bot"
echo "  Status:  sudo systemctl status mm-bot"
echo "  Logs:    sudo journalctl -u mm-bot -f"
echo ""
echo "Log files:"
echo "  Output:  /var/log/mm-bot/output.log"
echo "  Error:   /var/log/mm-bot/error.log"
echo ""
echo -e "${YELLOW}⚠️  Before starting, ensure:${NC}"
echo "  1. .env file is configured"
echo "  2. npm install completed"
echo "  3. npm run build completed"
echo ""
echo "Start the bot with: sudo systemctl start mm-bot"
echo ""