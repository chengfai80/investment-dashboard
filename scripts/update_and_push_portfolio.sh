#!/bin/bash
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_dir"
export FUTU_SECURITY_FIRM=FUTUMY
export DISPLAY=:0

# Ensure GitHub CLI is available in non-interactive shells such as cron.
export PATH="$HOME/.npm-global/bin:$PATH"

# Use the already-authenticated GitHub CLI / git credential helper.
git remote set-url origin "https://github.com/chengfai80/investment-dashboard.git"

# Sync with upstream first so the push doesn't fail on non-fast-forward.
git pull --rebase --autostash origin main

# 1. Update the HTML locally by pulling data from OpenD
python3 "$repo_dir/scripts/generate_dashboard.py"

# 2. Push the updated HTML to GitHub
git add portfolio.html
if git diff --cached --quiet; then
    echo "No changes to portfolio."
else
    git commit -m "Auto-update Portfolio with live Moomoo data - $(date '+%Y-%m-%d %H:%M MYT')"
    git push origin main

    # 3. Trigger the GitHub Action to rebuild GitHub Pages immediately
    gh api -X POST \
      repos/chengfai80/investment-dashboard/actions/workflows/refresh-dashboard.yml/dispatches \
      -f ref=main

    echo "Triggered GitHub Pages deployment."
fi
