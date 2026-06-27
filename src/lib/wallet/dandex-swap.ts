"use client";

// เซ็นด้วยกุญแจในแอป (บัญชีที่ใช้งานอยู่) + ทำ swap/send จริงผ่าน RPC ของ Danny Chain 5069
import { Contract, JsonRpcProvider, Wallet, parseUnits, type Provider } from "ethers";

export const CHAIN_ID = 5069;
export const CHAIN_ID_HEX = "0x" + (5069).toString(16);
export const ROUTER = "0x708E8574D232E57f6593734b4110EFEE2a079CdF"; // dandex router (UniswapV2)
export const WDAN = "0xBEe33b6B1C3df2c4468510E87d6330daA5709F3E"; // Wrapped DAN (= WETH ของ router)
// base สำหรับ routing — หลายโทเคนมีสภาพคล่องอยู่ในคู่ USDT ไม่ใช่ WDAN (เช่น SDC, GMX, DS)
const USDT_BASE = "0xb9BFa68B6774612e66eB693C7a0D00B2Eb6BCdee";
const RPC = "https://rpc.dannyscan.com";
const EXPLORER = "https://dannyscan.com";

const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] path) view returns (uint[])",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[])",
  "function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) payable returns (uint[])",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[])",
];
const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

const DANNY_CHAIN_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "Danny Chain",
  nativeCurrency: { name: "Danny", symbol: "DAN", decimals: 18 },
  rpcUrls: [RPC],
  blockExplorerUrls: [EXPLORER],
};

function getEthereum(): any | null {
  if (typeof window === "undefined") return null;
  return (window as any).ethereum ?? null;
}

export function hasWallet(): boolean {
  return !!getEthereum();
}

/** เชื่อมกระเป๋า + สลับไป Danny Chain 5069 (เพิ่มเครือข่ายให้ถ้ายังไม่มี) → คืน address */
export async function connectWallet(): Promise<string> {
  const eth = getEthereum();
  if (!eth) throw new Error("ไม่พบกระเป๋า — กรุณาติดตั้ง MetaMask");
  const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
  const account = accounts?.[0];
  if (!account) throw new Error("ไม่ได้รับอนุญาตเข้าถึงบัญชี");

  const current: string = await eth.request({ method: "eth_chainId" });
  if (current?.toLowerCase() !== CHAIN_ID_HEX) {
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
    } catch (err: any) {
      // 4902 = ยังไม่มีเครือข่ายนี้ → เพิ่มก่อน
      if (err?.code === 4902) {
        await eth.request({ method: "wallet_addEthereumChain", params: [DANNY_CHAIN_PARAMS] });
      } else {
        throw err;
      }
    }
  }
  return account;
}

