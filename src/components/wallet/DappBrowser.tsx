"use client";

// dApp browser ในแอป — เปิดเว็บ dApp ในกระเป๋า (iframe) พร้อมแถบ URL + เตือน phishing
// ถ้าเว็บบล็อกการฝัง (X-Frame-Options/CSP) → แสดง fallback "เปิดในแท็บใหม่" แทนจอว่าง
import React from "react";
import { ChevronLeft, Globe, Warn, Check, Copy } from "./Icons";

export function DappBrowser({ url, onClose }: { url: string; onClose: () => void }) {
  const [warn, setWarn] = React.useState(true);
  const [nonce, setNonce] = React.useState(0); // สำหรับ reload
  const [copied, setCopied] = React.useState(false);
  const [status, setStatus] = React.useState<"checking" | "ok" | "blocked">("checking");
  const loadedRef = React.useRef(false);

  let host = url;
  let isHttps = false;
  try {
    const u = new URL(url);
    host = u.host;
    isHttps = u.protocol === "https:";
  } catch {
    /* ใช้ url ดิบ */
  }

  // เช็กว่าเว็บฝัง iframe ได้ไหม + เผื่อ header ผ่านแต่ render ไม่ขึ้น ใช้ timeout สำรอง
  React.useEffect(() => {
    let alive = true;
    setStatus("checking");
    loadedRef.current = false;
    fetch(`/api/danny/embed-check?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((j: { embeddable?: boolean }) => {
        if (!alive) return;
        setStatus(j.embeddable === false ? "blocked" : "ok");
      })
      .catch(() => alive && setStatus("ok"));
    return () => {
      alive = false;
    };
  }, [url, nonce]);

  // ถ้าผ่าน header check แต่ iframe ไม่ยิง onLoad ภายใน 5 วิ → ถือว่าฝังไม่ได้
  React.useEffect(() => {
    if (status !== "ok") return;
    const id = setTimeout(() => {
      if (!loadedRef.current) setStatus("blocked");
    }, 5000);
    return () => clearTimeout(id);
  }, [status, nonce]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="absolute inset-0 z-[60] flex flex-col" style={{ background: "#070b14" }}>
      {/* แถบบนแบบเบราว์เซอร์ */}
      <div className="dw-glass-strong flex items-center gap-2 border-b border-white/10 px-3 pt-5 pb-2.5">
        <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--dw-muted)] hover:text-white" aria-label="ปิด">
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={copyUrl}
          className="dw-glass flex min-w-0 flex-1 items-center gap-1.5 rounded-full px-3 py-2 text-sm"
        >
          {copied ? (
            <Check size={13} className="shrink-0 text-[var(--dw-green)]" />
          ) : isHttps ? (
            <span className="shrink-0 text-[var(--dw-green)]">🔒</span>
          ) : (
            <Warn size={13} className="shrink-0 text-[var(--dw-amber)]" />
          )}
          <span className="truncate text-[var(--dw-muted)]">{host}</span>
        </button>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--dw-muted)] hover:text-white"
          aria-label="โหลดใหม่"
        >
          ⟳
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--dw-muted)] hover:text-white"
          aria-label="เปิดในแท็บใหม่"
        >
          <Globe size={17} />
        </a>
      </div>

      {/* เตือน phishing */}
      {warn && status === "ok" && (
        <div className="flex items-start gap-2 bg-[var(--dw-amber)]/15 px-4 py-2.5 text-xs text-[var(--dw-amber)]">
          <Warn size={15} className="mt-0.5 shrink-0" />
          <p className="flex-1">
            ตรวจสอบให้แน่ใจว่าคุณอยู่ที่ <span className="font-semibold">https://{host}/</span> — เช็ก URL ทุกตัวอักษรก่อนเชื่อมกระเป๋า
          </p>
          <button onClick={() => setWarn(false)} className="shrink-0 px-1">✕</button>
        </div>
      )}

      {/* กำลังตรวจสอบ */}
      {status === "checking" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="dw-shimmer h-10 w-10 rounded-full" />
          <p className="text-sm text-[var(--dw-muted)]">กำลังเปิด {host}…</p>
        </div>
      )}

      {/* ฝังไม่ได้ → fallback เปิดภายนอก */}
      {status === "blocked" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--dw-amber)]/15 text-[var(--dw-amber)]">
            <Globe size={30} />
          </span>
          <div>
            <p className="font-semibold">{host}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--dw-muted)]">
              เว็บนี้ไม่อนุญาตให้แสดงภายในแอป (ป้องกันการฝังเพื่อความปลอดภัย) — เปิดในเบราว์เซอร์เพื่อใช้งานได้เต็มที่
            </p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="dw-btn-primary flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold"
          >
            <Globe size={18} /> เปิดในแท็บใหม่
          </a>
          <button
            onClick={copyUrl}
            className="dw-btn-ghost flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm"
          >
            {copied ? <Check size={15} className="text-[var(--dw-green)]" /> : <Copy size={15} />}
            {copied ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์"}
          </button>
        </div>
      )}

      {/* ตัว dApp (เมื่อฝังได้) */}
      {status === "ok" && (
        <iframe
          key={nonce}
          src={url}
          title={host}
          onLoad={() => {
            loadedRef.current = true;
          }}
          className="min-h-0 flex-1 border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-storage-access-by-user-activation"
          allow="clipboard-read; clipboard-write; web-share"
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}
