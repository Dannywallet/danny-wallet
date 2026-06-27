"use client";

// WalletConnect v2 (ฝั่ง wallet) — ให้ Danny Wallet เชื่อมกับ dApp ใด ๆ ผ่าน WalletConnect relay
import { Core } from "@walletconnect/core";
import { Web3Wallet, type IWeb3Wallet } from "@walletconnect/web3wallet";
import { buildApprovedNamespaces, getSdkError } from "@walletconnect/utils";
import { JsonRpcProvider, Wallet, getBytes, toUtf8String, Interface } from "ethers";
import { shortAddress } from "./format";

const PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";

// decode ธุรกรรม ERC-20 ที่พบบ่อย เพื่อแสดงให้ผู้ใช้เห็นก่อนเซ็น
const ERC20_IFACE = new Interface([
  "function transfer(address to, uint256 amount)",
  "function approve(address spender, uint256 amount)",
  "function transferFrom(address from, address to, uint256 amount)",
]);
const HALF_MAX_UINT = ((1n << 256n) - 1n) / 2n;
const RPC = "https://rpc.dannyscan.com";
export const WC_CHAIN = "eip155:5069";

export function hasProjectId(): boolean {
  return !!PROJECT_ID;
}

let instance: IWeb3Wallet | null = null;
let initPromise: Promise<IWeb3Wallet> | null = null;

export async function getWeb3Wallet(): Promise<IWeb3Wallet> {
  if (instance) return instance;
  if (!PROJECT_ID) throw new Error("ยังไม่ได้ตั้งค่า WalletConnect Project ID");
  if (!initPromise) {
    initPromise = (async () => {
      const core = new Core({ projectId: PROJECT_ID });
      instance = await Web3Wallet.init({
        // cast: @walletconnect/core ติดตั้งสำเนา @walletconnect/types ซ้อนกัน ทำให้ type ไม่ตรง (ปลอดภัยตอนรันไทม์)
        core: core as unknown as Parameters<typeof Web3Wallet.init>[0]["core"],
        metadata: {
          name: "Danny Wallet",
          description: "Self-custody wallet for Danny Chain (5069)",
          url: "https://app.dannywallet.com",
          icons: ["https://dannywallet.com/logo-src.png"],
        },
      });
      return instance;
    })();
  }
  return initPromise;
}

export async function pair(uri: string): Promise<void> {
  const clean = (uri || "").trim();
  // ตรวจรูปแบบ WalletConnect v2 URI ก่อน เพื่อกัน error "atob ... not correctly encoded"
  // ที่เกิดเมื่อสตริงไม่ใช่ลิงก์ wc: ที่ถูกต้อง (เช่นคัดลอกไม่ครบ)
  if (!/^wc:[0-9a-f]+@2/i.test(clean) || !/symKey=[0-9a-fA-F]+/.test(clean)) {
    throw new Error("ลิงก์ WalletConnect ไม่ถูกต้อง — คัดลอก URI (ขึ้นต้น wc:) จาก dApp ใหม่อีกครั้ง");
  }
  const w = await getWeb3Wallet();
  try {
    await w.pair({ uri: clean });
  } catch (e: any) {
    if (/atob|not correctly encoded|decode/i.test(e?.message || "")) {
      throw new Error("ลิงก์ WalletConnect ไม่ถูกต้องหรือหมดอายุ — ขอ URI ใหม่จาก dApp แล้วลองอีกครั้ง");
    }
    throw e;
  }
}

/** อนุมัติ session — รองรับเฉพาะ Danny Chain (5069) */
export async function approveSession(proposal: any, address: string) {
  const w = await getWeb3Wallet();
  const namespaces = buildApprovedNamespaces({
    proposal: proposal.params,
    supportedNamespaces: {
      eip155: {
        chains: [WC_CHAIN],
        methods: [
          "eth_sendTransaction",
          "personal_sign",
          "eth_sign",
          "eth_signTypedData",
          "eth_signTypedData_v4",
        ],
        events: ["chainChanged", "accountsChanged"],
        accounts: [`${WC_CHAIN}:${address}`],
      },
    },
  });
  return w.approveSession({ id: proposal.id, namespaces });
}

