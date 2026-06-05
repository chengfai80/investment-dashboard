# MEMORY

## Portfolio / TA automation
- The daily portfolio updater needs a stable non-interactive PATH because `gh` may not be on PATH in cron shells. Add `export PATH="$HOME/.npm-global/bin:$PATH"` before calling `gh api`.
- `scripts/update_and_push_portfolio.sh` should keep using `cd /home/chengfai/.openclaw/workspace && bash ./scripts/update_and_push_portfolio.sh` to avoid allowlist/path mismatches.
- The portfolio page now includes a live **Technical Analysis for Holdings** section; the TA block is built from current holdings, not a separate static watchlist.
- Holdings TA mapping currently includes: NVDA, CSCO, YTLPOWR, GAMUDA, 99SMART, PBBANK, MAYBANK, KOPI, INARI, and Maxis (`MY.6012` / `6012.KL`).
- `AQUAWALK` is intentionally skipped in portfolio holdings updates because it was sold.

## TA refresh scripts
- `update_ta.py` originally used only `range=1mo`, which could yield ~22 bars and cause all TA rows to be skipped; changing to `3mo` made the TA section render reliably.
- The TA updater should treat warnings as non-fatal and only fail on a non-zero exit code or a real traceback/error.
- Cron failures labeled as “allowlist miss” are execution-policy issues, not OpenD connectivity issues.
- OpenD can be running and connected while the cron TA job still fails because the job itself is blocked by allowlist or runtime restrictions.
- Both TA updaters were manually rerun successfully on the shell, confirming the scripts themselves can work when the environment is correct.

## Cron delivery behavior
- The daily TA cron job should announce success to Telegram only when the updater truly succeeds.
- Failure notices should be short and specific; avoid reporting a failure when the underlying run was only a warning or a temporary environment mismatch.
- The TA cron job had a real failure mode where manual reruns could still hit an `exec denied: allowlist miss` even after the script itself had been verified.
- After the allowlist issue was corrected, the manual rerun succeeded again.

## Dashboard generation
- `scripts/generate_dashboard.py` uses a `3mo` TA window so the dashboard’s TA section stays populated.
- The dashboard’s TA section is separate from the portfolio page; one can be healthy while the other is missing sections if the generator logic differs.

## Daily portfolio cron fix
- The daily portfolio update failed again because the cron job had drifted back to `sessionTarget: main` vs `isolated` behavior in the scheduler state; the real failure was `exec denied: allowlist miss` from the isolated agent path, not OpenD or the script itself.
- Permanent fix: keep the portfolio job as a **main-session systemEvent** that runs `cd /home/chengfai/.openclaw/workspace && bash ./scripts/update_and_push_portfolio.sh`, so it uses the normal exec path and avoids isolated allowlist misses.

## Financial tracker idle logout
- The financial tracker app now uses a simple `last_activity_ts` idle timer instead of `streamlit_autorefresh` + fingerprint-based reruns.
- Real user actions call `mark_activity()`, and the app logs out only after 5 minutes of true inactivity.
