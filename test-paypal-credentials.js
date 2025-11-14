#!/usr/bin/env node
// Test PayPal credentials
const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  PAYPAL CREDENTIALS TESTER');
console.log('═══════════════════════════════════════════════════════════════\n');

// Read current .env
let envContent = '';
try {
  envContent = fs.readFileSync('.env', 'utf8');
} catch (e) {
  console.log('⚠️  .env file not found');
}

const currentClientId = envContent.match(/^PAYPAL_CLIENT_ID=(.+)$/m)?.[1];
const currentSecret = envContent.match(/^PAYPAL_CLIENT_SECRET=(.+)$/m)?.[1];

console.log('Current credentials:');
console.log(`  Client ID: ${currentClientId ? currentClientId.substring(0, 20) + '...' : 'NOT SET'}`);
console.log(`  Secret: ${currentSecret ? 'SET (hidden)' : 'NOT SET'}\n`);

console.log('To fix PayPal authentication:');
console.log('1. Go to: https://developer.paypal.com/dashboard/');
console.log('2. Log in to your PayPal Developer account');
console.log('3. Navigate to: Apps & Credentials');
console.log('4. Select your Sandbox app (or create one)');
console.log('5. Copy the Client ID and Secret');
console.log('\nThen update your .env file with the correct credentials.\n');

rl.question('Do you want to test new credentials now? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y') {
    rl.question('Enter PayPal Sandbox Client ID: ', (clientId) => {
      rl.question('Enter PayPal Sandbox Client Secret: ', (secret) => {
        testCredentials(clientId, secret);
        rl.close();
      });
    });
  } else {
    console.log('\nTo update manually, edit .env and set:');
    console.log('PAYPAL_CLIENT_ID=your_client_id');
    console.log('PAYPAL_CLIENT_SECRET=your_client_secret');
    console.log('PAYPAL_ENVIRONMENT=sandbox\n');
    rl.close();
  }
});

function testCredentials(clientId, secret) {
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  
  console.log('\nTesting credentials...\n');
  
  fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  .then(res => res.json())
  .then(data => {
    if (data.access_token) {
      console.log('✅ SUCCESS! Credentials are valid!\n');
      console.log('Update your .env file with:');
      console.log(`PAYPAL_CLIENT_ID=${clientId}`);
      console.log(`PAYPAL_CLIENT_SECRET=${secret}`);
      console.log('PAYPAL_ENVIRONMENT=sandbox\n');
    } else {
      console.log('❌ FAILED! Credentials are invalid.\n');
      console.log('Error:', data.error_description || data.error);
      console.log('\nPlease check:');
      console.log('1. Are you using SANDBOX credentials? (not production)');
      console.log('2. Do the Client ID and Secret match?');
      console.log('3. Is your PayPal Developer account active?\n');
    }
  })
  .catch(err => {
    console.log('❌ Error testing credentials:', err.message);
  });
}
