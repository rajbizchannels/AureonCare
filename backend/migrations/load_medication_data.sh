#!/bin/bash

# =====================================================
# Load Comprehensive Medication Data
# =====================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Database configuration
DB_NAME="${DB_NAME:-aureoncare_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}AureonCare Medication Data Loader${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if PostgreSQL is accessible
echo -e "${YELLOW}Checking database connection...${NC}"
if ! psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}✗ Cannot connect to database${NC}"
    echo -e "${YELLOW}Please check your database configuration:${NC}"
    echo "  DB_NAME: $DB_NAME"
    echo "  DB_USER: $DB_USER"
    echo "  DB_HOST: $DB_HOST"
    echo "  DB_PORT: $DB_PORT"
    echo ""
    echo "You can set these via environment variables:"
    echo "  export DB_NAME=your_db_name"
    echo "  export DB_USER=your_username"
    exit 1
fi

echo -e "${GREEN}✓ Database connection successful${NC}"
echo ""

# Check if medications table exists
echo -e "${YELLOW}Checking if medications table exists...${NC}"
if ! psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -c "SELECT 1 FROM medications LIMIT 1;" > /dev/null 2>&1; then
    echo -e "${RED}✗ Medications table not found${NC}"
    echo -e "${YELLOW}Please run migration 015 first:${NC}"
    echo "  psql -U $DB_USER -d $DB_NAME -f backend/migrations/015_add_eprescribing_pharmacy_network.sql"
    exit 1
fi

echo -e "${GREEN}✓ Medications table found${NC}"
echo ""

# Check current medication count
CURRENT_COUNT=$(psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM medications WHERE is_active = true;" | tr -d ' ')
echo -e "${BLUE}Current active medications: $CURRENT_COUNT${NC}"
echo ""

# Ask for confirmation
echo -e "${YELLOW}This will add 45+ comprehensive medications to your database.${NC}"
echo -e "${YELLOW}Existing medications will not be affected (ON CONFLICT DO NOTHING).${NC}"
read -p "Do you want to continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Cancelled by user${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}Loading medication data...${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Load the medication data
if psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -f "$SCRIPT_DIR/015_medications_sample_data.sql" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Medication data loaded successfully${NC}"
else
    echo -e "${RED}✗ Failed to load medication data${NC}"
    echo -e "${YELLOW}Check the error messages above for details${NC}"
    exit 1
fi

echo ""

# Check new medication count
NEW_COUNT=$(psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM medications WHERE is_active = true;" | tr -d ' ')
ADDED_COUNT=$((NEW_COUNT - CURRENT_COUNT))

echo -e "${GREEN}✓ Medication data installation complete!${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo "  Previous count: $CURRENT_COUNT"
echo "  Current count:  $NEW_COUNT"
echo "  Added:          $ADDED_COUNT medications"
echo ""

# Show drug class distribution
echo -e "${BLUE}Drug classes available:${NC}"
psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -c "
SELECT
  drug_class,
  COUNT(*) as count,
  STRING_AGG(DISTINCT strength, ', ' ORDER BY strength) as strengths
FROM medications
WHERE is_active = true
GROUP BY drug_class
ORDER BY drug_class;
" 2>/dev/null

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Test the search with these medications:${NC}"
echo "  • lisinopril (ACE Inhibitor)"
echo "  • metformin (Diabetes)"
echo "  • amoxicillin (Antibiotic)"
echo "  • ibuprofen (Pain)"
echo "  • omeprazole (GI)"
echo ""
echo -e "${YELLOW}Tip: Open ePrescribe modal in the app and search for any of these medications${NC}"
echo ""
