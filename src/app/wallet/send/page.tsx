"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Screen } from "@/components/wallet/PhoneShell";
import { TopBar } from "@/components/wallet/TopBar";
import { TokenIcon } from "@/components/wallet/TokenIcon";
import { Sheet } from "@/components/wallet/Sheet";
import { CHAIN } from "@/lib/wallet/mock-data";
import { useWallet } from "@/lib/wallet/wallet-store";
import { useHoldings, type WToken } from "@/lib/wallet/use-holdings";
import { formatUsd, formatToken, shortAddress, isLikelyAddress } from "@/lib/wallet/format";
import { Check, Warn, Shield, ChevronRight, ArrowUp, ArrowDown, Scan } from "@/components/wallet/Icons";
import { executeSend, estimateSendFee, explorerTx } from "@/lib/wallet/dandex-swap";
import { useI18n } from "@/lib/wallet/i18n";

const FEE = 0.012; // ค่าธรรมเนียมเครือข่ายโดยประมาณ (DAN)

type Contact = { address: string; short: string; direction: "sent" | "received" };

export default function Send() {
  const { t } = useI18n();
  const router = useRouter();
  const { address, accounts, activeIndex, getActivePrivateKey } = useWallet();
  const { tokens, state } = useHoldings();
  const [token, setToken] = React.useState<WToken | null>(null);
  const [pickToken, setPickToken] = React.useState(false);
  const [to, setTo] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [stage, setStage] = React.useState<"form" | "confirm" | "pending" | "done">("form");
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [sending, setSending] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState("");
  const [askPin, setAskPin] = React.useState(false);
  const [gasFee, setGasFee] = React.useState<number | null | "loading">(null);

  const goConfirm = async () => {
    if (!token || !address) return;
    setStage("confirm");
    setGasFee("loading");
    const est = await estimateSendFee({
      token: { address: token.address, symbol: token.symbol, decimals: undefined },
      to,
      amount,
      from: address,
    });
    setGasFee(est ? est.feeDan : null);
  };

  // เริ่มต้นที่เหรียญมูลค่ามากสุดในพอร์ตจริง
  React.useEffect(() => {
    if (state === "ok" && tokens.length && !token) setToken(tokens[0]);
  }, [state, tokens, token]);

  // รายชื่อล่าสุดจากประวัติธุรกรรมจริง (ตามบัญชีที่ใช้งาน)
  React.useEffect(() => {
    if (!address) return;
    fetch(`/api/danny/contacts?address=${address}`)
      .then((r) => r.json())
      .then((j: { contacts?: Contact[] }) => setContacts(j.contacts || []))
      .catch(() => setContacts([]));
  }, [address]);

  const amt = parseFloat(amount) || 0;
  const addrValid = isLikelyAddress(to);
  const enough = !!token && amt > 0 && amt <= token.balance;
  const canNext = addrValid && enough;
  const usd = token?.priceUsd != null ? amt * token.priceUsd : null;

  const submit = async () => {
    if (!token) return;
    setErr(null);
    setSending(true);
    try {
      const privateKey = await getActivePrivateKey(pin);
      if (!privateKey) {
        setErr(t("tx.pinWrong"));
        setSending(false);
        return;
      }
      const res = await executeSend({
        token: { address: token.address, symbol: token.symbol },
        to,
        amount,
        privateKey,
        onPhase: (p) => setStatus(p === "unstick" ? t("swap.clearingStuck") : ""),
        // ส่งแล้ว (ยังไม่ยืนยัน) → โชว์สถานะ pending ทันที
        onHash: (h) => {
          setTxHash(h);
          setAskPin(false);
          setPin("");
          setStatus("");
          setSending(false);
          setStage("pending");
        },
      });
      // ยืนยันบนเชนแล้วจึงขึ้น "สำเร็จ"; ถ้ายัง pending คงสถานะรอยืนยันไว้
      if (res.status === "confirmed") setStage("done");
    } catch (e: any) {
      setErr(e?.shortMessage || e?.message || t("send.failed"));
      setSending(false);
    }
  };

  if ((stage === "done" || stage === "pending") && token) {
    const pending = stage === "pending";
    return (
      <Screen className="flex flex-col items-center justify-center">
        {pending ? (
          <span className="grid h-24 w-24 place-items-center rounded-full bg-[var(--dw-amber)]/15">
            <span className="h-11 w-11 animate-spin rounded-full border-2 border-[var(--dw-amber)]/25 border-t-[var(--dw-amber)]" />
          </span>
        ) : (
          <span className="grid h-24 w-24 place-items-center rounded-full bg-[var(--dw-green)]/15 text-[var(--dw-green)] dw-pulse-ring">
            <Check size={44} />
          </span>
        )}
        <h1 className="mt-6 text-xl font-semibold">{pending ? t("send.sendPending") : t("tx.txSuccess")}</h1>
        <p className="mt-2 text-center text-sm text-[var(--dw-muted)]">
          {t("send.sendPrefix")} {formatToken(amt, token.symbol)} {t("send.toMid")}<br />{shortAddress(to)}
        </p>
        {pending && (
          <p className="mt-1 max-w-[16rem] text-center text-xs text-[var(--dw-muted)]">{t("swap.pendingHint")}</p>
        )}
        {txHash && (
          <a
            href={explorerTx(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="dw-btn-ghost mt-5 rounded-xl px-4 py-2 text-xs"
          >
            {t("tx.viewOnDannyscan")}
          </a>
        )}
        <button
          onClick={() => router.replace("/wallet/activity")}
          className="dw-btn-primary mt-3 rounded-xl px-5 py-2.5 text-sm font-semibold"
        >
          {t("send.goActivity")}
        </button>
      </Screen>
    );
  }

  return (
    <>
      <TopBar
        title={stage === "confirm" ? t("send.confirmTitle") : t("send.title")}
        onBack={() => (stage === "confirm" ? setStage("form") : router.back())}
      />
      <Screen>
        {state === "loading" || !token ? (
          state === "error" ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <Warn size={30} className="text-[var(--dw-rose)]" />
              <p className="text-sm text-[var(--dw-muted)]">{t("tx.loadTokensFailed")}</p>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="dw-glass dw-shimmer h-16 rounded-2xl" />
              <div className="dw-glass dw-shimmer h-14 rounded-2xl" />
              <div className="dw-glass dw-shimmer h-14 rounded-2xl" />
            </div>
          )
        ) : stage === "form" ? (
          <div className="dw-rise space-y-4">
            {/* เลือกเหรียญ (จากพอร์ตจริง) */}
            <button
              onClick={() => setPickToken((v) => !v)}
              className="dw-glass flex w-full items-center gap-3 rounded-2xl px-4 py-3"
            >
              <TokenIcon symbol={token.symbol} gradient={token.gradient} logo={token.logo} />
              <div className="flex-1 text-left">
                <p className="font-semibold">{token.symbol}</p>
                <p className="text-xs text-[var(--dw-muted)]">
                  {t("tx.balance")} {formatToken(token.balance, token.symbol)}
                </p>
              </div>
              <ChevronRight size={18} className="text-[var(--dw-muted)]" />
            </button>
            {pickToken && (
              <div className="dw-glass max-h-72 space-y-1 overflow-y-auto rounded-2xl p-2">
                {tokens.map((t) => (
                  <button
                    key={t.address ?? "native"}
                    onClick={() => {
                      setToken(t);
                      setPickToken(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.06]"
                  >
                    <TokenIcon symbol={t.symbol} gradient={t.gradient} size={32} logo={t.logo} />
                    <span className="flex-1 text-left text-sm font-medium">{t.symbol}</span>
                    <span className="text-xs text-[var(--dw-muted)]">{formatToken(t.balance)}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ที่อยู่ปลายทาง */}
            <div>
              <label className="text-sm font-medium">{t("send.recipient")}</label>
              <div className="dw-glass mt-2 flex items-center gap-2 rounded-2xl px-4 py-3 focus-within:border-[var(--dw-cyan)]/50">
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="0x…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--dw-muted)]"
                  style={{ color: "var(--dw-text)" }}
                />
                <button className="text-[var(--dw-cyan)]"><Scan size={18} /></button>
              </div>
              {to.length > 0 && !addrValid && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--dw-rose)]">
                  <Warn size={13} /> {t("send.invalidAddr")}
                </p>
              )}
              {addrValid && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--dw-green)]">
                  <Check size={13} /> {t("send.validAddrPrefix")} {CHAIN.short}
                </p>
              )}
            </div>

            {/* สมุดที่อยู่ — จากประวัติธุรกรรมจริง */}
            {contacts.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-[var(--dw-muted)]">{t("send.recentList")}</p>
                <div className="space-y-1.5">
                  {contacts.map((c) => (
                    <button
                      key={c.address}
                      onClick={() => setTo(c.address)}
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
                      <span className="text-[10px] text-[var(--dw-muted)]">
                        {c.direction === "sent" ? t("send.sentBefore") : t("send.receivedFrom")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* จำนวน */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium">{t("send.amount")}</label>
                <button
                  onClick={() => setAmount(String(token.balance))}
                  className="text-xs font-medium text-[var(--dw-cyan)]"
                >
                  {t("tx.max")}
                </button>
              </div>
              <div className="dw-glass flex items-center gap-2 rounded-2xl px-4 py-3 focus-within:border-[var(--dw-cyan)]/50">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-[var(--dw-muted)]"
                  style={{ color: "var(--dw-text)" }}
                />
                <span className="text-sm font-medium text-[var(--dw-muted)]">{token.symbol}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-[var(--dw-muted)]">
                <span>{usd != null ? `≈ ${formatUsd(usd)}` : t("common.noPrice")}</span>
                {amt > token.balance && <span className="text-[var(--dw-rose)]">{t("swap.insufficient")}</span>}
              </div>
            </div>

            <button
              onClick={goConfirm}
              disabled={!canNext}
              className="dw-btn-primary w-full rounded-2xl py-4 font-semibold"
            >
              {t("send.reviewSend")}
            </button>
          </div>
        ) : (
          <div className="dw-rise flex flex-col">
            <div className="flex flex-col items-center py-4">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--dw-rose)]/12 text-[var(--dw-rose)]">
                <ArrowUp size={28} />
              </span>
              <p className="mt-4 text-3xl font-bold tabular-nums">
                {formatToken(amt, token.symbol)}
              </p>
              <p className="text-sm text-[var(--dw-muted)]">
                {usd != null ? `≈ ${formatUsd(usd)}` : t("common.noPrice")}
              </p>
            </div>

            <div className="dw-glass divide-y divide-white/8 rounded-2xl px-4">
              <Row label={t("send.from")} value={`${accounts[activeIndex]?.name || t("tx.account")} · ${address ? shortAddress(address) : "—"}`} />
              <Row label={t("send.to")} value={shortAddress(to)} />
              <Row label={t("common.network")} value={CHAIN.name} />
              <Row label={t("tx.gasEst")} value={gasFee === "loading" ? t("tx.estimating") : gasFee != null ? `≈ ${gasFee.toLocaleString("en-US", { maximumFractionDigits: 8 })} DAN` : "—"} />
            </div>

            <div className="dw-glass mt-4 flex items-start gap-2 rounded-2xl border-[var(--dw-green)]/25 bg-[var(--dw-green)]/[0.06] p-3.5 text-xs text-[var(--dw-muted)]">
              <Shield size={16} className="mt-0.5 shrink-0 text-[var(--dw-green)]" />
              {t("send.signNote")}
            </div>

            {!contacts.some((c) => c.address.toLowerCase() === to.toLowerCase()) && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-[var(--dw-amber)]/30 bg-[var(--dw-amber)]/[0.06] p-3 text-xs text-[var(--dw-amber)]">
                <Warn size={15} className="mt-0.5 shrink-0" />
                {t("send.firstTimeWarn")}
              </div>
            )}

            <button
              onClick={() => { setErr(null); setPin(""); setAskPin(true); }}
              className="dw-btn-primary mt-5 w-full rounded-2xl py-4 font-semibold"
            >
              {t("send.confirmSendPin")}
            </button>
          </div>
        )}
      </Screen>

      {/* ใส่ PIN เพื่อเซ็น */}
      <Sheet open={askPin} onClose={() => { setAskPin(false); setPin(""); }} title={t("tx.pinConfirm")}>
        <p className="mb-3 text-sm text-[var(--dw-muted)]">
          {t("send.sendPrefix")} {token ? formatToken(amt, token.symbol) : ""} {t("send.toMid")} {shortAddress(to)}
        </p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && pin.length === 6 && !sending && submit()}
          placeholder={t("tx.enterPin")}
          className="dw-glass w-full rounded-2xl px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-[var(--dw-cyan)]/50"
          style={{ color: "var(--dw-text)" }}
        />
        {err && (
          <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[var(--dw-rose)]">
            <Warn size={13} /> {err}
          </p>
        )}
        <button
          onClick={submit}
          disabled={pin.length < 6 || sending}
          className="dw-btn-primary mt-4 w-full rounded-2xl py-3.5 font-semibold"
        >
          {sending ? (status || t("send.signing")) : t("send.signSend")}
        </button>
      </Sheet>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <span className="text-[var(--dw-muted)]">{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}
