#!/bin/bash

# PWA Verification Script
# Checks if all PWA requirements are met before deployment

set -e

echo "🔍 PWA Verification Starting..."
echo ""

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# 1. Check service worker exists
echo "📋 Checking Service Worker..."
if [ -f "public/service-worker.js" ]; then
    check_pass "Service worker file exists"
else
    check_fail "Service worker file not found at public/service-worker.js"
fi

# 2. Check manifest exists
echo ""
echo "📋 Checking Manifest..."
if [ -f "public/manifest.json" ]; then
    check_pass "Manifest file exists"
    
    # Validate manifest has required fields
    if grep -q '"name"' public/manifest.json && \
       grep -q '"short_name"' public/manifest.json && \
       grep -q '"start_url"' public/manifest.json && \
       grep -q '"display"' public/manifest.json && \
       grep -q '"icons"' public/manifest.json; then
        check_pass "Manifest has required fields"
    else
        check_fail "Manifest missing required fields"
    fi
else
    check_fail "Manifest file not found at public/manifest.json"
fi

# 3. Check icons
echo ""
echo "📋 Checking Icons..."
REQUIRED_ICONS=("icon-192.png" "icon-512.png" "icon-maskable-192.png" "icon-maskable-512.png")
for icon in "${REQUIRED_ICONS[@]}"; do
    if [ -f "public/$icon" ]; then
        check_pass "Icon exists: $icon"
    else
        check_warn "Icon missing: $icon (run ./generate-icons.sh to create)"
    fi
done

# 4. Check HTML has manifest link
echo ""
echo "📋 Checking HTML..."
if [ -f "index.html" ]; then
    if grep -q 'rel="manifest"' index.html; then
        check_pass "HTML links to manifest"
    else
        check_fail "HTML missing manifest link"
    fi
    
    if grep -q 'name="theme-color"' index.html; then
        check_pass "HTML has theme-color meta tag"
    else
        check_warn "HTML missing theme-color meta tag"
    fi
    
    if grep -q 'apple-touch-icon' index.html; then
        check_pass "HTML has apple-touch-icon"
    else
        check_warn "HTML missing apple-touch-icon"
    fi
else
    check_fail "index.html not found"
fi

# 5. Check service worker registration
echo ""
echo "📋 Checking Service Worker Registration..."
if grep -r "registerServiceWorker" src/main.tsx > /dev/null 2>&1; then
    check_pass "Service worker registration found in main.tsx"
else
    check_fail "Service worker registration not found in main.tsx"
fi

# 6. Check if serviceWorkerRegistration.ts exists
if [ -f "src/utils/serviceWorkerRegistration.ts" ]; then
    check_pass "Service worker registration utility exists"
else
    check_fail "src/utils/serviceWorkerRegistration.ts not found"
fi

# 7. Check netlify.toml for PWA headers
echo ""
echo "📋 Checking Deployment Configuration..."
if [ -f "netlify.toml" ]; then
    check_pass "netlify.toml exists"
    
    if grep -q "service-worker.js" netlify.toml; then
        check_pass "netlify.toml has service worker headers"
    else
        check_warn "netlify.toml missing service worker specific headers"
    fi
else
    check_warn "netlify.toml not found (may be using different deployment)"
fi

# 8. Check vite config for SW handling
echo ""
echo "📋 Checking Build Configuration..."
if [ -f "vite.config.ts" ]; then
    if grep -q "service-worker" vite.config.ts; then
        check_pass "vite.config.ts handles service worker"
    else
        check_warn "vite.config.ts may not copy service worker to dist/"
    fi
else
    check_fail "vite.config.ts not found"
fi

# 9. Check offline page exists
echo ""
echo "📋 Checking Offline Support..."
if [ -f "public/offline.html" ]; then
    check_pass "Offline fallback page exists"
else
    check_warn "Offline fallback page not found"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Verification Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! PWA is ready.${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Passed with $WARNINGS warning(s)${NC}"
    echo "Consider addressing warnings for better PWA support."
    exit 0
else
    echo -e "${RED}❌ Failed with $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo ""
    echo "Please fix the errors before deploying."
    exit 1
fi
