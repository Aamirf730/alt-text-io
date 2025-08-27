// Debug endpoint for monitoring credit store
// File: netlify/functions/debug-credits.js

const { getCreditStoreStats } = require('./utils/api-key-validator');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Get credit store statistics
    const stats = await getCreditStoreStats();
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      credit_store_status: 'Active',
      storage_type: stats.storage_type,
      total_users: stats.total_users,
      users: stats.users,
      system_info: {
        environment: process.env.NODE_ENV || 'development',
        function_name: 'debug-credits',
        memory_usage: process.memoryUsage(),
        uptime: process.uptime()
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(debugInfo, null, 2),
    };

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}; 