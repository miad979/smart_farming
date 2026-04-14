#!/bin/bash

# 🌾 Smart Farming System - Startup & Verification Script
# This script verifies that everything is set up correctly

echo "🌾 ======================================"
echo "   SMART FARMING SYSTEM"
echo "   Startup & Verification"
echo "====================================== 🌾"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check functions
check_mark="${GREEN}✓${NC}"
cross_mark="${RED}✗${NC}"
warn_mark="${YELLOW}⚠${NC}"

echo "🔍 Checking system requirements..."
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${check_mark} Node.js: ${NODE_VERSION}"
else
    echo -e "${cross_mark} Node.js: Not found"
    echo "   Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${check_mark} npm: v${NPM_VERSION}"
else
    echo -e "${cross_mark} npm: Not found"
    exit 1
fi

echo ""
echo "📦 Checking project dependencies..."
echo ""

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo -e "${check_mark} Dependencies: Installed"
else
    echo -e "${warn_mark} Dependencies: Not installed"
    echo "   Installing dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${check_mark} Dependencies: Installed successfully"
    else
        echo -e "${cross_mark} Dependencies: Installation failed"
        exit 1
    fi
fi

echo ""
echo "⚙️  Checking configuration..."
echo ""

# Check for .env file
if [ -f ".env" ]; then
    echo -e "${check_mark} .env file: Found"

    if grep -q "VITE_SMS_ENABLED=true" .env; then
        echo -e "${check_mark} SMS Service: Enabled"
    else
        echo -e "${warn_mark} SMS Service: Disabled (demo mode)"
    fi
else
    echo -e "${warn_mark} .env file: Not found (using demo mode)"
    echo "   To enable production features, copy .env.example to .env"
fi

echo ""
echo "🏗️  Checking project structure..."
echo ""

# Check critical files
files_to_check=(
    "src/app/App.tsx"
    "src/app/routes.ts"
    "src/app/context/AppContext.tsx"
    "src/app/utils/api.ts"
    "src/app/services/sms.ts"
    "server/local-api.cjs"
    "package.json"
)

all_files_exist=true
for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${check_mark} ${file}"
    else
        echo -e "${cross_mark} ${file}"
        all_files_exist=false
    fi
done

if [ "$all_files_exist" = false ]; then
    echo ""
    echo -e "${RED}Error: Some critical files are missing${NC}"
    exit 1
fi

echo ""
echo "🎨 System Mode..."
echo ""

echo -e "   Running in: ${BLUE}Local Mode${NC}"
echo ""
echo "   📱 Local Mode Features:"
echo "   • Email + password authentication"
echo "   • Local API + local JSON database"
echo "   • Real-time updates over SSE"
echo ""

echo "✅ All checks passed!"
echo ""
echo "🚀 Starting development server..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Access the app at:"
echo "   ${BLUE}http://localhost:5173${NC}"
echo ""
echo "🧪 Default Admin Account:"
echo "   Email: admin@smartfarming.local"
echo "   Password: admin123"
echo ""
echo "📚 Documentation:"
echo "   • README.md - Complete overview"
echo "   • COMPLETE_SETUP.md - Setup guide"
echo "   • SMS_SETUP.md - SMS configuration"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start the dev server
npm run dev