export async function getConnectedAccount(): Promise<string | null> {
  const eth = getEthereum();
  if (!eth) return null;
  try {
    const accounts: string[] = await eth.request({ method: "eth_accounts" });
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

export function onAccountsChanged(cb: (account: string | null) => void): () => void {
  const eth = getEthereum();
  if (!eth?.on) return () => {};
  const handler = (accounts: string[]) => cb(accounts?.[0] ?? null);
  eth.on("accountsChanged", handler);
  return () => eth.removeListener?.("accountsChanged", handler);
}

export function explorerTx(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export type SwapToken = { address: string | null; symbol: string; decimals?: number };

/**
 * ทำ swap จริง:
 * - DAN(native) → token: swapExactETHForTokens
 * - token → DAN(native): swapExactTokensForETH (+approve)
 * - token → token: swapExactTokensForTokens ผ่าน WDAN (+approve)
 * คืน tx hash
 */
function makeSigner(privateKey: string): Wallet {
  const provider = new JsonRpcProvider(RPC, CHAIN_ID);
  return new Wallet(privateKey, provider);
}

/** กัน promise ค้างถาวร — ถ้าเกินเวลาให้ throw ข้อความที่อ่านเข้าใจ */
function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

export type FeeOverrides = { gasPrice: bigint; gasLimit: bigint; type: number };

/**
 * ค่าแก๊ส "ตามจริงบนเชน" เพื่อให้ธุรกรรมถูกขุด ไม่ค้าง pending:
 * - Danny Chain baseFee ≈ 0 และ node แนะ gasPrice ตรงๆ → ส่งเป็น legacy (type-0) เสถียรกว่า type-2
 * - gasPrice = eth_gasPrice ปัจจุบัน +20% (กันต่ำกว่าขั้นต่ำของ miner)
 * - gasLimit = estimateGas +20% (กัน out-of-gas) มี fallback ถ้าประเมินไม่ได้
 */
async function feeOverrides(
  provider: Provider,
  estimateGas?: () => Promise<bigint>,
  fallbackGas = 300000n
): Promise<FeeOverrides> {
  const feeData = await provider.getFeeData();
  let gasPrice = feeData.gasPrice ?? 0n;
  if (gasPrice <= 0n) gasPrice = parseUnits("1", "gwei"); // กันค่าเป็น 0
  gasPrice = (gasPrice * 12n) / 10n; // +20%
  let gasLimit = fallbackGas;
  if (estimateGas) {
    try {
      gasLimit = ((await estimateGas()) * 12n) / 10n; // +20%
    } catch {
      /* ประเมินไม่ได้ → ใช้ fallback */
    }
  }
  return { gasPrice, gasLimit, type: 0 };
}

export type SwapPhase = "prepare" | "unstick" | "approve" | "swap";

/**
 * ปลดล็อกธุรกรรมค้าง (nonce gap): ในอดีตเคยส่ง tx แก๊สเกือบ 0 (type-2 ที่ tip ≈ 0) ค้างถาวร
 * → บล็อก tx ใหม่ทั้งหมดที่ nonce สูงกว่า. แก้โดย "แทนที่" ทุก nonce ที่ค้างด้วยการโอนเข้าตัวเอง
 * 0 DAN แก๊สสูง (legacy) เพื่อให้ถูกขุด เคลียร์คิว. คืนจำนวน tx ที่ส่งแทนที่.
 */
export async function clearStuckTransactions(opts: {
  privateKey: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<number> {
  const signer = makeSigner(opts.privateKey);
  const provider = signer.provider!;
  const account = signer.address;
  const confirmed = await provider.getTransactionCount(account, "latest");
  const pending = await provider.getTransactionCount(account, "pending");
  const total = pending - confirmed;
  if (total <= 0) return 0;

  // ต้องสูงกว่าธุรกรรมค้างเดิม (มีถึง ~5850 gwei) อย่างน้อย +10% → ใช้ 2 เท่าและไม่ต่ำกว่า 9000 gwei
  const cur = (await provider.getFeeData()).gasPrice ?? parseUnits("4500", "gwei");
  let gasPrice = cur * 2n;
  const floor = parseUnits("9000", "gwei");
  if (gasPrice < floor) gasPrice = floor;

  const sent: { wait: (n?: number) => Promise<unknown> }[] = [];
  for (let nonce = confirmed; nonce < pending; nonce++) {
    const tx = await signer.sendTransaction({
      to: account,
      value: 0n,
      nonce,
      gasPrice,
      gasLimit: 21000n,
      type: 0,
    });
    sent.push(tx);
    opts.onProgress?.(sent.length, total);
  }
  // รอ tx สุดท้าย (nonce สูงสุด) ถูกขุด → คิวก่อนหน้าถูกขุดครบแล้ว
  if (sent.length) {
    await withTimeout(sent[sent.length - 1].wait(1), 90000, "เคลียร์ธุรกรรมค้างใช้เวลานานผิดปกติ — ลองอีกครั้ง");
  }
  return sent.length;
}

/** จำนวนธุรกรรมที่ค้างในคิว (nonce gap) ของบัญชี — 0 = ปกติ */
export async function getStuckCount(address: string): Promise<number> {
  const provider = new JsonRpcProvider(RPC, CHAIN_ID);
  const [confirmed, pending] = await Promise.all([
    provider.getTransactionCount(address, "latest"),
    provider.getTransactionCount(address, "pending"),
  ]);
  return Math.max(0, pending - confirmed);
}

/** ถ้ามี nonce gap (ธุรกรรมค้าง) ให้เคลียร์ก่อน แล้วค่อยส่ง tx ใหม่ */
async function unstickIfNeeded(
  signer: Wallet,
  privateKey: string,
  onPhase?: (p: SwapPhase) => void
): Promise<void> {
  const provider = signer.provider!;
  const account = signer.address;
  const [confirmed, pending] = await Promise.all([
    provider.getTransactionCount(account, "latest"),
    provider.getTransactionCount(account, "pending"),
  ]);
  if (pending > confirmed) {
    onPhase?.("unstick");
    await clearStuckTransactions({ privateKey });
  }
}

/** ผลของ swap: hash + สถานะจริงบนเชน (confirmed = ขุดแล้ว, pending = ส่งแล้วแต่ยังไม่ยืนยัน) */
export type SwapResult = { hash: string; status: "confirmed" | "pending" };

type RouterLike = { getAmountsOut(amountIn: bigint, path: string[]): Promise<bigint[]> };

/**
 * เลือกเส้นทางที่ดีที่สุด: ลองเส้นตรง + ผ่าน base (WDAN, USDT) + bridge 2 base
 * แล้วใช้เส้นที่ได้ output มากสุด (>0). คืน null ถ้าไม่มีเส้นไหนได้ output (สภาพคล่องไม่พอ).
 * แก้บั๊กเดิมที่บังคับผ่าน WDAN เสมอ — หลายโทเคน (SDC/GMX/DS ฯลฯ) สภาพคล่องอยู่ในคู่ USDT
 */
async function pickBestPath(
  router: RouterLike,
  amountIn: bigint,
  fromAddr: string,
  toAddr: string
): Promise<{ path: string[]; out: bigint } | null> {
  const candidates: string[][] = [
    [fromAddr, toAddr],
    [fromAddr, WDAN, toAddr],
    [fromAddr, USDT_BASE, toAddr],
    [fromAddr, WDAN, USDT_BASE, toAddr],
    [fromAddr, USDT_BASE, WDAN, toAddr],
  ];
  const seen = new Set<string>();
  let best: { path: string[]; out: bigint } | null = null;
  for (const raw of candidates) {
    // ตัด address ที่ติดกันซ้ำ (เช่น from เป็น base เอง)
    const path = raw.filter((a, i) => i === 0 || a.toLowerCase() !== raw[i - 1].toLowerCase());
    const lower = path.map((a) => a.toLowerCase());
    if (path.length < 2) continue;
    // ข้ามเส้นที่มี address ซ้ำแบบไม่ติดกัน (loop ไม่ถูกต้อง) และเส้นที่เคยลองแล้ว
    if (new Set(lower).size !== lower.length) continue;
    const key = lower.join(">");
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const amts = await router.getAmountsOut(amountIn, path);
      const out = amts[amts.length - 1];
      if (out > 0n && (!best || out > best.out)) best = { path, out };
    } catch {
      /* เส้นทางนี้ไม่มี pair / ใช้ไม่ได้ → ข้าม */
    }
  }
  return best;
}

export async function executeSwap(opts: {
  from: SwapToken;
  to: SwapToken;
  amount: string; // จำนวน input (หน่วยที่ผู้ใช้กรอก)
  slippagePct: number; // เช่น 0.5
  privateKey: string; // กุญแจของบัญชีที่ใช้งานอยู่
  onPhase?: (phase: SwapPhase) => void; // แจ้งสถานะให้ UI (อนุมัติ/สลับ)
  onHash?: (hash: string) => void; // แจ้ง tx hash ทันทีที่ส่ง (ก่อนยืนยัน) เพื่อโชว์สถานะ pending
}): Promise<SwapResult> {
  const signer = makeSigner(opts.privateKey);
  const provider = signer.provider!;
  const account = signer.address;
  opts.onPhase?.("prepare");

  const fromNative = opts.from.address == null;
  const toNative = opts.to.address == null;
  const fromAddr = fromNative ? WDAN : (opts.from.address as string);
  const toAddr = toNative ? WDAN : (opts.to.address as string);

  // ต้องมี DAN (native) ไว้จ่ายค่าแก๊สเสมอ — เช็กก่อนเพื่อไม่ให้ธุรกรรมค้าง
  const danBal: bigint = await withTimeout(
    provider.getBalance(account),
    20000,
    "เชื่อมต่อเครือข่าย Danny Chain ไม่สำเร็จ (timeout)"
  );
  if (danBal === 0n) {
    throw new Error("ยอด DAN ไม่พอจ่ายค่าแก๊ส — ต้องมี DAN เล็กน้อยในบัญชีไว้เป็นค่าธรรมเนียม");
  }

  // ปลดล็อกธุรกรรมค้างก่อน (ถ้ามี) ไม่งั้น swap ใหม่จะติดคิวหลัง tx แก๊สเกือบ 0 ที่ค้าง
  await unstickIfNeeded(signer, opts.privateKey, opts.onPhase);

  // decimals ของ input
  let inDec = fromNative ? 18 : opts.from.decimals ?? 0;
  if (!fromNative && !inDec) {
    const erc = new Contract(fromAddr, ERC20_ABI, provider);
    inDec = Number(await erc.decimals());
  }
  let amountIn = parseUnits(opts.amount, inDec);
  if (amountIn <= 0n) throw new Error("จำนวนไม่ถูกต้อง");

  // กัน amountIn เกินยอดจริงเล็กน้อย (กด Max แล้วปัดเศษ float เพี้ยนตอน 18 ทศนิยม) → cap ไว้ที่ balance จริง
  if (!fromNative) {
    const ercBal = new Contract(fromAddr, ERC20_ABI, provider);
    const bal: bigint = await ercBal.balanceOf(account);
    if (amountIn > bal) amountIn = bal;
    if (amountIn <= 0n) throw new Error("ยอดโทเคนไม่พอ");
  }

  const router = new Contract(ROUTER, ROUTER_ABI, signer);

  // เลือกเส้นทางที่ดีที่สุด (เส้นตรง vs ผ่าน WDAN) — กันไปเจอ pool ที่แห้งแล้วได้ 0
  const best = await pickBestPath(router as unknown as RouterLike, amountIn, fromAddr, toAddr);
  if (!best) {
    throw new Error("สภาพคล่องของคู่นี้ไม่พอ — จะได้รับ 0 (ลองจำนวนอื่น หรือคู่อื่น)");
  }
  const cleanPath = best.path;
  const expectedOut = best.out;
  // amountOutMin จาก getAmountsOut × (1 - slippage)
  const bps = BigInt(Math.round((100 - opts.slippagePct) * 100)); // เช่น 99.5% → 9950
  const amountOutMin = (expectedOut * bps) / 10000n;

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 นาที

  // approve เท่าที่ใช้จริง (ไม่ใช่ unlimited) เพื่อจำกัดความเสี่ยงจากสัญญา
  if (!fromNative) {
    const erc = new Contract(fromAddr, ERC20_ABI, signer);
    const allowance: bigint = await erc.allowance(account, ROUTER);
    if (allowance < amountIn) {
      opts.onPhase?.("approve");
      const apFee = await feeOverrides(provider, () => erc.approve.estimateGas(ROUTER, amountIn), 80000n);
      const apTx = await erc.approve(ROUTER, amountIn, apFee);
      await withTimeout(
        apTx.wait(),
        120000,
        "การอนุมัติโทเคน (approve) ใช้เวลานานผิดปกติ — ตรวจสอบบน Dannyscan แล้วลองสลับอีกครั้ง"
      );
    }
  }

  opts.onPhase?.("swap");
  // ค่าแก๊สจริงบนเชน (legacy type-0 + buffer) เพื่อให้ swap ถูกขุด ไม่ค้าง pending
  let tx;
  if (fromNative) {
    const fee = await feeOverrides(
      provider,
      () => router.swapExactETHForTokens.estimateGas(amountOutMin, cleanPath, account, deadline, { value: amountIn })
    );
    tx = await router.swapExactETHForTokens(amountOutMin, cleanPath, account, deadline, { value: amountIn, ...fee });
  } else if (toNative) {
    const fee = await feeOverrides(
      provider,
      () => router.swapExactTokensForETH.estimateGas(amountIn, amountOutMin, cleanPath, account, deadline)
    );
    tx = await router.swapExactTokensForETH(amountIn, amountOutMin, cleanPath, account, deadline, fee);
  } else {
    const fee = await feeOverrides(
      provider,
      () => router.swapExactTokensForTokens.estimateGas(amountIn, amountOutMin, cleanPath, account, deadline)
    );
    tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, cleanPath, account, deadline, fee);
  }
  // แจ้ง hash ทันที (สถานะ pending) แล้ว "รอให้ขุดจริง" ก่อนค่อยประกาศสำเร็จ
  return waitOrPending(tx, opts.onHash);
}

/**
 * แจ้ง hash ทันทีผ่าน onHash แล้วรอให้ tx ถูกขุดจริง:
 * - ขุดแล้ว status 1 → { confirmed }
 * - reverted (status 0 / ethers throw) → throw (ล้มเหลวจริง)
 * - ยังไม่ยืนยันใน 90 วิ → { pending } (ส่งสำเร็จแต่ยังรอ — ไม่ใช่ error)
 */
async function waitOrPending(
  tx: { hash: string; wait: (n?: number) => Promise<unknown> },
  onHash?: (hash: string) => void
): Promise<SwapResult> {
  const hash = tx.hash;
  onHash?.(hash);
  try {
    const receipt = await withTimeout(tx.wait(1), 90000, "__pending__");
    if (receipt && (receipt as { status?: number }).status === 0) {
      throw new Error("ธุรกรรมถูกปฏิเสธบนเชน (reverted)");
    }
    return { hash, status: "confirmed" };
  } catch (e: any) {
    if (e?.message === "__pending__") return { hash, status: "pending" };
    throw e;
  }
}

/**
 * ส่งจริง:
 * - DAN(native): sendTransaction { to, value }
 * - ERC20: token.transfer(to, amount)
 * คืน { hash, status } — รอ confirmation จริงก่อน (เหมือน swap)
 */
export async function executeSend(opts: {
  token: SwapToken; // address null = native DAN
  to: string;
  amount: string;
  privateKey: string; // กุญแจของบัญชีที่ใช้งานอยู่
  onPhase?: (phase: SwapPhase) => void; // แจ้งสถานะ (เช่น เคลียร์ธุรกรรมค้าง)
  onHash?: (hash: string) => void; // แจ้ง tx hash ทันทีที่ส่ง (ก่อนยืนยัน)
}): Promise<SwapResult> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(opts.to)) throw new Error("ที่อยู่ผู้รับไม่ถูกต้อง");

  const signer = makeSigner(opts.privateKey);

  // ปลดล็อกธุรกรรมค้างก่อน (ถ้ามี) ไม่งั้นการโอนใหม่จะติดคิวหลัง tx ที่ค้าง
  await unstickIfNeeded(signer, opts.privateKey, opts.onPhase);

  const native = opts.token.address == null;
  if (native) {
    const value = parseUnits(opts.amount, 18);
    if (value <= 0n) throw new Error("จำนวนไม่ถูกต้อง");
    const fee = await feeOverrides(signer.provider!, () => signer.estimateGas({ to: opts.to, value }), 21000n);
    const tx = await signer.sendTransaction({ to: opts.to, value, ...fee });
    return waitOrPending(tx, opts.onHash);
  }

  // ERC20
  let dec = opts.token.decimals ?? 0;
  const erc = new Contract(opts.token.address as string, ERC20_ABI, signer);
  if (!dec) dec = Number(await erc.decimals());
  let amount = parseUnits(opts.amount, dec);
  if (amount <= 0n) throw new Error("จำนวนไม่ถูกต้อง");
  // กัน amount เกินยอดจริง (Max ปัดเศษ float) → cap ไว้ที่ balance จริง
  const sendBal: bigint = await erc.balanceOf(signer.address);
  if (amount > sendBal) amount = sendBal;
  if (amount <= 0n) throw new Error("ยอดโทเคนไม่พอ");
  const fee = await feeOverrides(signer.provider!, () => erc.transfer.estimateGas(opts.to, amount), 90000n);
  const tx = await erc.transfer(opts.to, amount, fee);
  return waitOrPending(tx, opts.onHash);
}

/** ประเมินค่าแก๊สของการส่ง (ไม่ต้องเซ็น) — คืน {gas, feeDan} หรือ null ถ้าประเมินไม่ได้ */
export async function estimateSendFee(opts: {
  token: SwapToken;
  to: string;
  amount: string;
  from: string;
}): Promise<{ gas: bigint; gasPrice: bigint; feeDan: number } | null> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(opts.to)) return null;
  try {
    const provider = new JsonRpcProvider(RPC, CHAIN_ID);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? 0n;
    let gas: bigint;
    if (opts.token.address == null) {
      gas = await provider.estimateGas({ from: opts.from, to: opts.to, value: parseUnits(opts.amount, 18) });
    } else {
      const dec = opts.token.decimals ?? Number(await new Contract(opts.token.address, ERC20_ABI, provider).decimals());
      const erc = new Contract(opts.token.address, ERC20_ABI, provider);
      gas = await erc.transfer.estimateGas(opts.to, parseUnits(opts.amount, dec), { from: opts.from });
    }
    // ให้ตรงกับค่าจริงที่ส่ง (gasPrice +20%, gasLimit +20%)
    const fee = ((gas * 12n) / 10n) * ((gasPrice * 12n) / 10n);
    return { gas, gasPrice, feeDan: Number(fee) / 1e18 };
  } catch {
    return null;
  }
}

