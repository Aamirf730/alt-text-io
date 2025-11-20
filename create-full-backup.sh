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

# Create backup directory structure
mkdir -p "${BACKUP_PATH}"
mkdir -p "${BACKUP_PATH}/database"
mkdir -p "${BACKUP_PATH}/codebase"
mkdir -p "${BACKUP_PATH}/plugin"

echo -e "${YELLOW}[1/5] Creating backup manifest...${NC}"

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
Tables: profiles, subscription_plans, payments, usage_logs, api_keys
EOF

echo -e "${YELLOW}[2/5] Archiving codebase...${NC}"

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

echo -e "${YELLOW}[3/5] Creating plugin archive...${NC}"

# Create separate plugin archive
cd "${PROJECT_ROOT}/wordpress-plugin"
if [ -d "alt-text-ai" ]; then
  tar -czf "${BACKUP_PATH}/plugin/wordpress-plugin.tar.gz" \
      alt-text-ai/ \
      2>/dev/null && echo "Plugin archive created successfully" || echo "Note: Plugin archive created with warnings"
else
  echo "Warning: alt-text-ai directory not found"
fi

echo -e "${YELLOW}[4/5] Creating database export documentation...${NC}"

# Ensure database directory exists
mkdir -p "${BACKUP_PATH}/database"

# Create database export info
cat > "${BACKUP_PATH}/database/DATABASE_EXPORT_INFO.txt" << EOF
========================================
Database Export Information
========================================

Supabase Project ID: ${SUPABASE_PROJECT_ID}
Export Date: $(date)

=== TABLES TO EXPORT ===
1. profiles - User profiles and subscription data
2. subscription_plans - Available subscription plans
3. payments - Payment transaction records
4. usage_logs - Alt-text generation usage logs
5. api_keys - API keys for WordPress plugin

=== EXPORT METHODS ===
1. Use Supabase Dashboard:
   - Go to: https://app.supabase.com/project/${SUPABASE_PROJECT_ID}
   - Navigate to Database > Backups
   - Create a point-in-time backup

2. Use Supabase CLI:
   supabase db dump -f database-export.sql

3. Use pg_dump (if you have direct database access):
   pg_dump -h db.${SUPABASE_PROJECT_ID}.supabase.co -U postgres -d postgres > database-export.sql

=== IMPORTANT NOTES ===
- Database exports contain sensitive user data
- Keep backups secure and encrypted
- Do not commit database exports to version control
- Test restoration on a development environment first

=== MIGRATION FILES ===
All database migrations are included in:
- supabase-migration/ directory
- These can be used to recreate the schema

EOF

# Copy migration files to database folder
cd "${PROJECT_ROOT}"
if [ -d "supabase-migration" ]; then
  cp -r supabase-migration "${BACKUP_PATH}/database/" 2>/dev/null && echo "Migration files copied" || echo "Note: Could not copy migration files"
fi

echo -e "${YELLOW}[5/5] Creating final backup package...${NC}"

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
3. database/ - Database export information and migrations
4. MANIFEST.txt - Backup manifest
5. BACKUP_INFO.txt - This file

=== RESTORATION INSTRUCTIONS ===

1. Extract codebase:
   cd /path/to/restore
   tar -xzf codebase/codebase.tar.gz

2. Extract plugin:
   cd /path/to/wordpress/wp-content/plugins
   tar -xzf plugin/wordpress-plugin.tar.gz

3. Restore database:
   - Use Supabase dashboard to restore from backup, OR
   - Apply migrations from database/supabase-migration/
   - See database/DATABASE_EXPORT_INFO.txt for details

4. Set up environment variables:
   - See ENVIRONMENT_VARIABLES.md for required variables
   - Configure in Netlify dashboard for production
   - Set up local .env file for development

5. Install dependencies:
   npm install
   cd netlify-functions && npm install && cd ..
   cd frontend && yarn install && cd ..

6. Build frontend:
   cd frontend && yarn build && cd ..

=== IMPORTANT NOTES ===
- Environment variables are NOT included (security)
- node_modules must be reinstalled: npm install
- Database credentials must be reconfigured
- PayPal credentials must be set in Netlify dashboard
- Test restoration on a development environment first

=== PROJECT DETAILS ===
- Website: https://www.alt-text.pro
- Supabase Project: ${SUPABASE_PROJECT_ID}
- Netlify Site: alt-text-ai
- Repository: Check git remote for URL

=== BACKUP STATISTICS ===
Generated: $(date)
Backup Location: ${BACKUP_PATH}

EOF

# Create final compressed archive
cd "${BACKUP_DIR}"
echo "Creating final compressed archive..."
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
echo "1. Review the backup contents in: ${BACKUP_PATH}"
echo "2. Store the archive (${BACKUP_NAME}.tar.gz) in a safe location"
echo "3. Export database using Supabase dashboard or CLI"
echo "4. Test restoration on a development environment"
echo ""

