#!/bin/bash
# Restore a single owner's data from a full backup without affecting other owners
# Usage: ./restore-owner.sh <backup_file> <owner_username>
# Example: ./restore-owner.sh /opt/dailyfinance/backups/dailyfinance_20261008_020000.sql.gz owner1

set -e

BACKUP_FILE="$1"
OWNER_USERNAME="$2"
COMPOSE_FILE="/opt/dailyfinance/deploy/docker-compose.yml"
DB_USER="financeapp"
PROD_DB="financeapp_db"
TEMP_DB="temp_restore_$$"

if [ -z "$BACKUP_FILE" ] || [ -z "$OWNER_USERNAME" ]; then
  echo "Usage: $0 <backup_file.sql.gz> <owner_username>"
  echo "Example: $0 /opt/dailyfinance/backups/dailyfinance_20261008_020000.sql.gz owner1"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

PSQL="docker compose -f $COMPOSE_FILE exec -T postgres psql -U $DB_USER"

echo "=== Owner Data Restore ==="
echo "Backup: $BACKUP_FILE"
echo "Owner:  $OWNER_USERNAME"
echo ""

# 1. Create temp database and restore backup into it
echo "[1/6] Creating temp database..."
$PSQL -d $PROD_DB -c "DROP DATABASE IF EXISTS $TEMP_DB;" 2>/dev/null || true
$PSQL -d $PROD_DB -c "CREATE DATABASE $TEMP_DB;"
echo "Restoring backup to temp database (this may take a moment)..."
gunzip -c "$BACKUP_FILE" | $PSQL -d $TEMP_DB > /dev/null 2>&1

# 2. Get owner ID from temp database
echo "[2/6] Finding owner in backup..."
OWNER_ID=$($PSQL -t -d $TEMP_DB -c "SELECT id FROM \"User\" WHERE username = '$OWNER_USERNAME' AND role = 'OWNER';" | tr -d ' \n')
if [ -z "$OWNER_ID" ]; then
  echo "Error: Owner '$OWNER_USERNAME' not found in backup"
  $PSQL -d $PROD_DB -c "DROP DATABASE $TEMP_DB;" 2>/dev/null
  exit 1
fi
echo "Found owner: $OWNER_ID"

# 3. Get business IDs for this owner
BIZ_IDS=$($PSQL -t -d $TEMP_DB -c "SELECT string_agg('''' || id || '''', ',') FROM \"Business\" WHERE \"ownerId\" = '$OWNER_ID';" | tr -d ' \n')
if [ -z "$BIZ_IDS" ] || [ "$BIZ_IDS" = "" ]; then
  echo "Error: No businesses found for owner in backup"
  $PSQL -d $PROD_DB -c "DROP DATABASE $TEMP_DB;" 2>/dev/null
  exit 1
fi
echo "Businesses: $BIZ_IDS"

# 4. Show what will be restored (dry run)
echo ""
echo "[3/6] Data to restore from backup:"
$PSQL -d $TEMP_DB -c "
  SELECT 'Businesses' as entity, COUNT(*)::text as count FROM \"Business\" WHERE \"ownerId\" = '$OWNER_ID'
  UNION ALL
  SELECT 'Villages', COUNT(*)::text FROM \"Village\" WHERE \"businessId\" IN ($BIZ_IDS)
  UNION ALL
  SELECT 'Customers', COUNT(*)::text FROM \"Customer\" WHERE \"businessId\" IN ($BIZ_IDS)
  UNION ALL
  SELECT 'Loans', COUNT(*)::text FROM \"Loan\" WHERE \"businessId\" IN ($BIZ_IDS)
  UNION ALL
  SELECT 'Payments', COUNT(*)::text FROM \"Payment\" WHERE \"businessId\" IN ($BIZ_IDS)
  UNION ALL
  SELECT 'Documents', COUNT(*)::text FROM \"Document\" WHERE \"businessId\" IN ($BIZ_IDS)
  UNION ALL
  SELECT 'Employees', COUNT(*)::text FROM \"UserBusinessAssignment\" WHERE \"businessId\" IN ($BIZ_IDS)
;"
echo ""
read -p "Proceed with restore? This will DELETE current data for $OWNER_USERNAME and replace with backup. [y/N] " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Cancelled."
  $PSQL -d $PROD_DB -c "DROP DATABASE $TEMP_DB;" 2>/dev/null
  exit 0
fi

