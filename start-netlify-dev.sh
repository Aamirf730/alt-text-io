#!/bin/bash
# Start Netlify Dev with proper resource limits

echo "🚀 Starting Netlify Dev on port 9999..."
echo ""

# Increase file descriptor limit
ulimit -n 4096 2>/dev/null || echo "Note: Could not increase file limit"

# Kill any existing Netlify Dev processes
pkill -f "netlify dev" 2>/dev/null
sleep 2

# Start Netlify Dev
# Use --live flag to keep it running
netlify dev --port 9999 --live

echo ""
echo "✅ Netlify Dev started!"
echo "   Functions available at: http://localhost:9999/.netlify/functions"
echo ""
echo "Press Ctrl+C to stop"

