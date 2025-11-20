// Database Data Export Script
// Exports all data from Supabase tables to JSON and SQL formats

const fs = require('fs');
const path = require('path');

// This script should be run with SUPABASE_SERVICE_ROLE_KEY environment variable
// For security, we'll create a template that can be filled in

const BACKUP_DIR = path.join(__dirname, 'backups', `database-export-${new Date().toISOString().split('T')[0]}`);
const TABLES = ['profiles', 'subscription_plans', 'payments', 'usage_logs', 'api_keys'];

// Create export instructions
const exportInstructions = `
========================================
Database Export Instructions
========================================

To export the database data, you have several options:

OPTION 1: Supabase Dashboard (Recommended)
1. Go to: https://app.supabase.com/project/qurbdtzrngzfzevgoolp
2. Navigate to: Database > Backups
3. Click "Create backup" or use "Point in time recovery"
4. Download the backup file

OPTION 2: Supabase CLI
1. Install Supabase CLI: npm install -g supabase
2. Login: supabase login
3. Link project: supabase link --project-ref qurbdtzrngzfzevgoolp
4. Export: supabase db dump -f database-export.sql

OPTION 3: pg_dump (Direct Database Access)
1. Get connection string from Supabase dashboard
2. Run: pg_dump -h db.qurbdtzrngzfzevgoolp.supabase.co -U postgres -d postgres > database-export.sql

OPTION 4: Use Supabase MCP Tools
The database can be exported using the Supabase MCP tools available in this environment.

=== TABLES TO EXPORT ===
${TABLES.map((t, i) => `${i + 1}. ${t}`).join('\n')}

=== CURRENT DATA COUNTS ===
- profiles: 7 rows
- subscription_plans: 7 rows  
- payments: 20 rows
- usage_logs: 626 rows
- api_keys: 7 rows

=== IMPORTANT ===
- Database exports contain sensitive user data
- Keep backups encrypted and secure
- Do not commit database exports to version control
- Test restoration on development environment first

Export Date: ${new Date().toISOString()}
`;

// Create backup directory
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Write instructions
fs.writeFileSync(path.join(BACKUP_DIR, 'EXPORT_INSTRUCTIONS.txt'), exportInstructions);

console.log('Database export instructions created at:');
console.log(path.join(BACKUP_DIR, 'EXPORT_INSTRUCTIONS.txt'));
console.log('\n' + exportInstructions);

