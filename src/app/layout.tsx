import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet/wallet-store";

export const metadata: Metadata = {
  title: "Danny Wallet — กระเป๋าคริปโตบน Danny Chain",
  description: "กระเป๋าคริปโตดีไซน์ทันสมัย ปลอดภัย สำหรับ Danny Chain (5069)",
};

export const viewport: Viewport = {
  themeColor: "#070b14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* ใช้ธีมจาก localStorage ก่อน paint กันจอกระพริบ */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('dw-theme')==='light')document.documentElement.classList.add('theme-light')}catch(e){}`,
          }}
        />
      </head>
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
