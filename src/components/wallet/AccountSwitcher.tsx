"use client";

// สลับ/เพิ่ม/เปลี่ยนชื่อบัญชี (หลายบัญชี derive จาก seed เดียว)
import React from "react";
import { Sheet } from "./Sheet";
import { useWallet } from "@/lib/wallet/wallet-store";
import { shortAddress } from "@/lib/wallet/format";
import { copyEphemeral } from "@/lib/wallet/clipboard";
import { Check, Plus, Warn, Copy } from "./Icons";

function gradient(addr: string): string {
  let h = 0;
  for (let i = 0; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) >>> 0;
  const hues = [[124, 58, 237], [34, 211, 238], [52, 211, 153], [245, 158, 11], [236, 72, 153]];
  const [r, g, b] = hues[h % hues.length];
  return `linear-gradient(135deg, rgb(${r},${g},${b}), #22d3ee)`;
}

export function AccountSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accounts, activeIndex, switchAccount, renameAccount, addAccount, importAccount, removeAccount, revealPrivateKey, hasSeed } = useWallet();
  const [mode, setMode] = React.useState<"list" | "add" | "import" | "export">("list");
  const [exportIdx, setExportIdx] = React.useState(0);
  const [exportKey, setExportKey] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState("");
  const [pk, setPk] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState<number | null>(null);
  const [editName, setEditName] = React.useState("");
  const [copied, setCopied] = React.useState<string | null>(null);

  const copyAddr = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* noop */
    }
  };

  // คัดลอกกุญแจ — ล้าง clipboard อัตโนมัติใน 30 วิ
  const copyKey = async (key: string) => {
    await copyEphemeral(key, 30_000);
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  };

  const close = () => {
    setMode("list");
    setPin("");
    setPk("");
    setErr(null);
    setEditing(null);
    setExportKey(null);
    onClose();
  };

  const doExport = async () => {
    setErr(null);
    setBusy(true);
    const k = await revealPrivateKey(exportIdx, pin);
    setBusy(false);
    if (k) { setExportKey(k); setPin(""); }
    else setErr("PIN ไม่ถูกต้อง");
  };

  const reasonMsg = (r?: string) =>
    r === "max" ? "ครบจำนวนบัญชีสูงสุดแล้ว (100)"
    : r === "invalid-key" ? "Private Key ไม่ถูกต้อง"
    : r === "exists" ? "บัญชีนี้มีอยู่แล้ว"
    : "PIN ไม่ถูกต้อง";

  const doAdd = async () => {
    setErr(null);
    setBusy(true);
    const res = await addAccount(pin);
    setBusy(false);
    if (res.ok) { setMode("list"); setPin(""); }
    else setErr(reasonMsg(res.reason));
  };

  const doImport = async () => {
    setErr(null);
    setBusy(true);
    const res = await importAccount(pin, pk);
    setBusy(false);
    if (res.ok) { setMode("list"); setPin(""); setPk(""); }
    else setErr(reasonMsg(res.reason));
  };

  return (
    <Sheet open={open} onClose={close} title="บัญชีของฉัน">
      {mode === "add" ? (
        <div>
          <div className="dw-glass mb-4 flex items-start gap-2.5 rounded-2xl p-4 text-sm text-[var(--dw-muted)]">
            <Warn size={18} className="mt-0.5 shrink-0 text-[var(--dw-green)]" />
            บัญชีใหม่สร้างจาก seed เดิม (BIP44) — ใส่ PIN เพื่อยืนยัน
          </div>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && pin.length === 6 && doAdd()}
            placeholder="ใส่ PIN 6 หลัก"
            className="dw-glass w-full rounded-2xl px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-[var(--dw-cyan)]/50"
            style={{ color: "var(--dw-text)" }}
          />
          {err && (
            <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[var(--dw-rose)]">
              <Warn size={13} /> {err}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => { setMode("list"); setErr(null); setPin(""); }} className="dw-btn-ghost rounded-2xl py-3 font-semibold">ยกเลิก</button>
            <button onClick={doAdd} disabled={pin.length < 6 || busy} className="dw-btn-primary rounded-2xl py-3 font-semibold">
              {busy ? "กำลังสร้าง…" : "สร้างบัญชี"}
            </button>
          </div>
        </div>
      ) : mode === "import" ? (
        <div>
          <div className="dw-glass mb-3 flex items-start gap-2.5 rounded-2xl border-[var(--dw-amber)]/30 bg-[var(--dw-amber)]/[0.06] p-3.5 text-xs text-[var(--dw-muted)]">
            <Warn size={16} className="mt-0.5 shrink-0 text-[var(--dw-amber)]" />
            บัญชีนำเข้าใช้ private key ของตัวเอง (ไม่ได้มาจาก seed) — สำรอง seed อย่างเดียวจะไม่ครอบคลุมบัญชีนี้
          </div>
          <textarea
            value={pk}
            onChange={(e) => setPk(e.target.value)}
            rows={3}
            placeholder="วาง Private Key (0x...)"
            className="dw-glass w-full resize-none rounded-2xl px-4 py-3 font-mono text-sm outline-none placeholder:text-white/25 focus:border-[var(--dw-cyan)]/50"
            style={{ color: "var(--dw-text)" }}
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="ใส่ PIN 6 หลัก"
            className="dw-glass mt-3 w-full rounded-2xl px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-[var(--dw-cyan)]/50"
            style={{ color: "var(--dw-text)" }}
          />
          {err && (
            <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[var(--dw-rose)]">
              <Warn size={13} /> {err}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => { setMode("list"); setErr(null); setPin(""); setPk(""); }} className="dw-btn-ghost rounded-2xl py-3 font-semibold">ยกเลิก</button>
            <button onClick={doImport} disabled={pk.trim().length < 60 || pin.length < 6 || busy} className="dw-btn-primary rounded-2xl py-3 font-semibold">
              {busy ? "กำลังนำเข้า…" : "นำเข้า"}
            </button>
          </div>
        </div>
      ) : mode === "export" ? (
        <div>
          <div className="dw-glass mb-3 flex items-start gap-2.5 rounded-2xl border-[var(--dw-rose)]/30 bg-[var(--dw-rose)]/[0.06] p-3.5 text-xs text-[var(--dw-muted)]">
            <Warn size={16} className="mt-0.5 shrink-0 text-[var(--dw-rose)]" />
            ใครได้ private key นี้ควบคุมเงินในบัญชี <span className="font-semibold text-white">{accounts[exportIdx]?.name}</span> ได้ทั้งหมด — อย่าแชร์/ถ่ายรูป
          </div>
          {!exportKey ? (
            <>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && pin.length === 6 && doExport()}
                placeholder="ใส่ PIN 6 หลัก"
                className="dw-glass w-full rounded-2xl px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-[var(--dw-cyan)]/50"
                style={{ color: "var(--dw-text)" }}
              />
              {err && (
                <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[var(--dw-rose)]">
                  <Warn size={13} /> {err}
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button onClick={() => { setMode("list"); setErr(null); setPin(""); }} className="dw-btn-ghost rounded-2xl py-3 font-semibold">ยกเลิก</button>
                <button onClick={doExport} disabled={pin.length < 6 || busy} className="dw-btn-primary rounded-2xl py-3 font-semibold">
                  {busy ? "กำลังเผย…" : "เผยกุญแจ"}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => copyKey(exportKey)}
                className="dw-glass w-full break-all rounded-2xl px-4 py-3 text-left font-mono text-xs"
              >
                {exportKey}
              </button>
              <button
                onClick={() => copyKey(exportKey)}
                className="dw-btn-ghost mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm"
              >
                {copied === exportKey ? <Check size={15} className="text-[var(--dw-green)]" /> : <Copy size={15} />}
                {copied === exportKey ? "คัดลอกแล้ว (ล้างใน 30 วิ)" : "คัดลอกกุญแจ"}
              </button>
              <button onClick={() => { setMode("list"); setExportKey(null); }} className="dw-btn-primary mt-3 w-full rounded-2xl py-3 font-semibold">
                เสร็จสิ้น
              </button>
            </>
          )}
        </div>
      ) : (
        <div>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {accounts.map((a, i) => (
              <div
                key={a.address}
                className={`dw-glass flex items-center gap-2.5 rounded-2xl px-3 py-3 ${
                  i === activeIndex ? "border-[var(--dw-cyan)]/50" : ""
                }`}
              >
                <button onClick={() => switchAccount(i)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                    style={{ background: gradient(a.address) }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    {editing === i ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => { renameAccount(i, editName); setEditing(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { renameAccount(i, editName); setEditing(null); } }}
                        className="w-full rounded bg-white/10 px-2 py-0.5 text-sm font-medium outline-none"
                        style={{ color: "var(--dw-text)" }}
                      />
                    ) : (
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {a.name}
                        {a.enc && (
                          <span className="rounded bg-[var(--dw-amber)]/20 px-1 text-[9px] text-[var(--dw-amber)]">นำเข้า</span>
                        )}
                      </p>
                    )}
                    <p className="truncate font-mono text-xs text-[var(--dw-muted)]">{shortAddress(a.address)}</p>
                  </div>
                </button>
                {i === activeIndex && <Check size={16} className="shrink-0 text-[var(--dw-cyan)]" />}
                <button onClick={() => copyAddr(a.address)} className="shrink-0 text-[var(--dw-muted)] hover:text-white" aria-label="คัดลอกที่อยู่">
                  {copied === a.address ? <Check size={15} className="text-[var(--dw-green)]" /> : <Copy size={15} />}
                </button>
                <button
                  onClick={() => { setEditing(i); setEditName(a.name); }}
                  className="shrink-0 text-xs text-[var(--dw-muted)] hover:text-white"
                >
                  ชื่อ
                </button>
                <button
                  onClick={() => { setExportIdx(i); setExportKey(null); setPin(""); setErr(null); setMode("export"); }}
                  className="shrink-0 text-xs text-[var(--dw-muted)] hover:text-white"
                >
                  กุญแจ
                </button>
                {accounts.length > 1 && (
                  <button
                    onClick={() => {
                      if (confirm(`ลบ "${a.name}" ?${a.enc ? "\n(บัญชีนำเข้า — ต้องมี private key เพื่อกู้คืน)" : ""}`)) removeAccount(i);
                    }}
                    className="shrink-0 text-xs text-[var(--dw-rose)] hover:opacity-80"
                  >
                    ลบ
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className={`mt-4 grid gap-2.5 ${hasSeed ? "grid-cols-2" : "grid-cols-1"}`}>
            {hasSeed && (
              <button
                onClick={() => { setMode("add"); setErr(null); }}
                className="dw-btn-primary flex items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-semibold"
              >
                <Plus size={17} /> เพิ่มบัญชี
              </button>
            )}
            <button
              onClick={() => { setMode("import"); setErr(null); }}
              className="dw-btn-ghost flex items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-semibold"
            >
              นำเข้า Private Key
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] text-[var(--dw-muted)]">
            {accounts.length}/100 บัญชี{hasSeed ? " · บัญชี HD มาจาก seed เดียว" : " · กระเป๋านำเข้า (ไม่มี seed)"}
          </p>
        </div>
      )}
    </Sheet>
  );
}
