#!/usr/bin/env node

/**
 * PayPal CLI Tool
 * A simple command-line interface for interacting with PayPal API
 * 
 * Usage:
 *   node paypal-cli.js <command> [options]
 * 
 * Commands:
 *   account     - Show PayPal account information
 *   products    - List all products
 *   plans       - List all plans
 *   plan <id>   - Show plan details
 *   product <id> - Show product details
 *   subscription <id> - Show subscription details
 *   create-plan - Create a new plan (interactive)
 */

const readline = require('readline');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'production';
const PAYPAL_BASE_URL = PAYPAL_ENVIRONMENT === 'sandbox' 
  ? 'https://api-m.sandbox.paypal.com' 
  : 'https://api-m.paypal.com';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Get PayPal access token
async function getAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials not found. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.');
  }

  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Failed to get access token: ${data.error_description || data.error}`);
  }
  
  return data.access_token;
}

// Show account information
async function showAccountInfo() {
  try {
    log('\n=== PayPal Account Information ===', 'bright');
    log(`Environment: ${PAYPAL_ENVIRONMENT}`, 'cyan');
    log(`Base URL: ${PAYPAL_BASE_URL}`, 'cyan');
    log(`Client ID: ${PAYPAL_CLIENT_ID ? (PAYPAL_CLIENT_ID.substring(0, 20) + '...') : 'NOT SET'}`, 'cyan');
    log(`Client Secret: ${PAYPAL_CLIENT_SECRET ? 'SET (hidden)' : 'NOT SET'}`, 'cyan');
    
    const accessToken = await getAccessToken();
    success('Access token obtained successfully');
    log(`Token preview: ${accessToken.substring(0, 30)}...`, 'cyan');
    
    log('\nNote: Email address is not available via API with client credentials.', 'yellow');
    log('Check your PayPal Developer Dashboard for account email.', 'yellow');
    
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// List all products
async function listProducts() {
  try {
    const accessToken = await getAccessToken();
    log('\n=== PayPal Products ===', 'bright');
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/catalog/products`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch products: ${error.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.products && data.products.length > 0) {
      data.products.forEach((product, index) => {
        log(`\n${index + 1}. ${product.name}`, 'bright');
        log(`   ID: ${product.id}`, 'cyan');
        log(`   Type: ${product.type}`, 'cyan');
        log(`   Category: ${product.category || 'N/A'}`, 'cyan');
      });
    } else {
      warning('No products found');
    }
    
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// Show product details
async function showProduct(productId) {
  try {
    const accessToken = await getAccessToken();
    log(`\n=== Product: ${productId} ===`, 'bright');
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/catalog/products/${productId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch product: ${error.message || response.statusText}`);
    }
    
    const product = await response.json();
    
    log(`Name: ${product.name}`, 'cyan');
    log(`ID: ${product.id}`, 'cyan');
    log(`Type: ${product.type}`, 'cyan');
    log(`Category: ${product.category || 'N/A'}`, 'cyan');
    log(`Description: ${product.description || 'N/A'}`, 'cyan');
    log(`\nFull details:`, 'bright');
    console.log(JSON.stringify(product, null, 2));
    
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// List all plans
async function listPlans() {
  try {
    const accessToken = await getAccessToken();
    log('\n=== PayPal Plans ===', 'bright');
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch plans: ${error.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.plans && data.plans.length > 0) {
      data.plans.forEach((plan, index) => {
        log(`\n${index + 1}. ${plan.name}`, 'bright');
        log(`   ID: ${plan.id}`, 'cyan');
        log(`   Status: ${plan.status}`, plan.status === 'ACTIVE' ? 'green' : 'yellow');
        log(`   Product ID: ${plan.product_id}`, 'cyan');
      });
    } else {
      warning('No plans found');
    }
    
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// Show plan details
async function showPlan(planId) {
  try {
    const accessToken = await getAccessToken();
    log(`\n=== Plan: ${planId} ===`, 'bright');
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans/${planId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch plan: ${error.message || response.statusText}`);
    }
    
    const plan = await response.json();
    
    log(`Name: ${plan.name}`, 'cyan');
    log(`ID: ${plan.id}`, 'cyan');
    log(`Status: ${plan.status}`, plan.status === 'ACTIVE' ? 'green' : 'yellow');
    log(`Product ID: ${plan.product_id}`, 'cyan');
    log(`Description: ${plan.description || 'N/A'}`, 'cyan');
    
    if (plan.billing_cycles && plan.billing_cycles.length > 0) {
      log(`\nBilling Cycles:`, 'bright');
      plan.billing_cycles.forEach((cycle, index) => {
        log(`  ${index + 1}. ${cycle.tenure_type} - ${cycle.frequency.interval_count} ${cycle.frequency.interval_unit}(s)`, 'cyan');
        if (cycle.pricing_scheme && cycle.pricing_scheme.fixed_price) {
          log(`     Price: ${cycle.pricing_scheme.fixed_price.value} ${cycle.pricing_scheme.fixed_price.currency_code}`, 'cyan');
        }
      });
    }
    
    log(`\nFull details:`, 'bright');
    console.log(JSON.stringify(plan, null, 2));
    
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// Show subscription details
async function showSubscription(subscriptionId) {
  try {
    const accessToken = await getAccessToken();
    log(`\n=== Subscription: ${subscriptionId} ===`, 'bright');
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch subscription: ${error.message || response.statusText}`);
    }
    
    const subscription = await response.json();
    
    log(`ID: ${subscription.id}`, 'cyan');
    log(`Status: ${subscription.status}`, subscription.status === 'ACTIVE' ? 'green' : 'yellow');
    log(`Plan ID: ${subscription.plan_id}`, 'cyan');
    
    if (subscription.subscriber) {
      log(`Subscriber Email: ${subscription.subscriber.email_address || 'N/A'}`, 'cyan');
    }
    
    if (subscription.links) {
      log(`\nLinks:`, 'bright');
      subscription.links.forEach(link => {
        log(`  ${link.rel}: ${link.href}`, 'cyan');
      });
    }
    
    log(`\nFull details:`, 'bright');
    console.log(JSON.stringify(subscription, null, 2));
    
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// Main CLI handler
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  if (!command) {
    log('\nPayPal CLI Tool', 'bright');
    log('Usage: node paypal-cli.js <command> [argument]', 'cyan');
    log('\nCommands:', 'bright');
    log('  account              Show PayPal account information');
    log('  products             List all products');
    log('  product <id>         Show product details');
    log('  plans                List all plans');
    log('  plan <id>            Show plan details');
    log('  subscription <id>    Show subscription details');
    log('\nExamples:', 'bright');
    log('  node paypal-cli.js account');
    log('  node paypal-cli.js plans');
    log('  node paypal-cli.js plan P-10836440LT044463FNEJT6IA');
    log('  node paypal-cli.js subscription I-VJMH17P1HHS2');
    process.exit(0);
  }

  try {
    switch (command) {
      case 'account':
        await showAccountInfo();
        break;
      case 'products':
        await listProducts();
        break;
      case 'product':
        if (!arg) {
          error('Product ID required. Usage: node paypal-cli.js product <id>');
          process.exit(1);
        }
        await showProduct(arg);
        break;
      case 'plans':
        await listPlans();
        break;
      case 'plan':
        if (!arg) {
          error('Plan ID required. Usage: node paypal-cli.js plan <id>');
          process.exit(1);
        }
        await showPlan(arg);
        break;
      case 'subscription':
      case 'sub':
        if (!arg) {
          error('Subscription ID required. Usage: node paypal-cli.js subscription <id>');
          process.exit(1);
        }
        await showSubscription(arg);
        break;
      default:
        error(`Unknown command: ${command}`);
        log('Run without arguments to see usage', 'cyan');
        process.exit(1);
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// Run CLI
main();

