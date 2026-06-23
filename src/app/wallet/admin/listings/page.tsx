"use client";

import React from "react";
import { Screen } from "@/components/wallet/PhoneShell";
import { TopBar } from "@/components/wallet/TopBar";
import { Shield, Check, Warn } from "@/components/wallet/Icons";

type Submission = {
  id: string;
  contract: string;
  symbol: string;
  name: string;
  logoUrl?: string;
  logoData?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  description?: string;
  contact: string;
  pairInfo?: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
};

export default function AdminListingsPage() {
  const [key, setKey] = React.useState("");
  const [authed, setAuthed] = React.useState(false);
  const [subs, setSubs] = React.useState<Submission[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [working, setWorking] = React.useState<string | null>(null);

  React.useEffect(() => {
    const saved = sessionStorage.getItem("dw_admin_key");
    if (saved) { setKey(saved); load(saved); }
  }, []);

  const load = async (k: string) => {
    setErr(null); setBusy(true);
    try {
      const res = await fetch(`/api/danny/listing?key=${encodeURIComponent(k)}`);
      const j = await res.json();
      if (!res.ok) { setErr(j.error || "เข้าถึงไม่ได้"); setAuthed(false); setBusy(false); return; }
      setSubs(j.submissions || []);
      setAuthed(true);
      sessionStorage.setItem("dw_admin_key", k);
    } catch { setErr("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ"); }
    setBusy(false);
  };

  const act = async (id: string, action: "approve" | "reject") => {
    setWorking(id);
    try {
      const res = await fetch("/api/danny/listing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, id, action }),
      });
      const j = await res.json();
      if (res.ok) setSubs((list) => list.map((s) => (s.id === id ? { ...s, status: j.status } : s)));
      else setErr(j.error || "ดำเนินการไม่สำเร็จ");
    } catch { setErr("เชื่อมต่อไม่สำเร็จ"); }
    setWorking(null);
  };

  if (!authed) {
    return (
      <>
        <TopBar title="แอดมิน · คำขอลงลิสต์" />
        <Screen className="pt-6">
          <div className="dw-glass flex items-start gap-2.5 rounded-2xl p-4 text-sm text-[var(--dw-muted)]">
            <Shield size={18} className="mt-0.5 shrink-0 text-[var(--dw-amber)]" />
            หน้านี้สำหรับแอดมิน — ใส่กุญแจ (LISTING_ADMIN_KEY) เพื่อดูและอนุมัติคำขอ
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && key && load(key)}
            placeholder="ใส่กุญแจแอดมิน"
            className="dw-glass mt-4 w-full rounded-2xl px-4 py-3 text-center outline-none focus:border-[var(--dw-cyan)]/50"
            style={{ color: "var(--dw-text)" }}
          />
          {err && (
            <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[var(--dw-rose)]">
              <Warn size={13} /> {err}
            </p>
          )}
          <button onClick={() => load(key)} disabled={!key || busy} className="dw-btn-primary mt-4 w-full rounded-2xl py-3.5 font-semibold disabled:opacity-50">
            {busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
          </button>
        </Screen>
      </>
    );
  }

  const pending = subs.filter((s) => s.status === "pending");
  const others = subs.filter((s) => s.status !== "pending");

  return (
    <>
      <TopBar
        title="แอดมิน · คำขอลงลิสต์"
        right={<button onClick={() => load(key)} className="text-xs text-[var(--dw-cyan)]">รีเฟรช</button>}
      />
      <Screen className="space-y-3 pb-8">
        <div className="flex gap-2 text-center text-xs">
          <div className="dw-glass flex-1 rounded-xl py-2"><b className="text-[var(--dw-amber)]">{pending.length}</b> รอตรวจ</div>
          <div className="dw-glass flex-1 rounded-xl py-2"><b className="text-[var(--dw-green)]">{subs.filter(s=>s.status==="approved").length}</b> อนุมัติ</div>
          <div className="dw-glass flex-1 rounded-xl py-2"><b className="text-[var(--dw-rose)]">{subs.filter(s=>s.status==="rejected").length}</b> ปฏิเสธ</div>
        </div>
        {err && <p className="flex items-center justify-center gap-1 text-xs text-[var(--dw-rose)]"><Warn size={13} /> {err}</p>}

        {subs.length === 0 && <p className="py-12 text-center text-sm text-[var(--dw-muted)]">ยังไม่มีคำขอเข้ามา</p>}

        {pending.map((s) => <Card key={s.id} s={s} onAct={act} working={working === s.id} />)}
        {others.length > 0 && <p className="px-1 pt-2 text-xs font-medium text-[var(--dw-muted)]">ดำเนินการแล้ว</p>}
        {others.map((s) => <Card key={s.id} s={s} onAct={act} working={working === s.id} />)}
      </Screen>
    </>
  );
}

function Card({ s, onAct, working }: { s: Submission; onAct: (id: string, a: "approve" | "reject") => void; working: boolean }) {
  const logo = s.logoData || s.logoUrl;
  const badge =
    s.status === "approved" ? "bg-[var(--dw-green)]/15 text-[var(--dw-green)]"
    : s.status === "rejected" ? "bg-[var(--dw-rose)]/15 text-[var(--dw-rose)]"
    : "bg-[var(--dw-amber)]/15 text-[var(--dw-amber)]";
  return (
    <div className="dw-glass rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="dw-glass grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={s.symbol} className="h-full w-full object-contain" />
          ) : (
            <span className="text-[9px] text-[var(--dw-muted)]">ไม่มีโลโก้</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">
            {s.symbol} <span className="truncate text-xs font-normal text-[var(--dw-muted)]">{s.name}</span>
          </p>
          <p className="truncate font-mono text-[11px] text-[var(--dw-muted)]">{s.contract}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge}`}>
          {s.status === "pending" ? "รอตรวจ" : s.status === "approved" ? "อนุมัติ" : "ปฏิเสธ"}
        </span>
      </div>

      {s.description && <p className="mt-2.5 text-xs text-[var(--dw-muted)]">{s.description}</p>}

      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--dw-muted)]">
        <span>ติดต่อ: <span className="text-white">{s.contact}</span></span>
        {s.website && <a href={s.website} target="_blank" rel="noreferrer" className="text-[var(--dw-cyan)]">เว็บ</a>}
        {s.twitter && <span className="text-[var(--dw-cyan)]">X: {s.twitter}</span>}
        {s.telegram && <span className="text-[var(--dw-cyan)]">TG: {s.telegram}</span>}
        {s.pairInfo && <span>คู่: {s.pairInfo}</span>}
      </div>

      <div className="mt-3 flex gap-2">
        {s.status !== "approved" && (
          <button onClick={() => onAct(s.id, "approve")} disabled={working}
            className="dw-btn-primary flex flex-1 items-center justify-center gap-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
            <Check size={15} /> {working ? "…" : "อนุมัติ + ใส่โลโก้"}
          </button>
        )}
        {s.status !== "rejected" && (
          <button onClick={() => onAct(s.id, "reject")} disabled={working}
            className="dw-btn-ghost flex-1 rounded-xl py-2.5 text-sm font-semibold text-[var(--dw-rose)] disabled:opacity-50">
            ปฏิเสธ
          </button>
        )}
      </div>
    </div>
  );
}
