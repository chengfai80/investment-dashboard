# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share them without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

## Related

- [Agent workspace](/concepts/agent-workspace)

## OpenD / Moomoo
- Local OpenD host: `127.0.0.1`
- OpenD port: `11111`
- OpenD is started by a **systemd user service**:
  - `systemctl --user start moomoo-opend.service`
  - `systemctl --user stop moomoo-opend.service`
  - `systemctl --user status moomoo-opend.service`
- Watchdog timer:
  - `systemctl --user status moomoo-opend-watchdog.timer`
  - checks every 5 minutes and restarts OpenD if port `11111` is down
- Moomoo/OpenD can be connected while cron still fails if the job hits an allowlist or runtime restriction.
