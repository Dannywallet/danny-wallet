# Deploy Danny Wallet (Docker + HTTPS อัตโนมัติ)

deploy ครบในคำสั่งเดียวด้วย Docker Compose — มี **app (Next standalone)** + **Caddy (reverse proxy + HTTPS อัตโนมัติ)**

---
## ⚡ ติดตั้งใหม่บน VPS (สคริปต์เดียว) — แนะนำ
VPS เปล่า (Ubuntu) → ใช้ [`setup-vps.sh`](setup-vps.sh) ทำให้ครบ: เปิดไฟร์วอลล์ + (เพิ่ม swap ถ้า RAM น้อย) + ติดตั้ง Docker + สร้าง .env + build + รัน

**ตั้งค่าจริง: โดเมน `dannywallet.com` → VPS 31 IP `31.97.51.253`**
```bash
# 1) ที่ผู้ให้บริการโดเมน — ตั้ง A record ของ apex ให้ชี้มาที่ VPS:
#      @  (dannywallet.com)   A   31.97.51.253
#    รอ DNS propagate (เช็ก: ping dannywallet.com ต้องได้ 31.97.51.253)
#    * อยากได้ www.dannywallet.com ด้วย บอกได้ เดี๋ยวเพิ่ม redirect → apex ใน Caddyfile

# 2) นำโค้ดขึ้น VPS (เลือกอย่างใดอย่างหนึ่ง)
#    A. จากเครื่องคุณ:
scp -r "danny-wallet" root@31.97.51.253:/opt/danny-wallet
#    B. หรือ git (หลัง push ขึ้น GitHub):
ssh root@31.97.51.253 'git clone <repo> /opt/danny-wallet'

# 3) SSH เข้า VPS แล้วรันสคริปต์ (รอบแรก: ติดตั้ง Docker + สร้าง .env)
ssh root@31.97.51.253
cd /opt/danny-wallet && bash setup-vps.sh

# 4) แก้ .env
nano .env
#   DOMAIN=dannywallet.com
#   LISTING_ADMIN_KEY=<ค่าลับของคุณ>
#   NEXT_PUBLIC_WC_PROJECT_ID=<ของคุณ ถ้าใช้>

# 5) รันสคริปต์ซ้ำ (build + start)
bash setup-vps.sh
```
→ เปิด **https://dannywallet.com** ได้เลย (เด้งเข้า `/wallet` อัตโนมัติ · Caddy ออก cert ให้เอง) ✅

> 📌 ต้อง **ชี้ A record `dannywallet.com` → `31.97.51.253` ก่อน** แล้วค่อยรันรอบสอง — Caddy ต้อง verify โดเมนถึงจะออก HTTPS ได้

---
## 0) เตรียม (ครั้งเดียว)
- VPS: **Hostinger KVM 1 (4GB)** ขึ้นไป · **Ubuntu 22.04 LTS** (หรือ 24.04 ก็ได้ — ผลเหมือนกัน)
- โดเมน: ชี้ **A record** ของ `wallet.yourdomain.com` มาที่ **IP ของ VPS**

## 1) ติดตั้ง Docker บน VPS (Ubuntu 22.04)
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # ออก/เข้า SSH ใหม่หลังคำสั่งนี้
```

## 2) อัปโค้ดขึ้น VPS
```bash
# วิธี A: git
git clone <repo> /opt/danny-wallet && cd /opt/danny-wallet
# วิธี B: จากเครื่องคุณ (scp ทั้งโฟลเดอร์ danny-wallet)
```

## 3) ตั้งค่า .env
แก้ไฟล์ `.env`:
```
NEXT_PUBLIC_WC_PROJECT_ID="<project id ของคุณ>"
LISTING_ADMIN_KEY="<ค่าลับ — อย่าใช้ค่า default>"
LISTING_NOTIFY_WEBHOOK=""              # ใส่ webhook Discord/Slack ถ้าต้องการแจ้งเตือน
DOMAIN=wallet.yourdomain.com           # โดเมนจริงที่ชี้มาที่ VPS แล้ว
```

## 4) รัน (คำสั่งเดียว)
```bash
docker compose up -d --build
```
- Caddy จะออก **cert HTTPS (Let's Encrypt)** ให้อัตโนมัติภายในไม่กี่วินาที
- เปิด **https://wallet.yourdomain.com** ได้เลย ✅

## คำสั่งที่ใช้บ่อย
```bash
docker compose logs -f app        # ดู log
docker compose ps                 # สถานะ
docker compose down               # หยุด
docker compose up -d --build      # อัปเดต/รีบิวด์หลังแก้โค้ด
```

## ข้อมูลถาวร & สำรอง
- คำขอลงลิสต์ + โลโก้ที่อนุมัติเก็บใน **`./data`** (mount เป็น volume — ไม่หายตอน rebuild)
- สำรอง: `tar czf data-backup.tgz data/`

## CI/CD — GitHub Actions (อัตโนมัติ)
มี 2 workflow ใน `.github/workflows/`:

### 1) `deploy.yml` — push เข้า `main` → auto-deploy ขึ้น VPS
ตั้ง **Secrets** ที่ repo → Settings → Secrets and variables → Actions:
| Secret | ค่า |
|---|---|
| `VPS_HOST` | IP ของ VPS |
| `VPS_USER` | ผู้ใช้ SSH (เช่น `root` หรือ user สำหรับ deploy) |
| `VPS_SSH_KEY` | private key (ทั้งไฟล์) ที่ public key ฝั่งตรงข้ามอยู่ใน VPS |
| `VPS_PATH` | path โปรเจกต์บน VPS เช่น `/opt/danny-wallet` |
| `VPS_PORT` | (ออปชัน) พอร์ต SSH ถ้าไม่ใช่ 22 |

> เงื่อนไข: VPS ต้อง `git clone` โปรเจกต์ไว้ที่ `VPS_PATH` + มี Docker แล้ว → ทุกครั้งที่ push, CI จะ SSH เข้าไป `git pull && docker compose up -d --build`

### 2) `build-desktop.yml` — push tag `v*` (เช่น `v1.0.0`) → build installer .exe
- รันบน **Windows runner ของ GitHub** → **ไม่ติดปัญหา winCodeSign symlink** ที่เจอในเครื่อง local!
- ได้ `Danny Wallet Setup.exe` + portable เป็น **artifact** ดาวน์โหลดจากหน้า run
- ไม่ต้องตั้ง secret ใด ๆ (unsigned build)
- สั่งทำ: `git tag v1.0.0 && git push --tags`

## หมายเหตุ
- **HTTPS จำเป็น** — WebCrypto (สร้าง/ปลดล็อกกระเป๋า) ใช้ได้เฉพาะ secure context
- ถ้าทดสอบในเครื่อง (ยังไม่มีโดเมน) เปลี่ยน `{$DOMAIN}` ใน `Caddyfile` เป็น `:80` แล้วเปิด http://IP (แต่ WebCrypto จะใช้ไม่ได้บน http)
- image ฐาน `node:20-alpine` ถ้าเจอปัญหา native ให้เปลี่ยนเป็น `node:20-slim` ใน `Dockerfile`
