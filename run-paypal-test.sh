#!/bin/bash

# Script to test PayPal subscription creation directly
# This will fetch credentials from Netlify and run the test

echo "🔍 Getting PayPal credentials from Netlify..."
echo ""

# Get the account info which includes client ID
CLIENT_ID=$(curl -s "https://www.alt-text.pro/.netlify/functions/check-paypal-account" | grep -o '"clientIdFull":"[^"]*"' | cut -d'"' -f4)

if [ -z "$CLIENT_ID" ]; then
    echo "❌ Could not get Client ID from Netlify"
    echo ""
    echo "Please get PAYPAL_CLIENT_SECRET manually from:"
    echo "  https://app.netlify.com → Site Settings → Environment Variables"
    echo ""
    echo "Then run:"
    echo "  export PAYPAL_CLIENT_SECRET='your_secret_here'"
    echo "  node test-paypal-subscription-direct.js"
    exit 1
fi

echo "✅ Client ID found: ${CLIENT_ID:0:20}..."
echo ""
echo "⚠️  Client Secret is not available via API (for security)"
echo ""
echo "To run the test, please:"
echo "1. Go to: https://app.netlify.com"
echo "2. Navigate to: Site Settings → Environment Variables"
echo "3. Find: PAYPAL_CLIENT_SECRET"
echo "4. Copy the value"
echo "5. Run:"
echo ""
echo "   export PAYPAL_CLIENT_ID='$CLIENT_ID'"
echo "   export PAYPAL_CLIENT_SECRET='<paste_secret_here>'"
echo "   export PAYPAL_ENVIRONMENT='production'"
echo "   node test-paypal-subscription-direct.js"
echo ""

