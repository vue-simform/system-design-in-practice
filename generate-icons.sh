#!/bin/bash

# PWA Icon Generator Script
# This script generates PWA icons in the required sizes from a source image
# 
# Prerequisites: ImageMagick (install with: sudo apt-get install imagemagick)
# Usage: ./generate-icons.sh source-icon.png

set -e

SOURCE_IMAGE=${1:-"icon-source.png"}
OUTPUT_DIR="public"

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick is not installed"
    echo "Install it with: sudo apt-get install imagemagick"
    echo ""
    echo "Alternative: Use an online PWA icon generator:"
    echo "  - https://www.pwabuilder.com/imageGenerator"
    echo "  - https://realfavicongenerator.net/"
    exit 1
fi

# Check if source image exists
if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "❌ Source image not found: $SOURCE_IMAGE"
    echo "Usage: $0 <source-image.png>"
    echo ""
    echo "Creating placeholder icons for now..."
    
    # Create simple colored placeholder icons
    convert -size 192x192 xc:#667eea -pointsize 80 -fill white -gravity center \
        -annotate +0+0 "NF" "$OUTPUT_DIR/icon-192.png"
    
    convert -size 512x512 xc:#667eea -pointsize 200 -fill white -gravity center \
        -annotate +0+0 "NF" "$OUTPUT_DIR/icon-512.png"
    
    convert -size 192x192 xc:#667eea -pointsize 80 -fill white -gravity center \
        -annotate +0+0 "NF" "$OUTPUT_DIR/icon-maskable-192.png"
    
    convert -size 512x512 xc:#667eea -pointsize 200 -fill white -gravity center \
        -annotate +0+0 "NF" "$OUTPUT_DIR/icon-maskable-512.png"
    
    echo "✅ Placeholder icons created!"
    echo "Replace them with proper icons by running: $0 your-logo.png"
    exit 0
fi

echo "🎨 Generating PWA icons from $SOURCE_IMAGE..."

# Generate regular icons
convert "$SOURCE_IMAGE" -resize 192x192 "$OUTPUT_DIR/icon-192.png"
echo "✅ Generated icon-192.png"

convert "$SOURCE_IMAGE" -resize 512x512 "$OUTPUT_DIR/icon-512.png"
echo "✅ Generated icon-512.png"

# Generate maskable icons (with safe zone padding)
# Maskable icons need 20% padding on all sides (safe zone)
convert "$SOURCE_IMAGE" -resize 384x384 -gravity center \
    -background transparent -extent 512x512 "$OUTPUT_DIR/icon-maskable-512.png"
echo "✅ Generated icon-maskable-512.png"

convert "$SOURCE_IMAGE" -resize 154x154 -gravity center \
    -background transparent -extent 192x192 "$OUTPUT_DIR/icon-maskable-192.png"
echo "✅ Generated icon-maskable-192.png"

# Generate favicons
convert "$SOURCE_IMAGE" -resize 32x32 "$OUTPUT_DIR/favicon-32x32.png"
convert "$SOURCE_IMAGE" -resize 16x16 "$OUTPUT_DIR/favicon-16x16.png"
echo "✅ Generated favicons"

# Generate Apple touch icons
convert "$SOURCE_IMAGE" -resize 180x180 "$OUTPUT_DIR/apple-touch-icon.png"
echo "✅ Generated apple-touch-icon.png"

echo ""
echo "🎉 All PWA icons generated successfully!"
echo ""
echo "Generated icons:"
echo "  - icon-192.png (regular)"
echo "  - icon-512.png (regular)"
echo "  - icon-maskable-192.png (maskable)"
echo "  - icon-maskable-512.png (maskable)"
echo "  - favicon-32x32.png"
echo "  - favicon-16x16.png"
echo "  - apple-touch-icon.png"