export async function rejectSession(proposal: any) {
  const w = await getWeb3Wallet();
  return w.rejectSession({ id: proposal.id, reason: getSdkError("USER_REJECTED") });
}

export async function getActiveSessions() {
  const w = await getWeb3Wallet();
  return Object.values(w.getActiveSessions());
}

export async function disconnectSession(topic: string) {
  const w = await getWeb3Wallet();
  return w.disconnectSession({ topic, reason: getSdkError("USER_DISCONNECTED") });
}

/** สรุปคำขอเซ็นเพื่อแสดงในหน้ายืนยัน */
export function describeRequest(method: string, params: any[]): string {
  switch (method) {
    case "eth_sendTransaction": {
      const t = params[0] || {};
      const valWei = t.value ? BigInt(t.value) : 0n;
      const dan = Number(valWei) / 1e18;
      const data: string = t.data || "0x";
      // มี calldata = เรียกสัญญา → พยายาม decode เมธอด ERC-20 ที่พบบ่อย
      if (data && data !== "0x" && data.length >= 10) {
        try {
          const p = ERC20_IFACE.parseTransaction({ data, value: valWei });
          if (p?.name === "transfer")
            return `โอนโทเคน → ${shortAddress(p.args.to)} · ${p.args.amount.toString()} (หน่วยฐาน) · contract ${shortAddress(t.to)}`;
          if (p?.name === "transferFrom")
            return `โอนโทเคนจาก ${shortAddress(p.args.from)} → ${shortAddress(p.args.to)} · contract ${shortAddress(t.to)}`;
          if (p?.name === "approve") {
            const unlimited = BigInt(p.args.amount) >= HALF_MAX_UINT;
            return `⚠️ อนุมัติ (approve) ให้ ${shortAddress(p.args.spender)} ใช้โทเคน${unlimited ? " แบบไม่จำกัด ⚠️" : ` จำนวน ${p.args.amount.toString()} (หน่วยฐาน)`} · contract ${shortAddress(t.to)}`;
          }
        } catch {
          /* decode ไม่ได้ → แสดงเป็นการเรียกสัญญาแบบทั่วไป */
        }
        return `⚠️ เรียกสัญญา ${shortAddress(t.to)} · เมธอด ${data.slice(0, 10)}${dan > 0 ? ` · ${dan} DAN` : ""} (ตรวจสอบให้แน่ใจก่อนเซ็น)`;
      }
      return `ส่ง ${dan} DAN → ${t.to ? shortAddress(t.to) : "(สร้างสัญญา)"}`;
    }
    case "personal_sign":
      try {
        return `ลงนามข้อความ: "${toUtf8String(params[0])}"`;
      } catch {
        return "ลงนามข้อความ";
      }
    case "eth_sign":
      return "⚠️ ลงนามข้อมูลดิบ (eth_sign) — เซ็นเฉพาะ dApp ที่เชื่อถือเท่านั้น ⚠️";
    case "eth_signTypedData":
    case "eth_signTypedData_v4":
      try {
        const data = typeof params[1] === "string" ? JSON.parse(params[1]) : params[1];
        const pt = String(data?.primaryType || "");
        const dom = data?.domain?.name ? ` · ${data.domain.name}` : "";
        const m = data?.message || {};
        // Permit = อนุมัติโทเคนผ่านลายเซ็น (gasless approve) — ช่องทางดูดเงินยอดนิยม → เตือนเข้ม + โชว์ spender/จำนวน
        if (/permit/i.test(pt)) {
          const spender = m.spender ? shortAddress(String(m.spender)) : "?";
          const val = m.value ?? m.allowed;
          const amt = val != null ? ` · จำนวน ${String(val)} (หน่วยฐาน)` : "";
          return `⚠️ Permit — อนุญาตให้ ${spender} ใช้โทเคนผ่านลายเซ็น (เหมือน approve)${amt}${dom} · ตรวจสอบให้แน่ใจก่อนเซ็น! ⚠️`;
        }
        return `ลงนาม typed data: ${pt || "ไม่ทราบชนิด"}${dom} (ตรวจสอบเนื้อหาก่อนเซ็น)`;
      } catch {
        return "ลงนามข้อมูลแบบ typed data (ตรวจสอบให้แน่ใจก่อนเซ็น)";
      }
    default:
      return method;
  }
}

