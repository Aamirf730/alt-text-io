#!/usr/bin/env node

/**
 * Database Migration Runner for Alt-Text Pro
 * File: supabase-migration/migrate.js
 *
 * Reads SQL files from the migrations directory, tracks applied versions
 * in the `schema_migrations` table, and runs only pending migrations.
 *
 * Usage:
 *   node migrate.js                    # Run pending migrations
 *   node migrate.js --status           # Show migration status
 *   node migrate.js --rollback <ver>   # Mark a migration as rolled back
 *   node migrate.js --register <file>  # Register a file as already applied
 *
 * Environment variables (required):
 *   SUPABASE_URL                - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   - Service role key (not anon key)
 *
 * Migration files must be listed in MIGRATION_ORDER below.
 * New migrations should be appended to the end of the list.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ordered list of migration files.
 * APPEND new migrations to the end. Never reorder or remove entries.
 * The version number is derived from the position (001, 002, ...).
 */
const MIGRATION_ORDER = [
    // Core schema
    'schema.sql',
    'users-table.sql',
    'create-api-keys-table.sql',
    'create-payments-table.sql',

    // Schema additions
    'add-subscription-id-column.sql',
    'add-subscription-status-column.sql',
    'add-missing-profile-columns.sql',
    'add-polar-customer-id.sql',

    // Pricing updates
    'update-plans.sql',
    'update-pricing-2024.sql',
    'update-pricing-to-12-20.sql',
    'update-pricing-2026-lite-standard-pro.sql',
    'update-pricing-polar-migration.sql',

    // Credit system
    'fix-credit-calculation.sql',
    'fix-credit-deduction-bug.sql',
    'improve-use-credit-atomic.sql',
    'update-free-credits-to-30.sql',
    'update-free-credits-to-50.sql',
    'update_pay_as_go_credits.sql',
    'add-launch-credits.sql',

    // Monthly renewal
    'add-monthly-drip.sql',
    'add-monthly-renewal-system.sql',
    'reset-total-processed-on-upgrade.sql',

    // Performance
    'add-performance-indexes.sql',

    // Marketing automation
    'add-marketing-events.sql',
    'add-marketing-automation-sends.sql',
];

const MIGRATIONS_DIR = __dirname;

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE CLIENT
// ─────────────────────────────────────────────────────────────────────────────

function getClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.error('❌ Missing environment variables:');
        if (!url) console.error('   SUPABASE_URL');
        if (!key) console.error('   SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function versionFromIndex(i) {
    return String(i + 1).padStart(3, '0');
}

