#!/bin/bash

# PWA Quick Test Script
# Quick verification that PWA is working

echo "🚀 PWA Quick Test"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test 1: Check if running
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Dev server is running"
    SERVER_RUNNING=true
else
    echo -e "${YELLOW}⚠${NC} Dev server not running (run: npm run dev)"
    SERVER_RUNNING=false
fi

# Test 2: Check service worker endpoint
if [ "$SERVER_RUNNING" = true ]; then
    if curl -s http://localhost:5173/service-worker.js | grep -q "Service Worker"; then
        echo -e "${GREEN}✓${NC} Service worker is accessible"
    else
        echo -e "${RED}✗${NC} Service worker not accessible"
    fi
fi

# Test 3: Check manifest endpoint  
if [ "$SERVER_RUNNING" = true ]; then
    if curl -s http://localhost:5173/manifest.json | grep -q "News Feed"; then
        echo -e "${GREEN}✓${NC} Manifest is accessible"
    else
        echo -e "${RED}✗${NC} Manifest not accessible"
    fi
fi

# Test 4: Check icons
ICONS_OK=true
for icon in icon-192.png icon-512.png; do
    if [ "$SERVER_RUNNING" = true ]; then
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/$icon | grep -q "200"; then
            echo -e "${GREEN}✓${NC} Icon accessible: $icon"
        else
            echo -e "${RED}✗${NC} Icon not accessible: $icon"
            ICONS_OK=false
        fi
    fi
done

echo ""
echo "📱 Next Steps:"
echo "  1. Open http://localhost:5173 in Chrome"
echo "  2. Open DevTools (F12) → Application tab"
echo "  3. Check 'Service Workers' section"
echo "  4. Check 'Manifest' section"
echo "  5. Try Network → Offline checkbox"
echo ""
echo "📚 Documentation:"
echo "  - PWA Guide: cat PWA.md"
echo "  - Testing Guide: cat PWA-TESTING.md"
echo "  - Verify setup: npm run verify-pwa"
