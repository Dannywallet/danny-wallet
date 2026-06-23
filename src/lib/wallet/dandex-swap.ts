"use client";

// เซ็นด้วยกุญแจในแอป (บัญชีที่ใช้งานอยู่) + ทำ swap/send จริงผ่าน RPC ของ Danny Chain 5069
import { Contract, JsonRpcProvider, Wallet, parseUnits } from "ethers";

export const CHAIN_ID = 5069;
export const CHAIN_ID_HEX = "0x" + (5069).toString(16);
export const ROUTER = "0x708E8574D232E57f6593734b4110EFEE2a079CdF"; // dandex router (UniswapV2)
export const WDAN = "0xBEe33b6B1C3df2c4468510E87d6330daA5709F3E"; // Wrapped DAN (= WETH ของ router)
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

export type SwapPhase = "prepare" | "approve" | "swap";

export async function executeSwap(opts: {
  from: SwapToken;
  to: SwapToken;
  amount: string; // จำนวน input (หน่วยที่ผู้ใช้กรอก)
  slippagePct: number; // เช่น 0.5
  privateKey: string; // กุญแจของบัญชีที่ใช้งานอยู่
  onPhase?: (phase: SwapPhase) => void; // แจ้งสถานะให้ UI (อนุมัติ/สลับ)
}): Promise<string> {
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

  // decimals ของ input
  let inDec = fromNative ? 18 : opts.from.decimals ?? 0;
  if (!fromNative && !inDec) {
    const erc = new Contract(fromAddr, ERC20_ABI, provider);
    inDec = Number(await erc.decimals());
  }
  const amountIn = parseUnits(opts.amount, inDec);
  if (amountIn <= 0n) throw new Error("จำนวนไม่ถูกต้อง");

  // เส้นทาง (route ผ่าน WDAN เมื่อทั้งคู่เป็น ERC20)
  const path =
    fromNative || toNative ? [fromAddr, toAddr] : [fromAddr, WDAN, toAddr];
  // ตัด WDAN ซ้ำถ้า from/to เป็น WDAN เอง
  const cleanPath = path.filter((a, i) => i === 0 || a.toLowerCase() !== path[i - 1].toLowerCase());

  const router = new Contract(ROUTER, ROUTER_ABI, signer);

  // amountOutMin จาก getAmountsOut × (1 - slippage)
  let amounts: bigint[];
  try {
    amounts = await router.getAmountsOut(amountIn, cleanPath);
  } catch {
    throw new Error("ไม่พบเส้นทางสภาพคล่องของคู่นี้บน DEX (ยังเทรดไม่ได้)");
  }
  const expectedOut = amounts[amounts.length - 1];
  const bps = BigInt(Math.round((100 - opts.slippagePct) * 100)); // เช่น 99.5% → 9950
  const amountOutMin = (expectedOut * bps) / 10000n;

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 นาที

  // approve เท่าที่ใช้จริง (ไม่ใช่ unlimited) เพื่อจำกัดความเสี่ยงจากสัญญา
  if (!fromNative) {
    const erc = new Contract(fromAddr, ERC20_ABI, signer);
    const allowance: bigint = await erc.allowance(account, ROUTER);
    if (allowance < amountIn) {
      opts.onPhase?.("approve");
      const apTx = await erc.approve(ROUTER, amountIn);
      await withTimeout(
        apTx.wait(),
        120000,
        "การอนุมัติโทเคน (approve) ใช้เวลานานผิดปกติ — ตรวจสอบบน Dannyscan แล้วลองสลับอีกครั้ง"
      );
    }
  }

  opts.onPhase?.("swap");
  let tx;
  if (fromNative) {
    tx = await router.swapExactETHForTokens(amountOutMin, cleanPath, account, deadline, { value: amountIn });
  } else if (toNative) {
    tx = await router.swapExactTokensForETH(amountIn, amountOutMin, cleanPath, account, deadline);
  } else {
    tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, cleanPath, account, deadline);
  }
  return tx.hash as string;
}

/**
 * ส่งจริง:
 * - DAN(native): sendTransaction { to, value }
 * - ERC20: token.transfer(to, amount)
 * คืน tx hash
 */
export async function executeSend(opts: {
  token: SwapToken; // address null = native DAN
  to: string;
  amount: string;
  privateKey: string; // กุญแจของบัญชีที่ใช้งานอยู่
}): Promise<string> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(opts.to)) throw new Error("ที่อยู่ผู้รับไม่ถูกต้อง");

  const signer = makeSigner(opts.privateKey);

  const native = opts.token.address == null;
  if (native) {
    const value = parseUnits(opts.amount, 18);
    if (value <= 0n) throw new Error("จำนวนไม่ถูกต้อง");
    const tx = await signer.sendTransaction({ to: opts.to, value });
    return tx.hash as string;
  }

  // ERC20
  let dec = opts.token.decimals ?? 0;
  const erc = new Contract(opts.token.address as string, ERC20_ABI, signer);
  if (!dec) dec = Number(await erc.decimals());
  const amount = parseUnits(opts.amount, dec);
  if (amount <= 0n) throw new Error("จำนวนไม่ถูกต้อง");
  const tx = await erc.transfer(opts.to, amount);
  return tx.hash as string;
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
    const fee = gas * gasPrice;
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

    const path = fromNative || toNative ? [fromAddr, toAddr] : [fromAddr, WDAN, toAddr];
    const cleanPath = path.filter((a, i) => i === 0 || a.toLowerCase() !== path[i - 1].toLowerCase());

    const router = new Contract(ROUTER, ROUTER_ABI, provider);
    const amounts: bigint[] = await router.getAmountsOut(amountIn, cleanPath);
    const expectedOut = amounts[amounts.length - 1];
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
    return Number(gas * gasPrice) / 1e18;
  } catch {
    return null; // ยังไม่ approve / ยอดไม่พอ → ประเมินไม่ได้
  }
}
