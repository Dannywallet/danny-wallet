# Danny Wallet

กระเป๋าคริปโตดีไซน์ทันสมัย (mobile-first · dark/neon) สำหรับ **Danny Chain (chainId 5069)**
ดึงข้อมูล **on-chain จริง** (token / ราคา / กราฟ / พอร์ต / ธุรกรรม) · รองรับ Send / Swap / WalletConnect / ลงลิสต์โทเคน
ใช้ได้ทั้ง **เว็บ** และ **เดสก์ท็อป (Electron)**

---

## ✨ ฟีเจอร์
- **กระเป๋า** — สร้าง/นำเข้าด้วย **วลีกู้คืน (BIP39)** หรือ **Private Key** · หลายบัญชี (HD + นำเข้า)
- **ความปลอดภัย** — seed/key เข้ารหัส **AES-256-GCM + PBKDF2 (210k)** · PIN · auto-lock · ลบกระเป๋าหลังใส่ PIN ผิด 10 ครั้ง · คัดลอกคีย์แล้วล้างคลิปบอร์ดอัตโนมัติ
- **ข้อมูลจริง** — token + ราคา (dandex on-chain) · กราฟ **แท่งเทียน OHLC** (เลื่อนดูได้ + MA + ช่วง 1ชม./24ชม./7วัน) · พอร์ต · ธุรกรรม — จาก dannyscan / dancharts
- **ธุรกรรม** — Send + Swap (dandex router) ลงนามด้วยกุญแจในแอป (ใส่ PIN) + ประเมินค่าแก๊ส
- **WalletConnect** — เชื่อม dApp ได้ + รับ deep link `?uri=` อัตโนมัติ (พร้อมขึ้นทะเบียน registry)
- **Explorer ในแอป** — ค้นหา ที่อยู่/ธุรกรรม/บล็อก + dApp browser (มี fallback เปิดแท็บใหม่ถ้าเว็บฝังไม่ได้)
- **ลงลิสต์โทเคน** — ฟอร์มให้โปรเจกต์ส่งคำขอ + หน้าแอดมินอนุมัติ → ใส่โลโก้อัตโนมัติ + แจ้งเตือน webhook

## 🚀 เริ่มใช้งาน (เว็บ)
```bash
npm install
npm run dev
```
เปิด http://localhost:3000 (เด้งเข้า `/wallet`)

## 🖥️ เดสก์ท็อป (Electron)
```bash
npm run electron:dev      # โหมดพัฒนา (hot-reload)
npm run electron:build    # สร้าง installer .exe + portable (ดู DEPLOY.md เรื่อง Developer Mode)
```
หรือดับเบิลคลิก `dist-electron/win-unpacked/Danny Wallet.exe` (แอปฝังเซิร์ฟเวอร์ในตัว ไม่ต้องเปิดเทอร์มินัล)

> 💡 ได้ installer .exe ที่สมบูรณ์ง่ายสุดผ่าน GitHub Actions: `git tag v1.0.0 && git push --tags` → ดาวน์โหลด artifact

## 🌐 Deploy (โปรดักชัน)
Docker + Caddy (HTTPS อัตโนมัติ) — คำสั่งเดียว:
```bash
docker compose up -d --build
```
รายละเอียดครบ (Hostinger VPS / Ubuntu 22.04 / env / CI) ดู **[DEPLOY.md](DEPLOY.md)**

## ⚙️ ตัวแปร env (`.env`)
| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect Project ID |
| `LISTING_ADMIN_KEY` | กุญแจหน้าแอดมินลงลิสต์ (⚠️ เปลี่ยนจากค่า default) |
| `LISTING_NOTIFY_WEBHOOK` | แจ้งเตือนคำขอใหม่ (Discord/Slack) |
| `DOMAIN` | โดเมนสำหรับ Caddy/HTTPS (Docker) |

## 📁 โครงสร้าง
```
src/app/wallet/        หน้าแอป (welcome, create, import, unlock, home, asset,
                       send, receive, swap, activity, settings, explorer,
                       connect, tokens, listing, how-to-list, admin/listings)
src/app/api/danny/     proxy ฝั่งเซิร์ฟเวอร์ (tokens, portfolio, activity, chart,
                       explorer, lookup, contacts, listing, embed-check)
src/components/wallet/  UI (BalanceCard, CandleChart, DappBrowser, AccountSwitcher…)
src/lib/wallet/         logic (wallet-store, crypto, dandex-swap, walletconnect…)
electron/              Electron main + preload + prepare-standalone
Dockerfile · docker-compose.yml · Caddyfile    deploy
```

## 🔒 ความปลอดภัย
- คีย์ทั้งหมดอยู่ในเครื่องผู้ใช้ (localStorage) เข้ารหัสด้วย PIN — ไม่ส่งออกนอกเครื่อง
- การลงนามถอดรหัสคีย์ด้วย PIN เฉพาะตอนใช้งาน
- **ต้องรันบน HTTPS หรือ localhost** (WebCrypto ใช้ได้เฉพาะ secure context)

## 📜 สคริปต์
| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | เว็บโหมดพัฒนา (พอร์ต 3000) |
| `npm run build` / `start` | build / รันโปรดักชัน |
| `npm run electron:dev` / `electron:build` | เดสก์ท็อป dev / สร้าง installer |

---
*Danny Chain (5069) · ต้นแบบเชื่อมข้อมูล on-chain จริง — การลงนามทำผ่านกุญแจของผู้ใช้เองในเครื่อง*
