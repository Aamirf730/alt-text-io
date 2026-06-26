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

VERSION=$(grep -E "^[[:space:]]*\\* Version:" alt-text-pro/alt-text-pro.php | head -n 1 | awk -F': ' '{print $2}' | tr -d '[:space:]')
if [ -z "$VERSION" ]; then
    echo "❌ Error: Could not detect plugin version from alt-text-pro.php"
    exit 1
fi

OUTPUT="alt-text-pro-plugin.zip"
VERSIONED_OUTPUT="alt-text-pro-plugin-${VERSION}.zip"
PUBLIC_PLUGIN_DIR="../frontend-next/public/wordpress-plugin"
PUBLIC_DOWNLOAD_DIR="../frontend-next/public/downloads"

# Remove old ZIP files
echo -e "${BLUE}Cleaning up old builds...${NC}"
rm -f "$OUTPUT" "$VERSIONED_OUTPUT" alt-text-ai-plugin.zip alt-text-ai.zip

# Create ZIP file (disable macOS resource forks)
echo -e "${BLUE}Creating plugin ZIP file...${NC}"
export COPYFILE_DISABLE=1
zip -r "$OUTPUT" alt-text-pro \
  -x "*.DS_Store" \
  -x "*.md" \
  -x "__MACOSX*" \
  -x "*/.DS_Store" \
  -x "*/.*" \
  -x "*/.git/*" \
  -x "*/node_modules/*" \
  -x "*/tests/*" \
  -x "*/test/*" \
  -x "*/test-*.php" \
  > /dev/null 2>&1

# Check if ZIP was created successfully
if [ -f "$OUTPUT" ]; then
    cp "$OUTPUT" "$VERSIONED_OUTPUT"
    mkdir -p "$PUBLIC_PLUGIN_DIR" "$PUBLIC_DOWNLOAD_DIR"
    cp "$OUTPUT" "$PUBLIC_PLUGIN_DIR/$OUTPUT"
    cp "$VERSIONED_OUTPUT" "$PUBLIC_PLUGIN_DIR/$VERSIONED_OUTPUT"
    cp "$OUTPUT" "$PUBLIC_DOWNLOAD_DIR/alt-text-pro.zip"

    SIZE=$(ls -lh "$OUTPUT" | awk '{print $5}')
    echo -e "${GREEN}✅ Plugin ZIP created successfully!${NC}"
    echo -e "${GREEN}   Version: $VERSION${NC}"
    echo -e "${GREEN}   File: $OUTPUT${NC}"
    echo -e "${GREEN}   File: $VERSIONED_OUTPUT${NC}"
    echo -e "${GREEN}   Size: $SIZE${NC}"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Deploy the site; Netlify runs this script before next build"
    echo "   2. Users can download from: https://www.alt-text.pro/wordpress-plugin/alt-text-pro-plugin-$VERSION.zip"
    echo "   3. Stable download URL: https://www.alt-text.pro/wordpress-plugin/alt-text-pro-plugin.zip"
else
    echo "❌ Error: Failed to create ZIP file"
    exit 1
fi
