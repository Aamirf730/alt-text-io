#!/bin/bash

# Alt Text Pro WordPress Plugin Builder
# Creates a ZIP file ready for distribution

echo "📦 Building Alt Text Pro WordPress Plugin..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Navigate to plugin directory
cd "$(dirname "$0")"

# Remove old ZIP files
echo -e "${BLUE}Cleaning up old builds...${NC}"
rm -f alt-text-ai-plugin.zip alt-text-ai.zip

# Create ZIP file
echo -e "${BLUE}Creating plugin ZIP file...${NC}"
zip -r alt-text-ai-plugin.zip alt-text-ai \
  -x "*.DS_Store" \
  -x "*.git*" \
  -x "*.md" \
  -x "*/.*" \
  -x "*/.git/*" \
  -x "*/node_modules/*" \
  -x "*/tests/*" \
  -x "*/test/*" \
  > /dev/null 2>&1

# Check if ZIP was created successfully
if [ -f "alt-text-ai-plugin.zip" ]; then
    SIZE=$(ls -lh alt-text-ai-plugin.zip | awk '{print $5}')
    echo -e "${GREEN}✅ Plugin ZIP created successfully!${NC}"
    echo -e "${GREEN}   File: alt-text-ai-plugin.zip${NC}"
    echo -e "${GREEN}   Size: $SIZE${NC}"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Upload to your server: frontend/public/wordpress-plugin/alt-text-ai-plugin.zip"
    echo "   2. Users can download from: https://www.alt-text.pro/wordpress-plugin/alt-text-ai-plugin.zip"
    echo "   3. Or update the dashboard link to point to this file"
else
    echo "❌ Error: Failed to create ZIP file"
    exit 1
fi

