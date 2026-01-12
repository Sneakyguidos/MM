#!/bin/bash

# 01.xyz Market Maker Bot - Setup Script
# This script prepares the project for first use

set -e

echo "=========================================="
echo "01.xyz Market Maker Bot - Setup"
echo "=========================================="
echo ""

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p data
mkdir -p dist

echo "✅ Directories created"
echo ""

# Check Node.js version
echo "🔍 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)

if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be >= 18"
    echo "   Current version: $(node -v)"
    echo "   Please upgrade Node.js"
    exit 1
fi

echo "✅ Node.js version OK: $(node -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "✅ Dependencies installed"
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env created - PLEASE EDIT IT WITH YOUR CREDENTIALS"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your:"
    echo "   - PRIVATE_KEY_BASE58"
    echo "   - RPC_ENDPOINT"
    echo "   - WEB_SERVER_URL"
    echo ""
else
    echo "✅ .env already exists"
    echo ""
fi

# Build the project
echo "🔨 Building TypeScript..."
npm run build

echo "✅ Build complete"
echo ""

# Create example data
echo "📊 Creating example data..."
cat > data/example-history.json << 'EOF'
[
  {
    "timestamp": 1704067200000,
    "open": 100.00,
    "high": 100.50,
    "low": 99.50,
    "close": 100.25,
    "volume": 5000,
    "bidDepth": 45,
    "askDepth": 50
  },
  {
    "timestamp": 1704067260000,
    "open": 100.25,
    "high": 100.75,
    "low": 100.00,
    "close": 100.50,
    "volume": 5500,
    "bidDepth": 48,
    "askDepth": 52
  }
]
EOF

echo "✅ Example data created"
echo ""

echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Edit .env with your credentials"
echo "2. Run 'npm run test:live' to test connection"
echo "3. Run 'npm run backtest' to test strategy"
echo "4. Read QUICKSTART.md for detailed guide"
echo ""
echo "Happy trading! 🚀"
echo ""