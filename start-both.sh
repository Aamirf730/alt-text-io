#!/bin/bash
# Start both Netlify Dev and React dev server properly

echo "Starting development servers..."

# Kill any existing processes
pkill -f "netlify dev" 2>/dev/null
pkill -f "yarn start" 2>/dev/null
sleep 2

# Start React dev server first in background
echo "Starting React dev server on port 3000..."
cd frontend
PORT=3000 yarn start > /tmp/react-dev.log 2>&1 &
REACT_PID=$!
cd ..
echo "React dev server started (PID: $REACT_PID)"

# Wait a bit for React to start
sleep 10

# Start Netlify Dev - it will proxy to React on 3000
echo "Starting Netlify Dev on port 8888..."
netlify dev --port 8888 --targetPort 3000 > /tmp/netlify-dev-final.log 2>&1 &
NETLIFY_PID=$!
echo "Netlify Dev started (PID: $NETLIFY_PID)"

sleep 10

echo ""
echo "✅ Servers starting..."
echo "React dev server: http://localhost:3000"
echo "Netlify Dev: http://localhost:8888"
echo ""
echo "Check logs:"
echo "  React: tail -f /tmp/react-dev.log"
echo "  Netlify: tail -f /tmp/netlify-dev-final.log"
