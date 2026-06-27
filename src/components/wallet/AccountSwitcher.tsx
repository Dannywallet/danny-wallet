"use client";

// สลับ/เพิ่ม/เปลี่ยนชื่อบัญชี (หลายบัญชี derive จาก seed เดียว)
import React from "react";
import { Sheet } from "./Sheet";
import { useWallet } from "@/lib/wallet/wallet-store";
import { shortAddress } from "@/lib/wallet/format";
import { copyEphemeral } from "@/lib/wallet/clipboard";
import { Check, Plus, Warn, Copy } from "./Icons";
import { useI18n } from "@/lib/wallet/i18n";

function gradient(addr: string): string {
  let h = 0;
  for (let i = 0; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) >>> 0;
  const hues = [[124, 58, 237], [34, 211, 238], [52, 211, 153], [245, 158, 11], [236, 72, 153]];
  const [r, g, b] = hues[h % hues.length];
  return `linear-gradient(135deg, rgb(${r},${g},${b}), #22d3ee)`;
}

export function AccountSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { accounts, activeIndex, switchAccount, renameAccount, addAccount, createAccount, importAccount, removeAccount, revealPrivateKey, hasSeed } = useWallet();
  const [mode, setMode] = React.useState<"list" | "add" | "create" | "import" | "export">("list");
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
    else setErr(t("tx.pinWrong"));
  };

  const reasonMsg = (r?: string) =>
    r === "max" ? t("acct.maxReached100")
    : r === "invalid-key" ? t("import.pkInvalid")
    : r === "exists" ? t("acct.exists")
    : t("tx.pinWrong");

  const doAdd = async () => {
    setErr(null);
    setBusy(true);
    const res = await addAccount(pin);
    setBusy(false);
    if (res.ok) { setMode("list"); setPin(""); }
    else setErr(reasonMsg(res.reason));
  };

  const doCreate = async () => {
    setErr(null);
    setBusy(true);
    const res = await createAccount(pin);
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
    <Sheet open={open} onClose={close} title={t("acct.myAccounts")}>
      {mode === "add" || mode === "create" ? (
        <div>
          <div className="dw-glass mb-4 flex items-start gap-2.5 rounded-2xl p-4 text-sm text-[var(--dw-muted)]">
            <Warn size={18} className={`mt-0.5 shrink-0 ${mode === "create" ? "text-[var(--dw-amber)]" : "text-[var(--dw-green)]"}`} />
            {mode === "create" ? t("acct.createWalletNote") : t("acct.newFromSeed")}
          </div>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && pin.length === 6 && (mode === "create" ? doCreate() : doAdd())}
            placeholder={t("tx.enterPin")}
            className="dw-glass w-full rounded-2xl px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-[var(--dw-cyan)]/50"
            style={{ color: "var(--dw-text)" }}
          />
          {err && (
            <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[var(--dw-rose)]">
              <Warn size={13} /> {err}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => { setMode("list"); setErr(null); setPin(""); }} className="dw-btn-ghost rounded-2xl py-3 font-semibold">{t("common.cancel")}</button>
            <button onClick={mode === "create" ? doCreate : doAdd} disabled={pin.length < 6 || busy} className="dw-btn-primary rounded-2xl py-3 font-semibold">
              {busy ? t("acct.creating") : t("acct.createAccount")}
            </button>
          </div>
        </div>
      ) : mode === "import" ? (
        <div>
          <div className="dw-glass mb-3 flex items-start gap-2.5 rounded-2xl border-[var(--dw-amber)]/30 bg-[var(--dw-amber)]/[0.06] p-3.5 text-xs text-[var(--dw-muted)]">
            <Warn size={16} className="mt-0.5 shrink-0 text-[var(--dw-amber)]" />
            {t("acct.importNote")}
          </div>
          <textarea
            value={pk}
            onChange={(e) => setPk(e.target.value)}
            rows={3}
            placeholder={t("acct.pkPlaceholder")}
            className="dw-glass w-full resize-none rounded-2xl px-4 py-3 font-mono text-sm outline-none placeholder:text-[var(--dw-muted)] focus:border-[var(--dw-cyan)]/50"
            style={{ color: "var(--dw-text)" }}
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder={t("tx.enterPin")}
            className="dw-glass mt-3 w-full rounded-2xl px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-[var(--dw-cyan)]/50"
            style={{ color: "var(--dw-text)" }}
          />
          {err && (
            <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[var(--dw-rose)]">
              <Warn size={13} /> {err}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => { setMode("list"); setErr(null); setPin(""); setPk(""); }} className="dw-btn-ghost rounded-2xl py-3 font-semibold">{t("common.cancel")}</button>
            <button onClick={doImport} disabled={pk.trim().length < 60 || pin.length < 6 || busy} className="dw-btn-primary rounded-2xl py-3 font-semibold">
              {busy ? t("acct.importing") : t("acct.import")}
            </button>
          </div>
        </div>
      ) : mode === "export" ? (
        <div>
          <div className="dw-glass mb-3 flex items-start gap-2.5 rounded-2xl border-[var(--dw-rose)]/30 bg-[var(--dw-rose)]/[0.06] p-3.5 text-xs text-[var(--dw-muted)]">
            <Warn size={16} className="mt-0.5 shrink-0 text-[var(--dw-rose)]" />
            {t("acct.exportWarnPre")} <span className="font-semibold text-[var(--dw-text)]">{accounts[exportIdx]?.name}</span> {t("acct.exportWarnSuf")}
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
                placeholder={t("tx.enterPin")}
                className="dw-glass w-full rounded-2xl px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-[var(--dw-cyan)]/50"
                style={{ color: "var(--dw-text)" }}
              />
              {err && (
                <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[var(--dw-rose)]">
                  <Warn size={13} /> {err}
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button onClick={() => { setMode("list"); setErr(null); setPin(""); }} className="dw-btn-ghost rounded-2xl py-3 font-semibold">{t("common.cancel")}</button>
                <button onClick={doExport} disabled={pin.length < 6 || busy} className="dw-btn-primary rounded-2xl py-3 font-semibold">
                  {busy ? t("acct.revealing") : t("acct.revealKey")}
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
                {copied === exportKey ? t("acct.copiedClear") : t("acct.copyKey")}
              </button>
              <button onClick={() => { setMode("list"); setExportKey(null); }} className="dw-btn-primary mt-3 w-full rounded-2xl py-3 font-semibold">
                {t("common.done")}
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
                          <span className="rounded bg-[var(--dw-amber)]/20 px-1 text-[9px] text-[var(--dw-amber)]">{t("acct.importedTag")}</span>
                        )}
                      </p>
                    )}
                    <p className="truncate font-mono text-xs text-[var(--dw-muted)]">{shortAddress(a.address)}</p>
                  </div>
                </button>
                {i === activeIndex && <Check size={16} className="shrink-0 text-[var(--dw-cyan)]" />}
                <button onClick={() => copyAddr(a.address)} className="shrink-0 text-[var(--dw-muted)] hover:text-[var(--dw-text)]" aria-label={t("acct.copyAddress")}>
                  {copied === a.address ? <Check size={15} className="text-[var(--dw-green)]" /> : <Copy size={15} />}
                </button>
                <button
                  onClick={() => { setEditing(i); setEditName(a.name); }}
                  className="shrink-0 text-xs text-[var(--dw-muted)] hover:text-[var(--dw-text)]"
                >
                  {t("common.name")}
                </button>
                <button
                  onClick={() => { setExportIdx(i); setExportKey(null); setPin(""); setErr(null); setMode("export"); }}
                  className="shrink-0 text-xs text-[var(--dw-muted)] hover:text-[var(--dw-text)]"
                >
                  {t("acct.key")}
                </button>
                {accounts.length > 1 && (
                  <button
                    onClick={() => {
                      if (confirm(`${t("acct.deletePrefix")} "${a.name}" ?${a.enc ? "\n" + t("acct.deleteImportedNote") : ""}`)) removeAccount(i);
                    }}
                    className="shrink-0 text-xs text-[var(--dw-rose)] hover:opacity-80"
                  >
                    {t("common.remove")}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2.5">
            {hasSeed && (
              <button
                onClick={() => { setMode("add"); setErr(null); setPin(""); }}
                className="dw-btn-ghost flex w-full items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-semibold"
              >
                <Plus size={17} /> {t("acct.addAccount")}
              </button>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => { setMode("create"); setErr(null); setPin(""); }}
                className="dw-btn-primary flex items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-semibold"
              >
                <Plus size={17} /> {t("acct.createWallet")}
              </button>
              <button
                onClick={() => { setMode("import"); setErr(null); }}
                className="dw-btn-ghost flex items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-semibold"
              >
                {t("acct.importPk")}
              </button>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-[var(--dw-muted)]">
            {accounts.length}/100 {t("settings.accountsSuffix")}{hasSeed ? t("acct.hdNote") : t("acct.importedWalletNote")}
          </p>
        </div>
      )}
    </Sheet>
  );
}
