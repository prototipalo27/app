#!/bin/bash
set -e

# Create n8n database (evolution db is created by default via POSTGRES_DB)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE n8n;
EOSQL
