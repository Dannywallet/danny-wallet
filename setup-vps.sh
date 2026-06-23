#!/usr/bin/env bash
# ติดตั้ง Danny Wallet บน VPS เปล่า (Ubuntu) ด้วย Docker + Caddy (HTTPS อัตโนมัติ)
# รันซ้ำได้ (idempotent): รอบแรกติดตั้ง Docker + สร้าง .env → รอบสองสั่งรัน
#   วิธีใช้:  cd /opt/danny-wallet && bash setup-vps.sh
set -euo pipefail

cd "$(dirname "$0")"
SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"

echo "== Danny Wallet · setup-vps =="

# 1) firewall (ถ้ามี ufw) — เปิด SSH + HTTP + HTTPS
if command -v ufw >/dev/null 2>&1; then
  $SUDO ufw allow OpenSSH >/dev/null 2>&1 || true
  $SUDO ufw allow 80/tcp  >/dev/null 2>&1 || true
  $SUDO ufw allow 443/tcp >/dev/null 2>&1 || true
  echo "✓ เปิดพอร์ต 22/80/443 (ufw)"
fi

# 2) swap (กัน build OOM บน VPS เล็ก) — เพิ่ม 2GB ถ้า RAM < 2GB และยังไม่มี swap
mem_mb=$(free -m | awk '/^Mem:/{print $2}')
if [ "${mem_mb:-9999}" -lt 2000 ] && [ "$(swapon --show | wc -l)" -eq 0 ]; then
  echo "RAM ${mem_mb}MB น้อย → เพิ่ม swap 2GB"
  $SUDO fallocate -l 2G /swapfile && $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile >/dev/null && $SUDO swapon /swapfile
  echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
  echo "✓ เพิ่ม swap แล้ว"
fi

# 3) Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "ติดตั้ง Docker…"
  curl -fsSL https://get.docker.com | $SUDO sh
  $SUDO usermod -aG docker "$USER" || true
  echo "✓ ติดตั้ง Docker แล้ว (อาจต้องออก/เข้า SSH ใหม่ให้กลุ่ม docker มีผล)"
fi

# 4) .env
if [ ! -f .env ]; then
  cp .env.example .env
  cat <<'EOF'

⚠️  สร้างไฟล์ .env แล้ว — กรุณาแก้ค่าต่อไปนี้ก่อนรันสคริปต์ซ้ำ:
    nano .env
      DOMAIN=wallet.โดเมนของคุณ          (ต้องชี้ A record มาที่ IP ของ VPS นี้แล้ว)
      LISTING_ADMIN_KEY=ค่าลับของคุณ      (อย่าใช้ change-me-please)
      NEXT_PUBLIC_WC_PROJECT_ID=...      (WalletConnect — ถ้าใช้)

    แก้เสร็จแล้วรัน:  bash setup-vps.sh
EOF
  exit 0
fi

# 5) ตรวจ DOMAIN ว่าตั้งจริงแล้ว
DOMAIN_VAL="$(grep -E '^DOMAIN=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [ -z "$DOMAIN_VAL" ] || echo "$DOMAIN_VAL" | grep -qi 'example.com'; then
  echo "❌ ยังไม่ได้ตั้ง DOMAIN ใน .env (ตอนนี้: '${DOMAIN_VAL:-ว่าง}') — แก้ก่อนแล้วรันใหม่"
  exit 1
fi

# 6) build + run
echo "DOMAIN = $DOMAIN_VAL → กำลัง build + start…"
$SUDO docker compose up -d --build
$SUDO docker image prune -f >/dev/null 2>&1 || true

echo ""
echo "✅ เสร็จ! เปิด:  https://$DOMAIN_VAL/wallet"
echo "   ดู log:      docker compose logs -f app"
echo "   สถานะ:       docker compose ps"
echo "   (Caddy ออก cert HTTPS อัตโนมัติภายในไม่กี่วินาที — DNS ต้องชี้มาที่ VPS นี้แล้ว)"
