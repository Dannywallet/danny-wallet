# ---------- build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

# ข้ามการดาวน์โหลด binary ของ Electron (ไม่ใช้ใน Docker — เซิร์ฟเวอร์เว็บอย่างเดียว)
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- runtime stage (standalone — เล็ก) ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# รันด้วยผู้ใช้ที่ไม่ใช่ root เพื่อความปลอดภัย
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# เซิร์ฟเวอร์ standalone + asset ที่จำเป็น
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# โฟลเดอร์เก็บคำขอลงลิสต์/โลโก้ (จะ mount เป็น volume)
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