function fileChecksum(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

async function getAppliedMigrations(supabase) {
    const { data, error } = await supabase
        .from('schema_migrations')
        .select('version, name, applied_at, rolled_back_at, checksum')
        .order('version', { ascending: true });

    if (error) {
        // Table might not exist yet
        if (error.code === '42P01') {
            console.log('⚠️  schema_migrations table not found. Creating it...');
            return [];
        }
        throw new Error(`Failed to read migrations: ${error.message}`);
    }

    return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

async function showStatus() {
    const supabase = getClient();
    const applied = await getAppliedMigrations(supabase);
    const appliedMap = new Map(applied.map((m) => [m.version, m]));

    console.log('\n📋 Migration Status\n');
    console.log('Ver   Status       File                                    Applied At');
    console.log('───   ──────       ────                                    ──────────');

    for (let i = 0; i < MIGRATION_ORDER.length; i++) {
        const ver = versionFromIndex(i);
        const file = MIGRATION_ORDER[i];
        const record = appliedMap.get(ver);

        let status, appliedAt;
        if (!record) {
            status = '⬜ pending';
            appliedAt = '';
        } else if (record.rolled_back_at) {
            status = '🔄 rolled back';
            appliedAt = record.rolled_back_at.slice(0, 19);
        } else {
            status = '✅ applied';
            appliedAt = record.applied_at.slice(0, 19);
        }

        console.log(
            `${ver}   ${status.padEnd(14)} ${file.padEnd(40)} ${appliedAt}`
        );
    }

    const pending = MIGRATION_ORDER.length - applied.filter((m) => !m.rolled_back_at).length;
    console.log(`\n${applied.filter((m) => !m.rolled_back_at).length} applied, ${pending} pending\n`);
}

async function runMigrations() {
    const supabase = getClient();
    const applied = await getAppliedMigrations(supabase);
    const appliedVersions = new Set(
        applied.filter((m) => !m.rolled_back_at).map((m) => m.version)
    );

    const pending = [];
    for (let i = 0; i < MIGRATION_ORDER.length; i++) {
        const ver = versionFromIndex(i);
        if (!appliedVersions.has(ver)) {
            pending.push({ version: ver, file: MIGRATION_ORDER[i], index: i });
        }
    }

    if (pending.length === 0) {
        console.log('✅ All migrations are up to date.');
        return;
    }

    console.log(`\n🚀 Running ${pending.length} pending migration(s)...\n`);

    for (const migration of pending) {
        const filePath = path.join(MIGRATIONS_DIR, migration.file);

        if (!fs.existsSync(filePath)) {
            console.error(`❌ File not found: ${migration.file}`);
            process.exit(1);
        }

        const sql = fs.readFileSync(filePath, 'utf8');
        const checksum = fileChecksum(filePath);

        console.log(`  [${migration.version}] ${migration.file}...`);
        const start = Date.now();

        try {
            const { error } = await supabase.rpc('exec_sql', { query: sql });

            if (error) {
                // Fallback: try direct REST SQL execution
                // Note: RPC exec_sql may not exist; in that case, migrations
                // need to be run via Supabase Dashboard SQL Editor or CLI
                console.error(`  ❌ Failed: ${error.message}`);
                console.error(`     Run this file manually in Supabase SQL Editor.`);
                process.exit(1);
            }

            const elapsed = Date.now() - start;

            // Record in tracking table
            const { error: insertError } = await supabase
                .from('schema_migrations')
                .upsert({
                    version: migration.version,
                    name: migration.file,
                    checksum,
                    execution_time_ms: elapsed,
                    applied_at: new Date().toISOString(),
                    rolled_back_at: null,
                });

            if (insertError) {
                console.warn(`  ⚠️  Applied but failed to record: ${insertError.message}`);
            }

            console.log(`  ✅ Done (${elapsed}ms)`);
        } catch (err) {
            console.error(`  ❌ Error: ${err.message}`);
            process.exit(1);
        }
    }

    console.log(`\n✅ ${pending.length} migration(s) applied successfully.\n`);
}

async function registerMigration(fileName) {
    const index = MIGRATION_ORDER.indexOf(fileName);
    if (index === -1) {
        console.error(`❌ "${fileName}" not found in MIGRATION_ORDER.`);
        process.exit(1);
    }

    const ver = versionFromIndex(index);
    const filePath = path.join(MIGRATIONS_DIR, fileName);
    const checksum = fs.existsSync(filePath) ? fileChecksum(filePath) : 'manual';

    const supabase = getClient();
    const { error } = await supabase.from('schema_migrations').upsert({
        version: ver,
        name: fileName,
        checksum,
        execution_time_ms: 0,
        applied_at: new Date().toISOString(),
        rolled_back_at: null,
    });

    if (error) {
        console.error(`❌ Failed to register: ${error.message}`);
        process.exit(1);
    }

    console.log(`✅ Registered ${fileName} as version ${ver}`);
}

async function rollbackMigration(version) {
    const supabase = getClient();
    const { error } = await supabase
        .from('schema_migrations')
        .update({ rolled_back_at: new Date().toISOString() })
        .eq('version', version);

    if (error) {
        console.error(`❌ Failed to rollback: ${error.message}`);
        process.exit(1);
    }

    console.log(`🔄 Marked version ${version} as rolled back.`);
    console.log(`   Note: You must manually undo the SQL changes.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);

    try {
        if (args.includes('--status')) {
            await showStatus();
        } else if (args.includes('--register')) {
            const file = args[args.indexOf('--register') + 1];
            if (!file) {
                console.error('Usage: node migrate.js --register <filename.sql>');
                process.exit(1);
            }
            await registerMigration(file);
        } else if (args.includes('--rollback')) {
            const ver = args[args.indexOf('--rollback') + 1];
            if (!ver) {
                console.error('Usage: node migrate.js --rollback <version>');
                process.exit(1);
            }
            await rollbackMigration(ver);
        } else if (args.includes('--register-all')) {
            // Register all existing migrations as applied (for existing databases)
            console.log('📝 Registering all migrations as already applied...\n');
            for (let i = 0; i < MIGRATION_ORDER.length; i++) {
                await registerMigration(MIGRATION_ORDER[i]);
            }
            console.log('\n✅ All migrations registered.');
        } else if (args.includes('--help')) {
            console.log(`
Alt-Text Pro Migration Runner

Usage:
  node migrate.js                    Run pending migrations
  node migrate.js --status           Show migration status
  node migrate.js --register <file>  Register a file as already applied
  node migrate.js --register-all     Register ALL files as already applied
  node migrate.js --rollback <ver>   Mark a version as rolled back
  node migrate.js --help             Show this help

Environment:
  SUPABASE_URL                 Supabase project URL (required)
  SUPABASE_SERVICE_ROLE_KEY    Service role key (required)
      `);
        } else {
            await runMigrations();
        }
    } catch (err) {
        console.error(`\n❌ Fatal error: ${err.message}`);
        process.exit(1);
    }
}

main();
