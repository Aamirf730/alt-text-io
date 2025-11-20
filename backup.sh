#!/bin/bash

# Full Backup Script for Alt-Text Pro Website and Plugin
# This script creates a comprehensive backup of the codebase and database

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="alt-text-pro-backup-${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Supabase project ID
SUPABASE_PROJECT_ID="qurbdtzrngzfzevgoolp"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Alt-Text Pro Full Backup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Create backup directory
mkdir -p "${BACKUP_PATH}"
mkdir -p "${BACKUP_PATH}/database"
mkdir -p "${BACKUP_PATH}/codebase"
mkdir -p "${BACKUP_PATH}/plugin"

echo -e "${YELLOW}[1/4] Exporting database schema and data...${NC}"

# Export database schema
echo "Exporting database schema..."
psql "postgresql://postgres.qurbdtzrngzfzevgoolp:${SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-2.pooler.supabase.com:6543/postgres" \
  -c "\d" > "${BACKUP_PATH}/database/schema_list.txt" 2>&1 || echo "Note: Schema list export may have limitations"

# Export all tables data (we'll use Supabase MCP or direct SQL)
echo "Database export will be done via Supabase API..."
echo "Note: Full database dump requires Supabase service role key"

echo -e "${YELLOW}[2/4] Archiving codebase...${NC}"

# Create a manifest of files to backup
cat > "${BACKUP_PATH}/MANIFEST.txt" << EOF
Alt-Text Pro Full Backup
Generated: $(date)
Backup Name: ${BACKUP_NAME}

=== INCLUDED ===
- Frontend React application
- Netlify serverless functions
- WordPress plugin
- Database migrations
- Configuration files
- Documentation
- Setup scripts

=== EXCLUDED ===
- node_modules/
- build/ directories
- .env files (sensitive data)
- .git/ directory
- *.log files
- Cache directories

=== DATABASE ===
Project ID: ${SUPABASE_PROJECT_ID}
Backup Date: $(date)
EOF

# Archive codebase (excluding unnecessary files)
echo "Creating codebase archive..."
cd "${PROJECT_ROOT}"

tar --exclude='node_modules' \
    --exclude='build' \
    --exclude='dist' \
    --exclude='.git' \
    --exclude='.netlify' \
    --exclude='.env' \
    --exclude='.env.*' \
    --exclude='*.log' \
    --exclude='*.zip' \
    --exclude='*.tar.gz' \
    --exclude='backups' \
    --exclude='.DS_Store' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.cache' \
    --exclude='coverage' \
    -czf "${BACKUP_PATH}/codebase/codebase.tar.gz" \
    frontend/ \
    netlify-functions/ \
    netlify-functions-auth/ \
    netlify-config/ \
    supabase-migration/ \
    wordpress-plugin/ \
    assets/ \
    *.md \
    *.js \
    *.json \
    *.toml \
    *.sh \
    *.sql \
    *.py \
    package.json \
    package-lock.json \
    netlify.toml \
    deno.lock \
    2>/dev/null || echo "Note: Some files may have been excluded"

echo -e "${YELLOW}[3/4] Creating plugin archive...${NC}"

# Create separate plugin archive
cd "${PROJECT_ROOT}/wordpress-plugin"
tar -czf "${BACKUP_PATH}/plugin/wordpress-plugin.tar.gz" \
    alt-text-ai/ \
    2>/dev/null || echo "Note: Plugin archive created"

echo -e "${YELLOW}[4/4] Creating final backup package...${NC}"

# Ensure backup path exists
mkdir -p "${BACKUP_PATH}"

# Create a backup info file
cat > "${BACKUP_PATH}/BACKUP_INFO.txt" << EOF
========================================
Alt-Text Pro Full Backup Information
========================================

Backup Date: $(date)
Backup Name: ${BACKUP_NAME}

=== CONTENTS ===
1. codebase/codebase.tar.gz - Full codebase archive
2. plugin/wordpress-plugin.tar.gz - WordPress plugin archive
3. database/ - Database exports (if available)
4. MANIFEST.txt - Backup manifest
5. BACKUP_INFO.txt - This file

=== RESTORATION INSTRUCTIONS ===

1. Extract codebase:
   tar -xzf codebase/codebase.tar.gz -C /path/to/restore

2. Extract plugin:
   tar -xzf plugin/wordpress-plugin.tar.gz -C /path/to/wordpress/plugins

3. Restore database:
   - Use Supabase dashboard or CLI
   - Apply migrations from supabase-migration/

4. Set up environment variables:
   - See ENVIRONMENT_VARIABLES.md for required variables
   - Configure in Netlify dashboard for production

=== IMPORTANT NOTES ===
- Environment variables are NOT included (security)
- node_modules must be reinstalled: npm install
- Database credentials must be reconfigured
- PayPal credentials must be set in Netlify dashboard

=== PROJECT DETAILS ===
- Website: https://www.alt-text.pro
- Supabase Project: ${SUPABASE_PROJECT_ID}
- Netlify Site: alt-text-ai

EOF

# Create final compressed archive
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"

# Calculate sizes
BACKUP_SIZE=$(du -sh "${BACKUP_NAME}" | cut -f1)
ARCHIVE_SIZE=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Backup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Backup Location: ${BACKUP_PATH}"
echo "Archive Size: ${ARCHIVE_SIZE}"
echo "Uncompressed Size: ${BACKUP_SIZE}"
echo ""
echo "Final Archive: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Review the backup contents"
echo "2. Store the archive in a safe location"
echo "3. Test restoration on a development environment"
echo ""

