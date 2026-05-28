#!/usr/bin/env bash
set -euo pipefail

backup_dir="backups/d1"
mkdir -p "$backup_dir"

npx wrangler d1 export DB --remote --output "$backup_dir/dailytally2-$(date +%Y%m%d-%H%M%S).sql"
