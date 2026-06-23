/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // bundle เซิร์ฟเวอร์แบบ self-contained (.next/standalone) สำหรับแพ็กลง Electron desktop
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  // security headers — กัน clickjacking (อนุญาตฝัง iframe เฉพาะโดเมนเรา) + hardening เบาๆ
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://dannywallet.com https://*.dannywallet.com",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // เปิด CORS เฉพาะ API ข้อมูลสาธารณะ (on-chain) ให้หน้า landing ดึงราคาจริงได้
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
    ];
  },
  webpack: (config) => {
    // optional deps ของ WalletConnect ที่ไม่จำเป็นบนเบราว์เซอร์
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false };
    return config;
  },
};

module.exports = nextConfig;
