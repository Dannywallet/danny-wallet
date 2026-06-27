# Danny Wallet

A modern crypto wallet (mobile-first · dark/neon) for **Danny Chain (chainId 5069)**.
Pulls **real on-chain data** (tokens / prices / charts / portfolio / transactions) · supports Send / Swap / WalletConnect.
Runs as both a **web app** and a **desktop app (Electron)**.

---

## ✨ Features
- **Wallet** — create/import via **recovery phrase (BIP39)** or **private key** · multi-account (HD + imported)
- **Security** — seed/key encrypted with **AES-256-GCM + PBKDF2 (210k)** · PIN · auto-lock · wipes the wallet after 10 wrong PIN attempts · auto-clears the clipboard after copying a key
- **Real data** — tokens + prices (dandex on-chain) · **OHLC candlestick** chart (scrollable + MA + 1h / 24h / 7d ranges) · portfolio · transactions — from dannyscan / dancharts
- **Transactions** — Send + Swap (dandex router) signed with the in-app key (PIN required) + gas estimation
- **WalletConnect** — connect dApps + auto-handle deep links `?uri=` (registry-ready)
- **In-app explorer** — search addresses/transactions/blocks + dApp browser (falls back to a new tab if the site can't be embedded)

## 🚀 Getting started (web)
```bash
npm install
npm run dev
```
Open http://localhost:3000 (redirects to `/wallet`)

## 🖥️ Desktop (Electron)
```bash
npm run electron:dev      # dev mode (hot-reload)
npm run electron:build    # build .exe installer + portable (see DEPLOY.md re: Developer Mode)
```
Or double-click `dist-electron/win-unpacked/Danny Wallet.exe` (the app bundles its own server — no terminal needed)

> 💡 The easiest way to get a complete .exe installer is via GitHub Actions: `git tag v1.0.0 && git push --tags` → download the artifact

## 🌐 Deploy (production)
Docker + Caddy (automatic HTTPS) — a single command:
```bash
docker compose up -d --build
```
Full details (Hostinger VPS / Ubuntu 22.04 / env / CI) in **[DEPLOY.md](DEPLOY.md)**

## ⚙️ Environment variables (`.env`)
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect Project ID |
| `DOMAIN` | Domain for Caddy/HTTPS (Docker) |

## 📁 Structure
```
src/app/wallet/        app pages (welcome, create, import, unlock, home, asset,
                       send, receive, swap, activity, settings, explorer,
                       connect, tokens, how-to-list)
src/app/api/danny/     server-side proxies (tokens, portfolio, activity, chart,
                       explorer, lookup, contacts, embed-check)
src/components/wallet/  UI (BalanceCard, CandleChart, DappBrowser, AccountSwitcher…)
src/lib/wallet/         logic (wallet-store, crypto, dandex-swap, walletconnect…)
electron/              Electron main + preload + prepare-standalone
Dockerfile · docker-compose.yml · Caddyfile    deploy
```

## 🔒 Security
- All keys live on the user's device (localStorage), encrypted with the PIN — never sent off-device
- Signing decrypts the key with the PIN only at the moment of use
- **Must run over HTTPS or localhost** (WebCrypto only works in a secure context)

## 📜 Scripts
| Command | What it does |
|---|---|
| `npm run dev` | web dev mode (port 3000) |
| `npm run build` / `start` | build / run production |
| `npm run electron:dev` / `electron:build` | desktop dev / build installer |

---
*Danny Chain (5069) · a prototype wired to real on-chain data — signing is done with the user's own key, on-device*
