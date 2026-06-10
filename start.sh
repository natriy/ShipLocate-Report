#!/bin/bash

# --- Color definitions ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0;3m' # No Color
BOLD='\033[1m'

echo -e "${BOLD}${BLUE}===============================================${NC}"
echo -e "${BOLD}${PURPLE}          STARTING SHIPLOCATE SYSTEM           ${NC}"
echo -e "${BOLD}${BLUE}===============================================${NC}"
echo ""

# 1. Update data from live database
echo -e "${BOLD}${YELLOW}[1/2] Updating data from database...${NC}"
if python3 prepare_frontend_data.py; then
  echo -e "${GREEN}✓ Data successfully updated!${NC}"
else
  echo -e "${RED}✗ Failed to update data from database.${NC}"
  echo -e "${YELLOW}Do you want to start the frontend anyway using cached data? (y/n)${NC}"
  read -r response
  if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo -e "${RED}Aborting.${NC}"
    exit 1
  fi
fi

echo ""

# 2. Start React frontend
echo -e "${BOLD}${YELLOW}[2/2] Launching React frontend...${NC}"
cd reports-frontend || { echo -e "${RED}Error: reports-frontend directory not found!${NC}"; exit 1; }

# Start dev server
npm run dev
