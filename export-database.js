// Database Export Script for Alt-Text Pro Backup
// This script exports all database tables to SQL files

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL || 'https://qurbdtzrngzfzevgoolp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BACKUP_DIR = path.join(__dirname, 'backups', `database-export-${new Date().toISOString().split('T')[0]}`);
const TABLES = [
  'profiles',
  'subscription_plans',
  'payments',
  'usage_logs',
  'api_keys'
];

async function exportTable(tableName) {
  console.log(`Exporting table: ${tableName}...`);
  
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*');
    
    if (error) {
      console.error(`Error exporting ${tableName}:`, error);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log(`  Table ${tableName} is empty`);
      return { table: tableName, rows: 0, data: [] };
    }
    
    console.log(`  Exported ${data.length} rows from ${tableName}`);
    return { table: tableName, rows: data.length, data };
  } catch (err) {
    console.error(`Exception exporting ${tableName}:`, err);
    return null;
  }
}

async function exportAllTables() {
  // Create backup directory
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  console.log('========================================');
  console.log('Database Export for Alt-Text Pro');
  console.log('========================================');
  console.log(`Backup Directory: ${BACKUP_DIR}`);
  console.log('');
  
  const exports = {};
  let totalRows = 0;
  
  // Export each table
  for (const table of TABLES) {
    const result = await exportTable(table);
    if (result) {
      exports[table] = result;
      totalRows += result.rows;
    }
  }
  
  // Write JSON export
  const jsonFile = path.join(BACKUP_DIR, 'database-export.json');
  fs.writeFileSync(jsonFile, JSON.stringify(exports, null, 2));
  console.log(`\nJSON export saved to: ${jsonFile}`);
  
  // Write SQL export
  const sqlFile = path.join(BACKUP_DIR, 'database-export.sql');
  let sqlContent = `-- Alt-Text Pro Database Export\n`;
  sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
  sqlContent += `-- Total Tables: ${TABLES.length}\n`;
  sqlContent += `-- Total Rows: ${totalRows}\n\n`;
  
  for (const [tableName, exportData] of Object.entries(exports)) {
    if (exportData.rows === 0) continue;
    
    sqlContent += `\n-- Table: ${tableName} (${exportData.rows} rows)\n`;
    sqlContent += `-- INSERT INTO ${tableName} VALUES\n`;
    
    exportData.data.forEach((row, index) => {
      const values = Object.values(row).map(val => {
        if (val === null) return 'NULL';
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        return val;
      });
      
      const columns = Object.keys(row).join(', ');
      sqlContent += `INSERT INTO ${tableName} (${columns}) VALUES (${values.join(', ')});\n`;
    });
  }
  
  fs.writeFileSync(sqlFile, sqlContent);
  console.log(`SQL export saved to: ${sqlFile}`);
  
  // Create summary
  const summary = {
    exportDate: new Date().toISOString(),
    tables: TABLES.length,
    totalRows: totalRows,
    tablesExported: Object.keys(exports).length,
    details: Object.entries(exports).map(([table, data]) => ({
      table,
      rows: data.rows
    }))
  };
  
  const summaryFile = path.join(BACKUP_DIR, 'export-summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`Summary saved to: ${summaryFile}`);
  
  console.log('\n========================================');
  console.log('Export Complete!');
  console.log('========================================');
  console.log(`Total Tables: ${TABLES.length}`);
  console.log(`Total Rows Exported: ${totalRows}`);
  console.log(`Backup Location: ${BACKUP_DIR}`);
}

// Run export
exportAllTables().catch(console.error);

