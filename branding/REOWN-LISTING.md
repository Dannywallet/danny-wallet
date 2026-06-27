# Reown / WalletConnect — Wallet Listing Submission

Everything needed to list **Danny Wallet** in the WalletConnect/Reown registry
(the "All Wallets" modal). Submit at **https://cloud.reown.com** → your project →
**Explorer / Submit Wallet** (or https://walletguide.walletconnect.network → Submit).

> You must be logged in to the Reown account that owns the **same Project ID** used in
> the app (`NEXT_PUBLIC_WC_PROJECT_ID`). Reown manually reviews the submission (≈2–7 days).

---

## 📦 Upload asset
- **Logo:** [`danny-wallet-logo-512.png`](./danny-wallet-logo-512.png) — 512×512 PNG, transparent background (ready to upload)

## 📝 Form fields (copy-paste)

| Field | Value |
|---|---|
| **Wallet name** | `Danny Wallet` |
| **Short description** | `Self-custody crypto wallet for Danny Chain` |
| **Description** | `Danny Wallet is a non-custodial, multi-chain crypto wallet built for real-world security on Danny Chain (chainId 5069). Swap on-chain via dandex, connect dApps with WalletConnect, and track live token prices, charts and your portfolio — keys stay encrypted on your device.` |
| **Homepage / Website** | `https://dannywallet.com` |
| **Project ID** | *(your `NEXT_PUBLIC_WC_PROJECT_ID` from cloud.reown.com)* |

## 🔗 Platform: **Web App**
| Field | Value |
|---|---|
| **Webapp URL** | `https://app.dannywallet.com` |
| **Universal link** (WC deep link) | `https://app.dannywallet.com/wallet/connect?uri=` |

> When a dApp launches the wallet, WalletConnect appends the pairing URI:
> `https://app.dannywallet.com/wallet/connect?uri=wc:...` — the app already reads `?uri=`
> (see `src/app/wallet/connect/page.tsx`) and opens the approval screen. ✅

> Leave iOS / Android / Browser-extension platforms empty (Danny Wallet is a web wallet,
> no app-store builds). You can add them later if you publish the Electron/mobile apps.

## ⛓️ Supported chains (CAIP-2)
| Chain | CAIP-2 |
|---|---|
| Danny Chain | `eip155:5069` |

> Note: Danny Chain (5069) is a custom EVM chain. It will list fine, but mainstream
> dApps may filter the wallet list by the chains they support.

---

## ✅ Pre-submit checklist
- [ ] Logged in to Reown with the account that owns the app's Project ID
- [ ] `https://app.dannywallet.com` is publicly reachable over HTTPS (it is)
- [ ] Universal link `…/wallet/connect?uri=` opens the approval screen (test once)
- [ ] In-app WC metadata matches the brand (name/url/icon) — see below
- [ ] Logo uploaded (512×512)

## 🔧 Recommended code tweak before submitting
In `src/lib/wallet/walletconnect.ts` the `metadata` shown to dApps should match the
listing (reviewers check this):

```ts
metadata: {
  name: "Danny Wallet",
  description: "Self-custody wallet for Danny Chain (5069)",
  url: "https://app.dannywallet.com",
  icons: ["https://dannywallet.com/logo-src.png"],
},
```
(current values point at `dannychain.com` / a dannyscan favicon)

---

## After approval
Danny Wallet appears in the **All Wallets** list across every dApp using
WalletConnect/Reown AppKit. No further code change needed.
