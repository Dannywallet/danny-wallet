// Danny Chain Wallet — ข้อมูลสมมติทั้งหมด (DEMO ONLY, ไม่ใช่เงินจริง)

export const CHAIN = {
  name: "Danny Chain",
  short: "Danny",
  symbol: "DNY",
  chainId: 5069,
  rpc: "https://rpc.dannychain.demo", // ปลอม
  explorer: "https://scan.dannychain.demo", // ปลอม
};

// ที่อยู่จริงบน Danny Chain (5069) ที่มีทั้งยอดถือครองและธุรกรรมจริง — ใช้สาธิตข้อมูลจริง
export const MY_ADDRESS = "0x507734667b4B4C4f8D4C58DDcEDCb4DA2bAA878D";

export type Token = {
  symbol: string;
  name: string;
  /** สีไล่เฉดของไอคอน */
  gradient: [string, string];
  balance: number;
  priceUsd: number;
  change24h: number;
  /** จุดราคา 24 ชม. สำหรับ sparkline */
  spark: number[];
  isNative?: boolean;
};

function wave(base: number, amp: number, n = 24, seed = 1): number[] {
  const out: number[] = [];
  let x = seed;
  for (let i = 0; i < n; i++) {
    x = (x * 9301 + 49297) % 233280;
    const r = x / 233280;
    out.push(base + Math.sin(i / 2.4) * amp + (r - 0.5) * amp * 0.8);
  }
  return out;
}

export const TOKENS: Token[] = [
  {
    symbol: "DNY",
    name: "Danny",
    gradient: ["#7c3aed", "#22d3ee"],
    balance: 18420.5,
    priceUsd: 2.41,
    change24h: 6.82,
    spark: wave(2.41, 0.18, 24, 7),
    isNative: true,
  },
  {
    symbol: "dUSD",
    name: "Danny USD",
    gradient: ["#22d3ee", "#34d399"],
    balance: 5230.0,
    priceUsd: 1.0,
    change24h: 0.01,
    spark: wave(1.0, 0.004, 24, 11),
  },
  {
    symbol: "dBTC",
    name: "Danny BTC",
    gradient: ["#f59e0b", "#f43f5e"],
    balance: 0.184,
    priceUsd: 68250.0,
    change24h: -1.94,
    spark: wave(68250, 900, 24, 3),
  },
  {
    symbol: "dETH",
    name: "Danny ETH",
    gradient: ["#6366f1", "#a855f7"],
    balance: 2.65,
    priceUsd: 3580.0,
    change24h: 3.27,
    spark: wave(3580, 80, 24, 5),
  },
  {
    symbol: "STARK",
    name: "Starlight",
    gradient: ["#ec4899", "#8b5cf6"],
    balance: 12750,
    priceUsd: 0.094,
    change24h: 14.5,
    spark: wave(0.094, 0.012, 24, 9),
  },
];

export function tokenBySymbol(symbol: string): Token | undefined {
  return TOKENS.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase());
}

export function totalUsd(): number {
  return TOKENS.reduce((s, t) => s + t.balance * t.priceUsd, 0);
}

export function totalChange24h(): number {
  const total = totalUsd();
  if (total === 0) return 0;
  const weighted = TOKENS.reduce(
    (s, t) => s + (t.balance * t.priceUsd) * (t.change24h / 100),
    0
  );
  return (weighted / total) * 100;
}

export type Tx = {
  id: string;
  type: "send" | "receive" | "swap";
  token: string;
  toToken?: string;
  amount: number;
  toAmount?: number;
  valueUsd?: number | null; // มูลค่า USD จริง (ถ้ามีราคา)
  counterparty: string;
  timestamp: number; // ms
  status: "confirmed" | "pending" | "failed";
};

const now = Date.now();
const h = 3600_000;

export const TRANSACTIONS: Tx[] = [
  { id: "0xa1", type: "receive", token: "DNY", amount: 1200, counterparty: "0x39c2…D4a9", timestamp: now - 0.4 * h, status: "confirmed" },
  { id: "0xa2", type: "swap", token: "dUSD", toToken: "DNY", amount: 500, toAmount: 207.4, counterparty: "Danny DEX", timestamp: now - 3 * h, status: "confirmed" },
  { id: "0xa3", type: "send", token: "dETH", amount: 0.35, counterparty: "0x88aF…1b20", timestamp: now - 9 * h, status: "confirmed" },
  { id: "0xa4", type: "receive", token: "STARK", amount: 4000, counterparty: "0x5d1e…77c0", timestamp: now - 26 * h, status: "confirmed" },
  { id: "0xa5", type: "send", token: "dUSD", amount: 250, counterparty: "0xBeef…cafe", timestamp: now - 50 * h, status: "pending" },
  { id: "0xa6", type: "swap", token: "dBTC", toToken: "dUSD", amount: 0.01, toAmount: 682.5, counterparty: "Danny DEX", timestamp: now - 74 * h, status: "confirmed" },
  { id: "0xa7", type: "send", token: "DNY", amount: 90, counterparty: "0x1234…abcd", timestamp: now - 120 * h, status: "failed" },
];

export function txForToken(symbol: string): Tx[] {
  return TRANSACTIONS.filter(
    (t) => t.token === symbol || t.toToken === symbol
  );
}

export type Contact = { name: string; address: string };

export const CONTACTS: Contact[] = [
  { name: "Nong (Savings)", address: "0x39c2A4b1c8D9e0F1a2B3c4D5e6F7a8B9c0D1D4a9" },
  { name: "Danny DEX Router", address: "0x88aF12cD34eF56aB78cD90eF12aB34cD56eF1b20" },
  { name: "Cold Storage", address: "0x5d1eAb22Cc33Dd44Ee55Ff66aA77Bb88Cc99077c" },
];

/** seed phrase สมมติ — แสดงในเดโมเท่านั้น ห้ามใช้กับเงินจริง */
export const DEMO_SEED = [
  "river", "neon", "cosmic", "harbor",
  "violet", "anchor", "summit", "pixel",
  "orbit", "lantern", "meadow", "quartz",
];
