# Deploy Danny Wallet (Docker + automatic HTTPS)

Full deploy in a single command with Docker Compose — includes the **app (Next standalone)** + **Caddy (reverse proxy + automatic HTTPS)**.

---
## ⚡ Fresh install on a VPS (one script) — recommended
Bare VPS (Ubuntu) → use [`setup-vps.sh`](setup-vps.sh) to do everything: open the firewall + (add swap if RAM is low) + install Docker + create .env + build + run.

**Real setup: domain `dannywallet.com` → VPS IP `31.97.51.253`**
```bash
# 1) At your domain registrar — point the apex A record to the VPS:
#      @  (dannywallet.com)   A   31.97.51.253
#    Wait for DNS to propagate (check: ping dannywallet.com should return 31.97.51.253)
#    * Want www.dannywallet.com too? Ask and we'll add a redirect → apex in the Caddyfile

# 2) Get the code onto the VPS (pick one)
#    A. From your machine:
scp -r "danny-wallet" root@31.97.51.253:/opt/danny-wallet
#    B. Or git (after pushing to GitHub):
ssh root@31.97.51.253 'git clone <repo> /opt/danny-wallet'

# 3) SSH into the VPS and run the script (first pass: install Docker + create .env)
ssh root@31.97.51.253
cd /opt/danny-wallet && bash setup-vps.sh

# 4) Edit .env
nano .env
#   DOMAIN=dannywallet.com
#   LISTING_ADMIN_KEY=<your secret>
#   NEXT_PUBLIC_WC_PROJECT_ID=<yours, if used>

# 5) Run the script again (build + start)
bash setup-vps.sh
```
→ Open **https://dannywallet.com** right away (auto-redirects to `/wallet` · Caddy issues the cert itself) ✅

> 📌 You must **point the A record `dannywallet.com` → `31.97.51.253` first**, then run the second pass — Caddy has to verify the domain before it can issue HTTPS.

---
## 0) Prerequisites (one time)
- VPS: **Hostinger KVM 1 (4GB)** or higher · **Ubuntu 22.04 LTS** (24.04 also works — same result)
- Domain: point the **A record** of `wallet.yourdomain.com` to the **VPS IP**

## 1) Install Docker on the VPS (Ubuntu 22.04)
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out / back in via SSH after this
```

## 2) Get the code onto the VPS
```bash
# Option A: git
git clone <repo> /opt/danny-wallet && cd /opt/danny-wallet
# Option B: from your machine (scp the whole danny-wallet folder)
```

## 3) Configure .env
Edit the `.env` file:
```
NEXT_PUBLIC_WC_PROJECT_ID="<your project id>"
LISTING_ADMIN_KEY="<secret — do not use the default>"
LISTING_NOTIFY_WEBHOOK=""              # add a Discord/Slack webhook if you want notifications
DOMAIN=wallet.yourdomain.com           # the real domain already pointed at the VPS
```

## 4) Run (single command)
```bash
docker compose up -d --build
```
- Caddy issues the **HTTPS cert (Let's Encrypt)** automatically within seconds
- Open **https://wallet.yourdomain.com** right away ✅

## Common commands
```bash
docker compose logs -f app        # view logs
docker compose ps                 # status
docker compose down               # stop
docker compose up -d --build      # update/rebuild after code changes
```

## Persistent data & backups
- Listing requests + approved logos are stored in **`./data`** (mounted as a volume — survives rebuilds)
- Backup: `tar czf data-backup.tgz data/`

## CI/CD — GitHub Actions (automated)
There are 2 workflows in `.github/workflows/`:

### 1) `deploy.yml` — push to `main` → auto-deploy to the VPS
Set **Secrets** at repo → Settings → Secrets and variables → Actions:
| Secret | Value |
|---|---|
| `VPS_HOST` | VPS IP |
| `VPS_USER` | SSH user (e.g. `root` or a deploy user) |
| `VPS_SSH_KEY` | private key (whole file) whose public key is on the VPS |
| `VPS_PATH` | project path on the VPS, e.g. `/opt/danny-wallet` |
| `VPS_PORT` | (optional) SSH port if not 22 |

> Requirement: the VPS must already have the project `git clone`d at `VPS_PATH` + Docker installed → on every push, CI SSHes in and runs `git pull && docker compose up -d --build`

### 2) `build-desktop.yml` — push a `v*` tag (e.g. `v1.0.0`) → build the .exe installer
- Runs on **GitHub's Windows runner** → **avoids the winCodeSign symlink issue** seen on local machines!
- Produces `Danny Wallet Setup.exe` + portable as a downloadable **artifact** on the run page
- No secrets needed (unsigned build)
- Trigger: `git tag v1.0.0 && git push --tags`

## Notes
- **HTTPS is required** — WebCrypto (creating/unlocking the wallet) only works in a secure context
- For local testing (no domain yet), change `{$DOMAIN}` in the `Caddyfile` to `:80` and open http://IP (but WebCrypto won't work over http)
- Base image is `node:20-alpine`; if you hit native-module issues, switch to `node:20-slim` in the `Dockerfile`