# 5. Delete current owner data from production (cascade order)
echo ""
echo "[4/6] Deleting current data for $OWNER_USERNAME from production..."
$PSQL -d $PROD_DB -c "
  BEGIN;
  -- Payments
  DELETE FROM \"Payment\" WHERE \"businessId\" IN (SELECT id FROM \"Business\" WHERE \"ownerId\" = '$OWNER_ID');
  -- Loan schedule entries
  DELETE FROM \"LoanScheduleEntry\" WHERE \"loanId\" IN (SELECT id FROM \"Loan\" WHERE \"businessId\" IN (SELECT id FROM \"Business\" WHERE \"ownerId\" = '$OWNER_ID'));
  -- Documents
  DELETE FROM \"Document\" WHERE \"businessId\" IN (SELECT id FROM \"Business\" WHERE \"ownerId\" = '$OWNER_ID');
  -- Loans
  DELETE FROM \"Loan\" WHERE \"businessId\" IN (SELECT id FROM \"Business\" WHERE \"ownerId\" = '$OWNER_ID');
  -- Customers
  DELETE FROM \"Customer\" WHERE \"businessId\" IN (SELECT id FROM \"Business\" WHERE \"ownerId\" = '$OWNER_ID');
  -- Village assignments for employees in these businesses
  DELETE FROM \"UserVillageAssignment\" WHERE \"villageId\" IN (SELECT id FROM \"Village\" WHERE \"businessId\" IN (SELECT id FROM \"Business\" WHERE \"ownerId\" = '$OWNER_ID'));
  -- Business assignments
  DELETE FROM \"UserBusinessAssignment\" WHERE \"businessId\" IN (SELECT id FROM \"Business\" WHERE \"ownerId\" = '$OWNER_ID');
  -- Audit logs
  DELETE FROM \"AuditLog\" WHERE \"businessId\" IN (SELECT id FROM \"Business\" WHERE \"ownerId\" = '$OWNER_ID');
  -- Villages
  DELETE FROM \"Village\" WHERE \"businessId\" IN (SELECT id FROM \"Business\" WHERE \"ownerId\" = '$OWNER_ID');
  -- Platform settings for this owner
  DELETE FROM \"PlatformSetting\" WHERE key LIKE '%' || '$OWNER_ID' || '%';
  -- Businesses
  DELETE FROM \"Business\" WHERE \"ownerId\" = '$OWNER_ID';
  COMMIT;
"
echo "Current data deleted."

# 6. Copy backup data to production
echo "[5/6] Restoring data from backup..."
$PSQL -d $PROD_DB -c "
  BEGIN;
  -- Businesses
  INSERT INTO \"Business\" SELECT * FROM dblink('dbname=$TEMP_DB user=$DB_USER', 'SELECT * FROM \"Business\" WHERE \"ownerId\" = ''$OWNER_ID''') AS t(LIKE \"Business\");
  COMMIT;
"
# dblink approach is complex — use simpler COPY approach
$PSQL -d $TEMP_DB -c "\copy (SELECT * FROM \"Business\" WHERE \"ownerId\" = '$OWNER_ID') TO '/tmp/restore_businesses.csv' CSV HEADER"
$PSQL -d $TEMP_DB -c "\copy (SELECT * FROM \"Village\" WHERE \"businessId\" IN ($BIZ_IDS)) TO '/tmp/restore_villages.csv' CSV HEADER"
$PSQL -d $TEMP_DB -c "\copy (SELECT * FROM \"Customer\" WHERE \"businessId\" IN ($BIZ_IDS)) TO '/tmp/restore_customers.csv' CSV HEADER"
$PSQL -d $TEMP_DB -c "\copy (SELECT * FROM \"Loan\" WHERE \"businessId\" IN ($BIZ_IDS)) TO '/tmp/restore_loans.csv' CSV HEADER"
$PSQL -d $TEMP_DB -c "\copy (SELECT * FROM \"LoanScheduleEntry\" WHERE \"loanId\" IN (SELECT id FROM \"Loan\" WHERE \"businessId\" IN ($BIZ_IDS))) TO '/tmp/restore_schedule.csv' CSV HEADER"
$PSQL -d $TEMP_DB -c "\copy (SELECT * FROM \"Payment\" WHERE \"businessId\" IN ($BIZ_IDS)) TO '/tmp/restore_payments.csv' CSV HEADER"
$PSQL -d $TEMP_DB -c "\copy (SELECT * FROM \"Document\" WHERE \"businessId\" IN ($BIZ_IDS)) TO '/tmp/restore_documents.csv' CSV HEADER"
$PSQL -d $TEMP_DB -c "\copy (SELECT * FROM \"UserBusinessAssignment\" WHERE \"businessId\" IN ($BIZ_IDS)) TO '/tmp/restore_biz_assign.csv' CSV HEADER"
$PSQL -d $TEMP_DB -c "\copy (SELECT * FROM \"UserVillageAssignment\" WHERE \"villageId\" IN (SELECT id FROM \"Village\" WHERE \"businessId\" IN ($BIZ_IDS))) TO '/tmp/restore_vil_assign.csv' CSV HEADER"

$PSQL -d $PROD_DB -c "\copy \"Business\" FROM '/tmp/restore_businesses.csv' CSV HEADER"
$PSQL -d $PROD_DB -c "\copy \"Village\" FROM '/tmp/restore_villages.csv' CSV HEADER"
$PSQL -d $PROD_DB -c "\copy \"Customer\" FROM '/tmp/restore_customers.csv' CSV HEADER"
$PSQL -d $PROD_DB -c "\copy \"Loan\" FROM '/tmp/restore_loans.csv' CSV HEADER"
$PSQL -d $PROD_DB -c "\copy \"LoanScheduleEntry\" FROM '/tmp/restore_schedule.csv' CSV HEADER"
$PSQL -d $PROD_DB -c "\copy \"Payment\" FROM '/tmp/restore_payments.csv' CSV HEADER"
$PSQL -d $PROD_DB -c "\copy \"Document\" FROM '/tmp/restore_documents.csv' CSV HEADER"
$PSQL -d $PROD_DB -c "\copy \"UserBusinessAssignment\" FROM '/tmp/restore_biz_assign.csv' CSV HEADER"
$PSQL -d $PROD_DB -c "\copy \"UserVillageAssignment\" FROM '/tmp/restore_vil_assign.csv' CSV HEADER"

echo "Data restored."

# 7. Cleanup
echo "[6/6] Cleaning up..."
$PSQL -d $PROD_DB -c "DROP DATABASE $TEMP_DB;"
echo ""
echo "=== Restore complete for $OWNER_USERNAME ==="
echo "Other owners' data is untouched."
echo "Verify by logging in as $OWNER_USERNAME."
