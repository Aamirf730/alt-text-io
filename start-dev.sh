#!/bin/bash
# Start React dev server first
cd frontend
PORT=3000 yarn start > /tmp/react-dev.log 2>&1 &
REACT_PID=$!
cd ..
echo "React dev server started (PID: $REACT_PID)"

# Wait for React to be ready
sleep 15

# Start Netlify Dev to proxy and provide functions
# Use --live flag and configure to proxy to React
netlify dev --port 8888 --live > /tmp/netlify-dev.log 2>&1 &
NETLIFY_PID=$!
echo "Netlify Dev started (PID: $NETLIFY_PID)"

echo ""
echo "✅ Development servers starting..."
echo "React: http://localhost:3000"
echo "Netlify Dev: http://localhost:8888"
echo ""
echo "Logs:"
echo "  React: tail -f /tmp/react-dev.log"
echo "  Netlify: tail -f /tmp/netlify-dev.log"
