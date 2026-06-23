"use client";

import React from "react";
import { Screen } from "@/components/wallet/PhoneShell";
import { TopBar } from "@/components/wallet/TopBar";
import { BottomNav } from "@/components/wallet/BottomNav";
import { TokenIcon } from "@/components/wallet/TokenIcon";
import { useSwapTokens, type WToken } from "@/lib/wallet/use-holdings";
import { formatUsd, formatToken } from "@/lib/wallet/format";
import { Sheet } from "@/components/wallet/Sheet";
import { useWallet } from "@/lib/wallet/wallet-store";
import { Swap as SwapIcon, ChevronRight, Check, Shield, Warn } from "@/components/wallet/Icons";
import { executeSwap, estimateSwapFee, explorerTx } from "@/lib/wallet/dandex-swap";
import { shortAddress } from "@/lib/wallet/format";

export default function SwapPage() {
  const { tokens, state } = useSwapTokens();
  const { address, getActivePrivateKey } = useWallet();
  const [from, setFrom] = React.useState<WToken | null>(null);
  const [to, setTo] = React.useState<WToken | null>(null);
  const [amount, setAmount] = React.useState("");
  const [picking, setPicking] = React.useState<null | "from" | "to">(null);
  const [slippage, setSlippage] = React.useState(0.5);

  // สถานะธุรกรรม
  const [phase, setPhase] = React.useState<"idle" | "swapping" | "done">("idle");
  const [statusText, setStatusText] = React.useState<string>("");
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState("");
  const [askPin, setAskPin] = React.useState(false);
  const [gasFee, setGasFee] = React.useState<number | null | "loading">(null);

  const openPin = async () => {
    if (!from || !to || !address) return;
    setErr(null);
    setPin("");
    setAskPin(true);
    setGasFee("loading");
    const fee = await estimateSwapFee({
      fromToken: { address: from.address, symbol: from.symbol },
      toToken: { address: to.address, symbol: to.symbol },
      amount,
      account: address,
      slippagePct: slippage,
    });
    setGasFee(fee);
  };

  // ตั้งค่าเริ่มต้นเมื่อโหลด token เสร็จ (จ่าย = ตัวที่มีมูลค่ามากสุด, รับ = DAN/ตัวถัดไป)
  React.useEffect(() => {
    if (state !== "ok" || tokens.length < 2 || from) return;
    const priced = tokens.filter((t) => t.priceUsd != null);
    const base = priced[0] || tokens[0];
    const quote = tokens.find((t) => t.symbol !== base.symbol && t.priceUsd != null) || tokens[1];
    setFrom(base);
    setTo(quote);
  }, [state, tokens, from]);

  const amt = parseFloat(amount) || 0;
  const rate = from?.priceUsd && to?.priceUsd ? from.priceUsd / to.priceUsd : null;
  const out = rate != null ? amt * rate : 0;
  const enough = !!from && amt > 0 && amt <= from.balance;

  const flip = () => {
    setFrom(to);
    setTo(from);
    setAmount("");
  };

  const choose = (t: WToken) => {
    if (picking === "from") {
      if (t.symbol === to?.symbol) setTo(from);
      setFrom(t);
    } else {
      if (t.symbol === from?.symbol) setFrom(to);
      setTo(t);
    }
    setPicking(null);
  };

  const submit = async () => {
    if (!from || !to) return;
    setErr(null);
    setPhase("swapping");
    setStatusText("กำลังเตรียมธุรกรรม…");
    try {
      const privateKey = await getActivePrivateKey(pin);
      if (!privateKey) {
        setErr("PIN ไม่ถูกต้อง");
        setPhase("idle");
        setStatusText("");
        return;
      }
      const hash = await executeSwap({
        from: { address: from.address, symbol: from.symbol },
        to: { address: to.address, symbol: to.symbol },
        amount,
        slippagePct: slippage,
        privateKey,
        onPhase: (p) =>
          setStatusText(
            p === "approve"
              ? `กำลังอนุมัติ ${from.symbol}…`
              : p === "swap"
              ? "กำลังลงนามและสลับ…"
              : "กำลังเตรียมธุรกรรม…"
          ),
      });
      setTxHash(hash);
      setAskPin(false);
      setPin("");
      setStatusText("");
      setPhase("done");
      setTimeout(() => {
        setPhase("idle");
        setAmount("");
        setTxHash(null);
      }, 6000);
    } catch (e: any) {
      setErr(e?.shortMessage || e?.message || "swap ไม่สำเร็จ");
      setPhase("idle");
      setStatusText("");
    }
  };

  return (
    <>
      <TopBar title="สลับเหรียญ" right={<span className="text-xs text-[var(--dw-muted)]">dandex</span>} />
      <Screen>
        {state === "loading" || !from || !to ? (
          state === "error" ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <Warn size={30} className="text-[var(--dw-rose)]" />
              <p className="text-sm text-[var(--dw-muted)]">โหลดเหรียญจากเชนไม่สำเร็จ</p>
            </div>
          ) : (
            <div className="space-y-2.5 pt-2">
              <div className="dw-glass dw-shimmer h-32 rounded-3xl" />
              <div className="dw-glass dw-shimmer h-32 rounded-3xl" />
              <div className="dw-glass dw-shimmer h-28 rounded-2xl" />
            </div>
          )
        ) : phase === "done" ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="grid h-24 w-24 place-items-center rounded-full bg-[var(--dw-green)]/15 text-[var(--dw-green)] dw-pulse-ring">
              <Check size={44} />
            </span>
            <h1 className="mt-6 text-xl font-semibold">ส่งธุรกรรมสำเร็จ</h1>
            <p className="mt-2 text-sm text-[var(--dw-muted)]">
              {formatToken(amt, from.symbol)} → {formatToken(out, to.symbol)}
            </p>
            {txHash && (
              <a
                href={explorerTx(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="dw-btn-ghost mt-5 rounded-xl px-4 py-2 text-xs"
              >
                ดูธุรกรรมบน Dannyscan ↗
              </a>
            )}
          </div>
        ) : (
          <div className="dw-rise">
            {/* การ์ด from/to */}
            <div className="relative space-y-2">
              <SwapBox
                label="จ่าย"
                token={from}
                amount={amount}
                onAmount={setAmount}
                onPick={() => setPicking("from")}
                max
                onMax={() => setAmount(String(from.balance))}
              />
              <button
                onClick={flip}
                className="dw-btn-primary absolute left-1/2 top-1/2 z-10 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
                aria-label="สลับทิศทาง"
              >
                <SwapIcon size={20} />
              </button>
              <SwapBox
                label="รับ"
                token={to}
                amount={amt && rate != null ? formatToken(out) : ""}
                readOnly
                onPick={() => setPicking("to")}
              />
            </div>

            {/* ตัวเลือกเหรียญ */}
            {picking && (
              <div className="dw-glass mt-3 max-h-72 space-y-1 overflow-y-auto rounded-2xl p-2">
                {tokens.map((t) => (
                  <button
                    key={t.address ?? "native"}
                    onClick={() => choose(t)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.06]"
                  >
                    <TokenIcon symbol={t.symbol} gradient={t.gradient} size={32} logo={t.logo} />
                    <span className="flex-1 text-left text-sm font-medium">{t.symbol}</span>
                    <span className="text-xs text-[var(--dw-muted)]">{formatToken(t.balance)}</span>
                  </button>
                ))}
              </div>
            )}

            {/* รายละเอียด */}
            <div className="dw-glass mt-4 space-y-2.5 rounded-2xl p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--dw-muted)]">อัตราแลกเปลี่ยน</span>
                <span className="font-medium">
                  {rate != null ? `1 ${from.symbol} ≈ ${formatToken(rate)} ${to.symbol}` : "ไม่มีราคา"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--dw-muted)]">Slippage</span>
                <div className="flex gap-1.5">
                  {[0.5, 1, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSlippage(s)}
                      className={`rounded-lg px-2 py-0.5 text-xs ${
                        slippage === s ? "dw-btn-primary" : "dw-btn-ghost text-[var(--dw-muted)]"
                      }`}
                    >
                      {s}%
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--dw-muted)]">มูลค่าโดยประมาณ</span>
                <span className="font-medium">
                  {from.priceUsd != null ? formatUsd(amt * from.priceUsd) : "—"}
                </span>
              </div>
            </div>

            <div className="dw-glass mt-3 flex items-start gap-2 rounded-2xl border-[var(--dw-green)]/25 bg-[var(--dw-green)]/[0.06] p-3 text-xs text-[var(--dw-muted)]">
              <Shield size={15} className="mt-0.5 shrink-0 text-[var(--dw-green)]" />
              สลับจริงผ่าน router ของ dandex — ลงนามด้วยกุญแจของบัญชี {address ? shortAddress(address) : ""} ในแอป (ใส่ PIN)
            </div>

            <button
              onClick={openPin}
              disabled={!enough || rate == null}
              className="dw-btn-primary mt-5 w-full rounded-2xl py-4 font-semibold"
            >
              {rate == null ? "คู่นี้ไม่มีราคา" : !amt ? "กรอกจำนวน" : !enough ? "ยอดไม่พอ" : "สลับ (ใส่ PIN)"}
            </button>
          </div>
        )}
      </Screen>

      {/* ใส่ PIN เพื่อเซ็น swap */}
      <Sheet open={askPin} onClose={() => { setAskPin(false); setPin(""); }} title="ยืนยันด้วย PIN">
        {from && to && (
          <p className="mb-2 text-sm text-[var(--dw-muted)]">
            สลับ {formatToken(amt, from.symbol)} → ~{formatToken(out, to.symbol)}
          </p>
        )}
        <p className="mb-3 text-xs text-[var(--dw-muted)]">
          ค่าแก๊ส (ประเมิน):{" "}
          {gasFee === "loading" ? "กำลังประเมิน…" : gasFee != null ? `≈ ${gasFee.toLocaleString("en-US", { maximumFractionDigits: 8 })} DAN` : "ประเมินไม่ได้ (อาจต้อง approve ก่อน)"}
        </p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && pin.length === 6 && phase !== "swapping" && submit()}
          placeholder="ใส่ PIN 6 หลัก"
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
          disabled={pin.length < 6 || phase === "swapping"}
          className="dw-btn-primary mt-4 w-full rounded-2xl py-3.5 font-semibold"
        >
          {phase === "swapping" ? statusText || "กำลังดำเนินการ…" : "ลงนามและสลับ"}
        </button>
      </Sheet>
      <BottomNav />
    </>
  );
}

