"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet/wallet-store";
import { Screen } from "@/components/wallet/PhoneShell";
import { TopBar } from "@/components/wallet/TopBar";
import { Sheet } from "@/components/wallet/Sheet";
import { shortAddress } from "@/lib/wallet/format";
import {
  hasProjectId, getWeb3Wallet, pair, approveSession, rejectSession,
  getActiveSessions, disconnectSession, describeRequest, respondRequest, rejectRequest,
} from "@/lib/wallet/walletconnect";
import { Shield, Warn, Check, Globe, Scan, Logout } from "@/components/wallet/Icons";

export default function ConnectPage() {
  const router = useRouter();
  const { hydrated, created, locked, address, getActivePrivateKey } = useWallet();

  const keyRef = React.useRef<string | null>(null);
  const [ready, setReady] = React.useState(false); // เปิดใช้การเซ็นแล้ว
  const [pin, setPin] = React.useState("");
  const [pinErr, setPinErr] = React.useState(false);

  const [uri, setUri] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);
  const [proposal, setProposal] = React.useState<any>(null);
  const [request, setRequest] = React.useState<any>(null);
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);

  const autoIntentRef = React.useRef(false);
  const autoPairedRef = React.useRef(false);
  const [incoming, setIncoming] = React.useState(false);

  // อ่าน URI ที่ส่งมากับลิงก์ (deep link จาก dApp / WalletConnect registry): /wallet/connect?uri=wc:...
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URLSearchParams(window.location.search).get("uri");
    if (u && u.length > 4) {
      setUri(u.startsWith("wc:") ? u : decodeURIComponent(u));
      autoIntentRef.current = true;
      setIncoming(true);
    }
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    if (!created) { router.replace("/wallet/unlock"); return; }
    // ถ้ามี URI เข้ามากับลิงก์ ไม่ต้องเด้งไปหน้า unlock — ให้ใส่ PIN เปิดการเซ็นในหน้านี้เลย
    const hasUri = !!new URLSearchParams(window.location.search).get("uri");
    if (locked && !hasUri) router.replace("/wallet/unlock");
  }, [hydrated, created, locked, router]);

  // ตั้งค่า event handlers เมื่อเปิดใช้การเซ็นแล้ว
  React.useEffect(() => {
    if (!ready || !hasProjectId()) return;
    let w: any;
    const onProposal = (p: any) => setProposal(p);
    const onRequest = (r: any) => setRequest(r);
    (async () => {
      try {
        w = await getWeb3Wallet();
        w.on("session_proposal", onProposal);
        w.on("session_request", onRequest);
        setSessions(await getActiveSessions());
      } catch (e: any) {
        setStatus(e?.message || "เริ่ม WalletConnect ไม่สำเร็จ");
      }
    })();
    return () => {
      if (w) {
        w.off?.("session_proposal", onProposal);
        w.off?.("session_request", onRequest);
      }
    };
  }, [ready]);

  const enableSigning = async () => {
    setPinErr(false);
    const k = await getActivePrivateKey(pin);
    if (!k) {
      setPinErr(true);
      return;
    }
    keyRef.current = k;
    setReady(true);
    setPin("");
  };

  const doPair = async () => {
    if (!uri.trim()) return;
    setBusy(true);
    setStatus("กำลังจับคู่กับ dApp…");
    try {
      await pair(uri);
      setUri("");
      setStatus("จับคู่แล้ว — รอ dApp ส่งคำขอเชื่อมต่อ");
    } catch (e: any) {
      setStatus(e?.message || "จับคู่ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  // จับคู่อัตโนมัติเมื่อมี URI จากลิงก์ + เปิดการเซ็นแล้ว (ทำครั้งเดียว)
  React.useEffect(() => {
    if (ready && autoIntentRef.current && !autoPairedRef.current && uri.trim()) {
      autoPairedRef.current = true;
      void doPair();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, uri]);

  const approve = async () => {
    if (!proposal || !address) return;
    setBusy(true);
    try {
      await approveSession(proposal, address);
      setSessions(await getActiveSessions());
      setStatus("เชื่อมต่อ dApp สำเร็จ");
    } catch (e: any) {
      setStatus(e?.message || "อนุมัติไม่สำเร็จ");
    } finally {
      setProposal(null);
      setBusy(false);
    }
  };

  const reject = async () => {
    if (proposal) await rejectSession(proposal).catch(() => {});
    setProposal(null);
  };

  const confirmRequest = async () => {
    if (!request || !keyRef.current) return;
    setBusy(true);
    try {
      await respondRequest(request, keyRef.current);
      setStatus("ลงนาม/ส่งธุรกรรมสำเร็จ");
    } catch (e: any) {
      setStatus(e?.message || "เซ็นไม่สำเร็จ");
    } finally {
      setRequest(null);
      setBusy(false);
    }
  };

  const denyRequest = async () => {
    if (request) await rejectRequest(request).catch(() => {});
    setRequest(null);
  };

  const disconnect = async (topic: string) => {
    await disconnectSession(topic).catch(() => {});
    setSessions(await getActiveSessions());
  };

  // ยังไม่ตั้งค่า Project ID
  if (!hasProjectId()) {
    return (
      <>
        <TopBar title="เชื่อม dApp" />
        <Screen className="flex flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--dw-amber)]/15 text-[var(--dw-amber)]">
            <Warn size={28} />
          </span>
          <h2 className="text-lg font-semibold">ต้องตั้งค่า WalletConnect ก่อน</h2>
          <p className="text-sm leading-relaxed text-[var(--dw-muted)]">
            ขอ Project ID ฟรีที่ <span className="text-[var(--dw-cyan)]">cloud.walletconnect.com</span><br />
            แล้วใส่ใน <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_WC_PROJECT_ID</code> ในไฟล์ .env แล้วรีสตาร์ท
          </p>
        </Screen>
      </>
    );
  }

  return (
    <>
      <TopBar title="เชื่อม dApp (WalletConnect)" />
      <Screen>
        {!ready ? (
          // ขั้นเปิดใช้การเซ็นด้วย PIN
          <div className="dw-rise pt-4">
            {incoming && (
              <div className="dw-glass mb-3 flex items-start gap-2.5 rounded-2xl border-[var(--dw-cyan)]/30 bg-[var(--dw-cyan)]/[0.06] p-3.5 text-sm text-[var(--dw-muted)]">
                <Globe size={18} className="mt-0.5 shrink-0 text-[var(--dw-cyan)]" />
                มีคำขอเชื่อมต่อจาก dApp — ใส่ PIN เพื่อเชื่อมต่ออัตโนมัติ
              </div>
            )}
            <div className="dw-glass mb-4 flex items-start gap-2.5 rounded-2xl p-4 text-sm text-[var(--dw-muted)]">
              <Shield size={18} className="mt-0.5 shrink-0 text-[var(--dw-green)]" />
              ใส่ PIN เพื่อปลดล็อกการเซ็นชั่วคราว — กุญแจจะอยู่ในหน่วยความจำเฉพาะหน้านี้
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && pin.length === 6 && enableSigning()}
              placeholder="ใส่ PIN 6 หลัก"
              className="dw-glass w-full rounded-2xl px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-[var(--dw-cyan)]/50"
              style={{ color: "var(--dw-text)" }}
            />
            {pinErr && (
              <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[var(--dw-rose)]">
                <Warn size={13} /> PIN ไม่ถูกต้อง
              </p>
            )}
            <button
              onClick={enableSigning}
              disabled={pin.length < 6}
              className="dw-btn-primary mt-4 w-full rounded-2xl py-3.5 font-semibold"
            >
              เปิดใช้การเซ็น
            </button>
          </div>
        ) : (
          <div className="dw-rise">
            {/* วาง URI */}
            <p className="mb-2 px-1 text-xs font-medium text-[var(--dw-muted)]">วางลิงก์เชื่อมต่อจาก dApp</p>
            <div className="dw-glass flex items-center gap-2 rounded-2xl px-4 py-3 focus-within:border-[var(--dw-cyan)]/50">
              <input
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doPair()}
                placeholder="wc:..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
                style={{ color: "var(--dw-text)" }}
              />
              <button className="text-[var(--dw-cyan)]"><Scan size={18} /></button>
            </div>
            <button
              onClick={doPair}
              disabled={!uri.trim() || busy}
              className="dw-btn-primary mt-3 w-full rounded-2xl py-3.5 font-semibold"
            >
              เชื่อมต่อ
            </button>

            {status && (
              <div className="dw-glass mt-3 flex items-start gap-2 rounded-2xl p-3 text-xs text-[var(--dw-muted)]">
                <Globe size={14} className="mt-0.5 shrink-0 text-[var(--dw-cyan)]" /> {status}
              </div>
            )}

            <p className="mt-2 px-1 text-[11px] text-[var(--dw-muted)]">
              เชื่อมในชื่อ {address ? shortAddress(address) : "—"} · เครือข่าย Danny Chain (5069)
            </p>

            {/* session ที่เชื่อมอยู่ */}
            {sessions.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 px-1 text-xs font-medium text-[var(--dw-muted)]">dApp ที่เชื่อมอยู่</p>
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div key={s.topic} className="dw-glass flex items-center gap-3 rounded-2xl px-3.5 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--dw-violet)]/15 text-[var(--dw-purple)]">
                        <Globe size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.peer?.metadata?.name || "dApp"}</p>
                        <p className="truncate text-xs text-[var(--dw-muted)]">{s.peer?.metadata?.url}</p>
                      </div>
                      <button onClick={() => disconnect(s.topic)} className="text-[var(--dw-rose)]">
                        <Logout size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Screen>

      {/* อนุมัติ session */}
      <Sheet open={!!proposal} onClose={reject} title="คำขอเชื่อมต่อ">
        <div className="text-center">
          <p className="font-semibold">{proposal?.params?.proposer?.metadata?.name || "dApp"}</p>
          <p className="text-xs text-[var(--dw-muted)]">{proposal?.params?.proposer?.metadata?.url}</p>
        </div>
        <div className="dw-glass mt-4 space-y-2 rounded-2xl p-4 text-sm">
          <div className="flex justify-between"><span className="text-[var(--dw-muted)]">เครือข่าย</span><span className="font-medium">Danny Chain (5069)</span></div>
          <div className="flex justify-between"><span className="text-[var(--dw-muted)]">บัญชี</span><span className="font-medium">{address ? shortAddress(address) : "—"}</span></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={reject} className="dw-btn-ghost rounded-2xl py-3.5 font-semibold">ปฏิเสธ</button>
          <button onClick={approve} disabled={busy} className="dw-btn-primary rounded-2xl py-3.5 font-semibold">อนุมัติ</button>
        </div>
      </Sheet>

      {/* ยืนยันคำขอเซ็น */}
      <Sheet open={!!request} onClose={denyRequest} title="คำขอลงนาม">
        <div className="dw-glass flex items-start gap-2 rounded-2xl border-[var(--dw-amber)]/30 bg-[var(--dw-amber)]/[0.06] p-3.5 text-xs text-[var(--dw-muted)]">
          <Warn size={16} className="mt-0.5 shrink-0 text-[var(--dw-amber)]" />
          ตรวจสอบสิ่งที่จะลงนามให้ดี — การลงนามอาจอนุญาตให้ dApp ทำธุรกรรมแทนคุณ
        </div>
        <div className="dw-glass mt-3 rounded-2xl p-4 text-sm">
          <p className="break-words">
            {request ? describeRequest(request.params?.request?.method, request.params?.request?.params || []) : ""}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={denyRequest} className="dw-btn-ghost rounded-2xl py-3.5 font-semibold">ปฏิเสธ</button>
          <button onClick={confirmRequest} disabled={busy} className="dw-btn-primary rounded-2xl py-3.5 font-semibold">
            <Check size={16} className="mr-1 inline" /> ยืนยันเซ็น
          </button>
        </div>
      </Sheet>
    </>
  );
}
