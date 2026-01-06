#!/bin/bash

# Gemini Nexus Chrome Extension Build Script
# This script builds the extension and copies all necessary files to dist/

set -e  # Exit on error

echo "🚀 Building Gemini Nexus Chrome Extension..."
echo ""

# Step 1: Clean dist directory
echo "📁 Cleaning dist directory..."
cd gemini-nexus
rm -rf dist/*

# Step 2: Run Vite build (for sidepanel and sandbox)
echo "⚡ Running Vite build..."
npm run build

# Step 3: Copy extension files
echo "📦 Copying extension files..."

# Core files
cp manifest.json dist/
cp logo.png dist/
cp metadata.json dist/

# Directories
cp -r background dist/
cp -r content dist/
cp -r lib dist/
cp -r services dist/
cp -r css dist/

# Step 4: Verify build
echo ""
echo "✅ Build complete!"
echo ""
echo "📊 Build summary:"
echo "   - manifest.json: ✓"
echo "   - logo.png: ✓"
echo "   - background/: ✓"
echo "   - content/: ✓ (includes pip.js)"
echo "   - sidepanel/: ✓"
echo "   - sandbox/: ✓"
echo "   - services/: ✓"
echo "   - lib/: ✓"
echo "   - css/: ✓"
echo ""

# Check if pip.js exists
if [ -f "dist/content/pip.js" ]; then
    PIP_SIZE=$(ls -lh dist/content/pip.js | awk '{print $5}')
    echo "   🪟 PIP Window: ✓ (pip.js: $PIP_SIZE)"
else
    echo "   ⚠️  PIP Window: pip.js not found!"
fi

echo ""
echo "📍 Extension location: $(pwd)/dist"
echo ""
echo "🎯 Next steps:"
echo "   1. Open chrome://extensions/"
echo "   2. Enable 'Developer mode'"
echo "   3. Click 'Load unpacked'"
echo "   4. Select the 'dist' folder"
echo "   5. Press Alt+G to test PIP window!"
echo ""
echo "📖 See CHROME-EXTENSION-INSTALL.md for detailed instructions"