function SwapBox({
  label,
  token,
  amount,
  onAmount,
  onPick,
  readOnly,
  max,
  onMax,
}: {
  label: string;
  token: WToken;
  amount: string;
  onAmount?: (v: string) => void;
  onPick: () => void;
  readOnly?: boolean;
  max?: boolean;
  onMax?: () => void;
}) {
  return (
    <div className="dw-glass rounded-3xl p-4">
      <div className="flex items-center justify-between text-xs text-[var(--dw-muted)]">
        <span>{label}</span>
        <span>
          คงเหลือ {formatToken(token.balance, token.symbol)}
          {max && (
            <button onClick={onMax} className="ml-2 font-medium text-[var(--dw-cyan)]">สูงสุด</button>
          )}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={amount}
          onChange={(e) => onAmount?.(e.target.value)}
          readOnly={readOnly}
          type={readOnly ? "text" : "number"}
          placeholder="0.00"
          className="min-w-0 flex-1 bg-transparent text-2xl font-bold outline-none placeholder:text-white/25"
          style={{ color: "var(--dw-text)" }}
        />
        <button onClick={onPick} className="dw-btn-ghost flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3">
          <TokenIcon symbol={token.symbol} gradient={token.gradient} size={28} logo={token.logo} />
          <span className="font-semibold">{token.symbol}</span>
          <ChevronRight size={16} className="text-[var(--dw-muted)]" />
        </button>
      </div>
    </div>
  );
}