/** ประเมินค่าแก๊สของ swap (best-effort) — คืน feeDan หรือ null ถ้าประเมินไม่ได้ (เช่น ยังไม่ approve) */
export async function estimateSwapFee(opts: {
  fromToken: SwapToken;
  toToken: SwapToken;
  amount: string;
  account: string;
  slippagePct?: number;
}): Promise<number | null> {
  try {
    const provider = new JsonRpcProvider(RPC, CHAIN_ID);
    const fromNative = opts.fromToken.address == null;
    const toNative = opts.toToken.address == null;
    const fromAddr = fromNative ? WDAN : (opts.fromToken.address as string);
    const toAddr = toNative ? WDAN : (opts.toToken.address as string);

    let inDec = fromNative ? 18 : opts.fromToken.decimals ?? 0;
    if (!fromNative && !inDec) inDec = Number(await new Contract(fromAddr, ERC20_ABI, provider).decimals());
    const amountIn = parseUnits(opts.amount, inDec);
    if (amountIn <= 0n) return null;

    const router = new Contract(ROUTER, ROUTER_ABI, provider);
    // ใช้เส้นทางที่ดีที่สุดเหมือนตอน swap จริง (เส้นตรง vs ผ่าน WDAN)
    const best = await pickBestPath(router as unknown as RouterLike, amountIn, fromAddr, toAddr);
    if (!best) return null;
    const cleanPath = best.path;
    const expectedOut = best.out;
    const bps = BigInt(Math.round((100 - (opts.slippagePct ?? 0.5)) * 100));
    const amountOutMin = (expectedOut * bps) / 10000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    let gas: bigint;
    if (fromNative) {
      gas = await router.swapExactETHForTokens.estimateGas(amountOutMin, cleanPath, opts.account, deadline, { from: opts.account, value: amountIn });
    } else if (toNative) {
      gas = await router.swapExactTokensForETH.estimateGas(amountIn, amountOutMin, cleanPath, opts.account, deadline, { from: opts.account });
    } else {
      gas = await router.swapExactTokensForTokens.estimateGas(amountIn, amountOutMin, cleanPath, opts.account, deadline, { from: opts.account });
    }
    const gasPrice = (await provider.getFeeData()).gasPrice ?? 0n;
    // ให้ตรงกับค่าจริงที่ส่ง (gasPrice +20%, gasLimit +20%)
    return Number(((gas * 12n) / 10n) * ((gasPrice * 12n) / 10n)) / 1e18;
  } catch {
    return null; // ยังไม่ approve / ยอดไม่พอ → ประเมินไม่ได้
  }
}
