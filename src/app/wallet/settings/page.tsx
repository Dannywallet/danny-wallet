"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet/wallet-store";
import { Screen } from "@/components/wallet/PhoneShell";
import { BottomNav } from "@/components/wallet/BottomNav";
import { SecurityBadge } from "@/components/wallet/SecurityBadge";
import { Sheet } from "@/components/wallet/Sheet";
import { DannyLogo } from "@/components/wallet/DannyLogo";
import { LanguageToggle } from "@/components/wallet/LanguageToggle";
import { useI18n } from "@/lib/wallet/i18n";
import { SeedPhraseGrid } from "@/components/wallet/SeedPhraseGrid";
import { copyEphemeral } from "@/lib/wallet/clipboard";
import { CHAIN } from "@/lib/wallet/mock-data";
import { AccountSwitcher } from "@/components/wallet/AccountSwitcher";
import { shortAddress } from "@/lib/wallet/format";
import { clearStuckTransactions, getStuckCount } from "@/lib/wallet/dandex-swap";
import {
  Shield, Lock, Fingerprint, Eye, Globe, Book, Logout, ChevronRight, Bell, Copy, Check, ArrowUp, ArrowDown, Warn, Activity,
} from "@/components/wallet/Icons";

type Contact = { address: string; short: string; direction: "sent" | "received" };

const LOCK_OPTIONS = [{ min: 1 }, { min: 5 }, { min: 15 }, { min: 30 }, { min: 0 }];

function SunIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition ${
        on ? "bg-gradient-to-r from-[var(--dw-violet)] to-[var(--dw-cyan)]" : "bg-white/12"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Item({
  Icon, title, desc, right, onClick,
}: {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  desc?: string;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${
        onClick ? "cursor-pointer hover:bg-white/[0.04]" : ""
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-[var(--dw-purple)]">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="truncate text-xs text-[var(--dw-muted)]">{desc}</p>}
      </div>
      {right ?? <ChevronRight size={18} className="text-[var(--dw-muted)]" />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-2 px-1 text-xs font-medium text-[var(--dw-muted)]">{title}</p>
      <div className="dw-glass divide-y divide-white/[0.06] overflow-hidden rounded-2xl">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { biometric, balanceHidden, autoLockMin, setPref, lock, reset, toggleBalance, revealMnemonic, address, accounts, activeIndex, hasSeed, getActivePrivateKey } = useWallet();
  const MY_ADDRESS = address ?? "";
  const [sheet, setSheet] = React.useState<null | "lock" | "book" | "about" | "network" | "seed" | "nonce">(null);
  // ล้างธุรกรรมค้าง / รีเซ็ต nonce
  const [stuckCount, setStuckCount] = React.useState<number | null>(null);
  const [noncePin, setNoncePin] = React.useState("");
  const [nonceBusy, setNonceBusy] = React.useState(false);
  const [nonceErr, setNonceErr] = React.useState<string | null>(null);
  const [nonceDone, setNonceDone] = React.useState<number | null>(null);

  const openNonce = async () => {
    setSheet("nonce");
    setNoncePin(""); setNonceErr(null); setNonceDone(null); setStuckCount(null);
    if (MY_ADDRESS) {
      try { setStuckCount(await getStuckCount(MY_ADDRESS)); } catch { setStuckCount(0); }
    }
  };
  const doResetNonce = async () => {
    setNonceErr(null); setNonceBusy(true);
    try {
      const pk = await getActivePrivateKey(noncePin);
      if (!pk) { setNonceErr(t("tx.pinWrong")); setNonceBusy(false); return; }
      const cleared = await clearStuckTransactions({ privateKey: pk });
      setNonceDone(cleared);
      setNoncePin("");
      if (MY_ADDRESS) { try { setStuckCount(await getStuckCount(MY_ADDRESS)); } catch { /* noop */ } }
    } catch (e: any) {
      setNonceErr(e?.shortMessage || e?.message || t("send.failed"));
    } finally {
      setNonceBusy(false);
    }
  };
  const [switcher, setSwitcher] = React.useState(false);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [copied, setCopied] = React.useState<string | null>(null);
  // โหมดมืด/สว่าง — toggle class theme-light + จำใน localStorage (layout มี script โหลดตอนเปิด)
  const [light, setLight] = React.useState(false);
  React.useEffect(() => {
    setLight(document.documentElement.classList.contains("theme-light"));
  }, []);
  const toggleTheme = () => {
    setLight((v) => {
      const nv = !v;
      document.documentElement.classList.toggle("theme-light", nv);
      try { localStorage.setItem("dw-theme", nv ? "light" : "dark"); } catch { /* noop */ }
      return nv;
    });
  };

  // reveal seed (ต้องใส่ PIN)
  const [revealPin, setRevealPin] = React.useState("");
  const [revealedSeed, setRevealedSeed] = React.useState<string[] | null>(null);
  const [revealErr, setRevealErr] = React.useState(false);

  const doReveal = async () => {
    setRevealErr(false);
    const phrase = await revealMnemonic(revealPin);
    if (phrase) setRevealedSeed(phrase.split(" "));
    else setRevealErr(true);
  };
  const closeSeed = () => {
    setSheet(null);
    setRevealPin("");
    setRevealedSeed(null);
    setRevealErr(false);
  };

  React.useEffect(() => {
    if (!MY_ADDRESS) return;
    fetch(`/api/danny/contacts?address=${MY_ADDRESS}`)
      .then((r) => r.json())
      .then((j: { contacts?: Contact[] }) => setContacts(j.contacts || []))
      .catch(() => setContacts([]));
  }, [MY_ADDRESS]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1300);
    } catch {
      /* noop */
    }
  };

  const lockLabelFor = (min: number) => (min === 0 ? t("settings.lockOffFull") : `${min} ${t("settings.minutes")}`);
  const lockLabel = autoLockMin === 0 ? t("settings.lockOff") : `${autoLockMin} ${t("settings.minutes")}`;

  const doLogout = () => {
    lock();
    router.replace("/wallet/unlock");
  };
  const doReset = () => {
    if (confirm(t("settings.resetConfirm"))) {
      reset();
      router.replace("/wallet");
    }
  };

  return (
    <>
      <div className="relative z-10 px-5 pb-1 pt-6">
        <h1 className="text-xl font-bold">{t("settings.title")}</h1>
      </div>
      <Screen className="pt-3">
        {/* การ์ดบัญชี — กดเพื่อสลับ/จัดการบัญชี */}
        <button
          onClick={() => setSwitcher(true)}
          className="dw-glass-strong mb-5 flex w-full items-center gap-3 rounded-2xl p-4 text-left transition hover:bg-white/[0.04]"
        >
          <DannyLogo size={48} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{accounts[activeIndex]?.name || t("tx.account")}</p>
            <p className="truncate font-mono text-xs text-[var(--dw-muted)]">{shortAddress(MY_ADDRESS, 10, 6)}</p>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-[var(--dw-muted)]">
            {accounts.length} {t("settings.accountsSuffix")}
          </span>
          <ChevronRight size={18} className="text-[var(--dw-muted)]" />
        </button>

        <Section title={t("settings.secSection")}>
          <Item Icon={Fingerprint} title={t("settings.biometric")} desc={t("settings.biometricDesc")}
            right={<Toggle on={biometric} onChange={(v) => setPref({ biometric: v })} />} />
          <Item Icon={Lock} title={t("settings.autoLock")} desc={`${t("settings.autoLockDescPre")} ${lockLabel}`}
            onClick={() => setSheet("lock")} />
          <Item Icon={Eye} title={t("settings.hideBalance")} desc={t("settings.hideBalanceDesc")}
            right={<Toggle on={balanceHidden} onChange={() => toggleBalance()} />} />
          {hasSeed && (
            <Item Icon={Shield} title={t("settings.recovery")} desc={t("settings.recoveryDesc")}
              onClick={() => setSheet("seed")} />
          )}
        </Section>

        <Section title={t("settings.netSection")}>
          <Item Icon={Globe} title={t("common.network")} desc={`${CHAIN.name} · Chain ID ${CHAIN.chainId}`}
            onClick={() => setSheet("network")} />
          <Item Icon={Book} title={t("settings.addressBook")} desc={`${contacts.length} ${t("settings.contactsSuffix")}`}
            onClick={() => setSheet("book")} />
          <Item Icon={Bell} title={t("settings.notifications")} desc={t("settings.notificationsDesc")}
            right={<Toggle on onChange={() => {}} />} />
          <Item Icon={Activity} title={t("settings.resetNonce")} desc={t("settings.resetNonceDesc")}
            onClick={openNonce} />
        </Section>

        <Section title={t("settings.generalSection")}>
          <Item Icon={Globe} title="ภาษา / Language" desc="ไทย / English" right={<LanguageToggle />} />
          <Item Icon={SunIcon} title={t("settings.theme")} desc={t("settings.themeDesc")}
            right={<Toggle on={light} onChange={toggleTheme} />} />
          <Item Icon={Book} title={t("settings.about")} desc={`${t("settings.version")} 1.0.0`}
            onClick={() => setSheet("about")} />
          <Item Icon={Logout} title={t("settings.lockWallet")} desc={t("settings.lockWalletDesc")} onClick={doLogout} />
        </Section>

        <button
          onClick={doReset}
          className="mt-2 w-full rounded-2xl border border-[var(--dw-rose)]/30 bg-[var(--dw-rose)]/[0.06] py-3.5 text-sm font-medium text-[var(--dw-rose)]"
        >
          {t("settings.resetWallet")}
        </button>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-[var(--dw-muted)]">
          {t("settings.footer1")}<br />
          {t("settings.footer2")}
        </p>
      </Screen>

      {/* Sheet: ออโต้ล็อก */}
      <Sheet open={sheet === "lock"} onClose={() => setSheet(null)} title={t("settings.autoLock")}>
        <p className="mb-3 text-sm text-[var(--dw-muted)]">{t("settings.lockSheetDesc")}</p>
        <div className="space-y-1.5">
          {LOCK_OPTIONS.map((o) => (
            <button
              key={o.min}
              onClick={() => {
                setPref({ autoLockMin: o.min });
                setSheet(null);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm transition ${
                autoLockMin === o.min ? "dw-btn-primary" : "dw-glass hover:bg-white/[0.06]"
              }`}
            >
              <span className="font-medium">{lockLabelFor(o.min)}</span>
              {autoLockMin === o.min && <Check size={16} />}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Sheet: สมุดที่อยู่ */}
      <Sheet open={sheet === "book"} onClose={() => setSheet(null)} title={t("settings.addressBook")}>
        <p className="mb-3 text-sm text-[var(--dw-muted)]">{t("settings.bookSheetDesc")}</p>
        {contacts.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--dw-muted)]">{t("settings.noTxHistory")}</p>
        ) : (
          <div className="space-y-1.5">
            {contacts.map((c) => (
              <button
                key={c.address}
                onClick={() => copy(c.address)}
                className="dw-glass flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left hover:bg-white/[0.06]"
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                    c.direction === "sent"
                      ? "bg-[var(--dw-rose)]/12 text-[var(--dw-rose)]"
                      : "bg-[var(--dw-green)]/12 text-[var(--dw-green)]"
                  }`}
                >
                  {c.direction === "sent" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                </span>
                <span className="flex-1 font-mono text-sm">{c.short}</span>
                {copied === c.address ? (
                  <Check size={14} className="text-[var(--dw-green)]" />
                ) : (
                  <Copy size={14} className="text-[var(--dw-muted)]" />
                )}
              </button>
            ))}
          </div>
        )}
      </Sheet>

      {/* Sheet: เครือข่าย */}
      <Sheet open={sheet === "network"} onClose={() => setSheet(null)} title={t("common.network")}>
        <div className="dw-glass space-y-3 rounded-2xl p-4 text-sm">
          <Row label={t("settings.netName")} value={CHAIN.name} />
          <Row label="Chain ID" value={String(CHAIN.chainId)} />
          <Row label={t("settings.mainCoin")} value={CHAIN.symbol} />
          <RowCopy label="RPC" value="https://rpc.dannyscan.com" onCopy={copy} copied={copied} />
          <RowCopy label="Explorer" value="https://dannyscan.com" onCopy={copy} copied={copied} />
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--dw-green)]">
          <span className="h-2 w-2 rounded-full bg-[var(--dw-green)]" /> {t("settings.connected")}
        </div>
      </Sheet>

      {/* Sheet: ล้างธุรกรรมค้าง / รีเซ็ต nonce (ต้องใส่ PIN) */}
      <Sheet open={sheet === "nonce"} onClose={() => setSheet(null)} title={t("settings.resetNonce")}>
        <p className="mb-3 text-sm text-[var(--dw-muted)]">{t("settings.nonceSheetDesc")}</p>

        <div className="dw-glass mb-4 flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
          <span className="text-[var(--dw-muted)]">{t("settings.stuckInQueue")}</span>
          <span className="font-semibold">
            {stuckCount === null ? t("settings.checkingStuck") : `${stuckCount} ${t("settings.items")}`}
          </span>
        </div>

        {nonceDone !== null ? (
          <div className="dw-glass flex flex-col items-center gap-2 rounded-2xl border-[var(--dw-green)]/30 bg-[var(--dw-green)]/[0.06] py-6 text-center">
            <Check size={32} className="text-[var(--dw-green)]" />
            <p className="text-sm font-medium">{t("settings.unblocked")} {nonceDone} {t("settings.items")}</p>
          </div>
        ) : stuckCount === 0 ? (
          <div className="dw-glass flex items-center justify-center gap-2 rounded-2xl py-6 text-center text-sm text-[var(--dw-green)]">
            <Check size={18} /> {t("settings.noStuck")}
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-start gap-2 rounded-2xl border border-[var(--dw-amber)]/30 bg-[var(--dw-amber)]/[0.06] p-3 text-xs text-[var(--dw-amber)]">
              <Warn size={15} className="mt-0.5 shrink-0" />
              {t("settings.resetNonceWarn")}
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={noncePin}
              onChange={(e) => setNoncePin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && noncePin.length === 6 && !nonceBusy && doResetNonce()}
              placeholder={t("tx.enterPin")}
              className="dw-glass w-full rounded-2xl px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-[var(--dw-cyan)]/50"
              style={{ color: "var(--dw-text)" }}
            />
            {nonceErr && (
              <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[var(--dw-rose)]">
                <Warn size={13} /> {nonceErr}
              </p>
            )}
            <button
              onClick={doResetNonce}
              disabled={noncePin.length < 6 || nonceBusy || stuckCount === null}
              className="dw-btn-primary mt-4 w-full rounded-2xl py-3.5 font-semibold disabled:opacity-50"
            >
              {nonceBusy ? t("settings.clearing") : t("settings.resetNonceBtn")}
            </button>
          </>
        )}
      </Sheet>

      {/* Sheet: เผยวลีกู้คืน (ต้องใส่ PIN) */}
      <Sheet open={sheet === "seed"} onClose={closeSeed} title={t("settings.recovery")}>
        {!revealedSeed ? (
          <div>
            <div className="dw-glass mb-4 flex items-start gap-2.5 rounded-2xl border-[var(--dw-rose)]/30 bg-[var(--dw-rose)]/[0.06] p-3.5 text-xs text-[var(--dw-muted)]">
              <Shield size={16} className="mt-0.5 shrink-0 text-[var(--dw-rose)]" />
              {t("settings.seedWarn")}
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={revealPin}
              onChange={(e) => setRevealPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && doReveal()}
              placeholder={t("tx.enterPin")}
              className="dw-glass w-full rounded-2xl px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-[var(--dw-cyan)]/50"
              style={{ color: "var(--dw-text)" }}
            />
            {revealErr && (
              <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[var(--dw-rose)]">
                <Warn size={13} /> {t("tx.pinWrong")}
              </p>
            )}
            <button
              onClick={doReveal}
              disabled={revealPin.length < 6}
              className="dw-btn-primary mt-4 w-full rounded-2xl py-3.5 font-semibold"
            >
              {t("settings.reveal")}
            </button>
          </div>
        ) : (
          <div>
            <SeedPhraseGrid words={revealedSeed} />
            <button
              onClick={() => copyEphemeral(revealedSeed.join(" "), 30_000)}
              className="dw-btn-ghost mt-3 w-full rounded-xl py-2.5 text-sm"
            >
              {t("settings.copyClear")}
            </button>
            <p className="mt-3 text-center text-[11px] text-[var(--dw-muted)]">
              {t("settings.seedOffline")}
            </p>
          </div>
        )}
      </Sheet>

      {/* Sheet: เกี่ยวกับ */}
      <Sheet open={sheet === "about"} onClose={() => setSheet(null)} title={t("settings.about")}>
        <div className="flex flex-col items-center pb-2 text-center">
          <DannyLogo size={64} />
          <p className="mt-3 font-semibold">Danny Wallet</p>
          <p className="text-xs text-[var(--dw-muted)]">{t("settings.version")} 1.0.0</p>
        </div>
        <div className="dw-glass mt-3 space-y-3 rounded-2xl p-4 text-sm">
          <Row label={t("common.network")} value={`${CHAIN.name} (${CHAIN.chainId})`} />
          <Row label={t("settings.contactsBalances")} value="dannyscan" />
          <Row label={t("settings.price")} value="dandex (on-chain)" />
          <Row label={t("settings.chartVolume")} value="dancharts" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["Dannyscan", "https://dannyscan.com"],
            ["Dancharts", "https://dancharts.com"],
            ["dandex", "https://dandex.io"],
          ].map(([name, url]) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="dw-glass flex items-center justify-center gap-1 rounded-xl py-2.5 text-xs text-[var(--dw-muted)] hover:text-[var(--dw-text)]"
            >
              <Globe size={13} /> {name}
            </a>
          ))}
        </div>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-[var(--dw-muted)]">
          {t("settings.aboutDesc")}
        </p>
      </Sheet>

      <AccountSwitcher open={switcher} onClose={() => setSwitcher(false)} />
      <BottomNav />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--dw-muted)]">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}

function RowCopy({
  label, value, onCopy, copied,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
  copied: string | null;
}) {
  return (
    <button onClick={() => onCopy(value)} className="flex w-full items-center justify-between gap-3 text-left">
      <span className="text-[var(--dw-muted)]">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 font-medium">
        <span className="truncate text-xs">{value}</span>
        {copied === value ? <Check size={13} className="shrink-0 text-[var(--dw-green)]" /> : <Copy size={13} className="shrink-0 text-[var(--dw-muted)]" />}
      </span>
    </button>
  );
}
