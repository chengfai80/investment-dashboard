#!/bin/bash
cd /home/chengfai/.openclaw/workspace
export FUTU_SECURITY_FIRM=FUTUMY
export DISPLAY=:0

# 1. Update the HTML locally by pulling data from OpenD
python3 scripts/generate_portfolio.py

# 2. Push the updated HTML to GitHub
git add portfolio.html
if git diff --cached --quiet; then
    echo "No changes to portfolio."
else
    git commit -m "Auto-update Portfolio with live Moomoo data - $(date '+%Y-%m-%d %H:%M MYT')"
    git push origin main
    
    # 3. Trigger the GitHub Action to rebuild GitHub Pages immediately
    curl -X POST -H "Accept: application/vnd.github+json" \
         -H "Authorization: Bearer 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" \
         https://api.github.com/repos/chengfai80/investment-dashboard/actions/workflows/refresh-dashboard.yml/dispatches \
         -d '{"ref":"main"}'
         
    echo "Triggered GitHub Pages deployment."
fi
