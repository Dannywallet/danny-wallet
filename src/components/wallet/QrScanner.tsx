"use client";

// สแกน QR ด้วยกล้อง (getUserMedia + jsQR) — ใช้ได้ทุกเบราว์เซอร์ที่รองรับกล้อง (รวม iOS Safari)
import React from "react";
import jsQR from "jsqr";
import { useI18n } from "@/lib/wallet/i18n";

const SCAN_TEXT: Record<string, { hint: string; denied: string }> = {
  th: { hint: "เล็งกล้องไปที่ QR code ของที่อยู่กระเป๋า", denied: "เข้าถึงกล้องไม่ได้ — อนุญาตสิทธิ์กล้อง หรือวางที่อยู่เอง" },
  en: { hint: "Point the camera at a wallet-address QR code", denied: "Can't access the camera — allow camera permission or paste the address" },
  vi: { hint: "Hướng camera vào mã QR địa chỉ ví", denied: "Không truy cập được camera — cho phép quyền camera hoặc dán địa chỉ" },
  zh: { hint: "将相机对准钱包地址二维码", denied: "无法访问相机 — 请允许相机权限或粘贴地址" },
};

export function QrScanner({ open, onClose, onScan }: {
  open: boolean;
  onClose: () => void;
  onScan: (text: string) => void;
}) {
  const { lang } = useI18n();
  const txt = SCAN_TEXT[lang] || SCAN_TEXT.en;
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [denied, setDenied] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let alive = true;
    setDenied(false);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!alive) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play().catch(() => {});
        const tick = () => {
          if (!alive || !ctx) return;
          const v2 = videoRef.current;
          if (v2 && v2.readyState >= 2 && v2.videoWidth) {
            canvas.width = v2.videoWidth;
            canvas.height = v2.videoHeight;
            ctx.drawImage(v2, 0, 0, canvas.width, canvas.height);
            try {
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
              if (code && code.data) { onScan(code.data); return; }
            } catch { /* ข้าม frame ที่อ่านไม่ได้ */ }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        if (alive) setDenied(true);
      }
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [open, onScan]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[4000] bg-black">
      <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
      {!denied && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-60 w-60 max-w-[70vw] rounded-3xl border-2 border-white/90" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }} />
        </div>
      )}
      <button onClick={onClose} aria-label="close"
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-2xl leading-none text-white backdrop-blur">✕</button>
      <p className="absolute inset-x-0 bottom-14 px-8 text-center text-sm font-medium text-white/90">
        {denied ? txt.denied : txt.hint}
      </p>
    </div>
  );
}
