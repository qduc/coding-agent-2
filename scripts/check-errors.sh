#!/bin/bash

echo "🔍 Coding Agent Codebase Health Check"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Not in project root directory${NC}"
    exit 1
fi

echo -e "${BLUE}📁 Checking directory structure...${NC}"
echo "Expected directories in src/:"
expected_dirs=("cli" "core" "tools" "services" "utils")
for dir in "${expected_dirs[@]}"; do
    if [ -d "src/$dir" ]; then
        echo -e "  ✅ src/$dir"
    else
        echo -e "  ❌ src/$dir ${RED}(missing)${NC}"
    fi
done

echo ""
echo -e "${BLUE}📦 Checking package.json dependencies...${NC}"
if command -v jq &> /dev/null; then
    echo "Main dependencies:"
    jq -r '.dependencies | keys[]' package.json 2>/dev/null | head -5 | sed 's/^/  ✅ /'
    echo "Dev dependencies:"
    jq -r '.devDependencies | keys[]' package.json 2>/dev/null | head -5 | sed 's/^/  ✅ /'
else
    echo "  ⚠️  jq not installed, skipping dependency check"
fi

echo ""
echo -e "${BLUE}🔧 Running TypeScript compilation check...${NC}"
if npx tsc --noEmit --listFiles > /tmp/tsc-output.txt 2>&1; then
    echo -e "  ✅ TypeScript compilation successful"
    file_count=$(grep -c "\.ts" /tmp/tsc-output.txt 2>/dev/null || echo "0")
    echo "  📄 Compiled $file_count TypeScript files"
else
    echo -e "  ❌ TypeScript compilation failed"
    echo ""
    echo -e "${YELLOW}🚨 COMPILATION ERRORS:${NC}"
    
    # Categorize errors
    echo ""
    echo -e "${RED}Missing Modules/Files:${NC}"
    grep "Cannot find module\|error TS2307" /tmp/tsc-output.txt | head -10 | sed 's/^/  /'
    
    echo ""
    echo -e "${RED}Import/Export Issues:${NC}"
    grep "has no exported member\|error TS2305\|error TS2339" /tmp/tsc-output.txt | head -5 | sed 's/^/  /'
    
    echo ""
    echo -e "${RED}Type Errors:${NC}"
    grep "error TS.*Type\|implicitly has an 'any' type" /tmp/tsc-output.txt | head -5 | sed 's/^/  /'
fi

echo ""
echo -e "${BLUE}📋 File inventory:${NC}"
total_ts_files=$(find src -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l)
total_js_files=$(find src -name "*.js" -o -name "*.jsx" 2>/dev/null | wc -l)
total_test_files=$(find . -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | wc -l)

echo "  📄 TypeScript files: $total_ts_files"
echo "  📄 JavaScript files: $total_js_files"
echo "  🧪 Test files: $total_test_files"

if [ -f "src/cli/index.ts" ]; then
    echo "  ✅ Main CLI entry point exists"
else
    echo -e "  ❌ Main CLI entry point missing"
fi

echo ""
echo -e "${BLUE}🔍 Quick import analysis:${NC}"
missing_imports=$(grep -r "import.*from" src/ 2>/dev/null | grep -E "\./\w+|\.\./\w+" | head -5)
if [ -n "$missing_imports" ]; then
    echo "Sample relative imports found:"
    echo "$missing_imports" | sed 's/^/  /'
else
    echo "  ✅ No obvious relative import issues detected"
fi

echo ""
echo -e "${GREEN}✅ Health check complete!${NC}"
echo ""
echo -e "${YELLOW}💡 To fix issues:${NC}"
echo "  1. Run: npm install"
echo "  2. Create missing directories/files"
echo "  3. Fix import statements"
echo "  4. Run: npx tsc --noEmit"

# Cleanup
rm -f /tmp/tsc-output.txt
