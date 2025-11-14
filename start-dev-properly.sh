#!/bin/bash
# Start Netlify Dev and React dev server properly

echo "Starting Netlify Dev server..."

# Kill any existing processes
pkill -f "netlify dev" 2>/dev/null

# Start Netlify Dev in background, but keep it running
# Use --no-open to prevent browser opening
# The command will keep yarn start running
netlify dev --command "cd frontend && yarn start" --no-open 2>&1 | tee /tmp/netlify-dev.log &

NETLIFY_PID=$!
echo "Netlify Dev started with PID: $NETLIFY_PID"
echo "Waiting for server to start..."
sleep 15

# Check if it's running
if ps -p $NETLIFY_PID > /dev/null; then
    echo "✅ Netlify Dev is running (PID: $NETLIFY_PID)"
    echo "Check http://localhost:8888"
    echo "Logs: tail -f /tmp/netlify-dev.log"
else
    echo "❌ Netlify Dev exited. Check logs:"
    tail -50 /tmp/netlify-dev.log
fi