/** ตรวจว่าคำขอเป็นการอนุมัติโทเคน "แบบไม่จำกัด" (approve unlimited / Permit unlimited) → ต้องยืนยันพิเศษ */
export function isUnlimitedApproval(method: string, params: any[]): boolean {
  try {
    if (method === "eth_sendTransaction") {
      const data: string = params?.[0]?.data || "0x";
      if (data.length < 10) return false;
      const p = ERC20_IFACE.parseTransaction({ data });
      return p?.name === "approve" && BigInt(p.args.amount) >= HALF_MAX_UINT;
    }
    if (method === "eth_signTypedData" || method === "eth_signTypedData_v4") {
      const d = typeof params?.[1] === "string" ? JSON.parse(params[1]) : params?.[1];
      if (!/permit/i.test(String(d?.primaryType || ""))) return false;
      const m = d?.message || {};
      if (m.allowed === true) return true; // DAI-style permit = อนุญาตไม่จำกัด
      return m.value != null && BigInt(m.value) >= HALF_MAX_UINT;
    }
  } catch {
    /* parse ไม่ได้ → ถือว่าไม่ใช่ */
  }
  return false;
}

/** ตอบคำขอเซ็น — เซ็นด้วย private key ของบัญชีที่ใช้งานอยู่ */
export async function respondRequest(event: any, privateKey: string): Promise<void> {
  const w = await getWeb3Wallet();
  const { topic, params, id } = event;
  const { request } = params;
  const provider = new JsonRpcProvider(RPC, 5069);
  const signer = new Wallet(privateKey, provider);

  let result: string;
  try {
    switch (request.method) {
      case "personal_sign":
      case "eth_sign": {
        // personal_sign: [message, address] / eth_sign: [address, message]
        const msg = request.method === "personal_sign" ? request.params[0] : request.params[1];
        result = await signer.signMessage(getBytes(msg));
        break;
      }
      case "eth_signTypedData":
      case "eth_signTypedData_v4": {
        const data = JSON.parse(request.params[1]);
        // ตัด EIP712Domain ออกจาก types ก่อนเซ็น (ethers ใส่ให้เอง)
        const { EIP712Domain, ...types } = data.types;
        result = await signer.signTypedData(data.domain, types, data.message);
        break;
      }
      case "eth_sendTransaction": {
        const tx = request.params[0];
        const sent = await signer.sendTransaction({
          to: tx.to,
          value: tx.value ?? 0n,
          data: tx.data,
          gasLimit: tx.gas,
        });
        result = sent.hash;
        break;
      }
      default:
        throw new Error(`ไม่รองรับเมธอด ${request.method}`);
    }
    await w.respondSessionRequest({ topic, response: { id, jsonrpc: "2.0", result } });
  } catch (e: any) {
    await w.respondSessionRequest({
      topic,
      response: { id, jsonrpc: "2.0", error: { code: 5000, message: e?.message || "ผู้ใช้ปฏิเสธ" } },
    });
    throw e;
  }
}

export async function rejectRequest(event: any): Promise<void> {
  const w = await getWeb3Wallet();
  await w.respondSessionRequest({
    topic: event.topic,
    response: { id: event.id, jsonrpc: "2.0", error: getSdkError("USER_REJECTED") },
  });
}
