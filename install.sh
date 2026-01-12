#!/bin/bash

# 01.xyz Market Maker Bot - One-Command Installer
# Usage: curl -sSL https://your-repo/install.sh | bash

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║        01.xyz Market Maker Bot - Installer               ║"
echo "║        Professional Market Making on Solana               ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js >= 18.0.0"
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version must be >= 18${NC}"
    echo "Current version: $(node -v)"
    echo "Please upgrade Node.js"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node -v) detected${NC}"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm $(npm -v) detected${NC}"
echo ""

# Create project directory
PROJECT_NAME="01xyz-market-maker-bot"
echo "📁 Creating project directory: $PROJECT_NAME"

if [ -d "$PROJECT_NAME" ]; then
    echo -e "${YELLOW}⚠️  Directory $PROJECT_NAME already exists${NC}"
    read -p "Remove and reinstall? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$PROJECT_NAME"
    else
        echo "Installation cancelled"
        exit 0
    fi
fi

mkdir -p "$PROJECT_NAME"
cd "$PROJECT_NAME"

echo -e "${GREEN}✅ Project directory created${NC}"
echo ""

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p src/core
mkdir -p src/live
mkdir -p src/backtest
mkdir -p types
mkdir -p logs
mkdir -p data
mkdir -p scripts

echo -e "${GREEN}✅ Directory structure created${NC}"
echo ""

# Note to user
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║                   Setup Instructions                      ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Now you need to:"
echo ""
echo "1. Copy all the project files provided by Claude into this directory"
echo ""
echo "2. Run the setup script:"
echo "   ${GREEN}bash scripts/setup.sh${NC}"
echo ""
echo "3. Edit your .env file with credentials:"
echo "   ${GREEN}nano .env${NC}"
echo ""
echo "4. Test the connection:"
echo "   ${GREEN}npm run test:live${NC}"
echo ""
echo "5. Run a backtest:"
echo "   ${GREEN}npm run backtest${NC}"
echo ""
echo "6. Read the quick start guide:"
echo "   ${GREEN}cat QUICKSTART.md${NC}"
echo ""
echo "Project created at: ${GREEN}$(pwd)${NC}"
echo ""
echo "Happy trading! 🚀"
echo ""