"use client";

import React from "react";
import Link from "next/link";
import type { Token } from "@/lib/wallet/mock-data";
import { formatUsd, formatToken, formatChange } from "@/lib/wallet/format";
import { TokenIcon } from "./TokenIcon";
import { Sparkline } from "./Sparkline";
import { useI18n } from "@/lib/wallet/i18n";

export function TokenRow({ token, hidden }: { token: Token; hidden: boolean }) {
  const { t } = useI18n();
  const up = token.change24h >= 0;
  const value = token.balance * token.priceUsd;
  return (
    <Link
      href={`/wallet/asset/${token.symbol}`}
      className="dw-glass flex items-center gap-3 rounded-2xl px-3.5 py-3 transition hover:bg-white/[0.07] active:scale-[0.99]"
    >
      <TokenIcon symbol={token.symbol} gradient={token.gradient} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{token.symbol}</p>
          {token.isNative && (
            <span className="rounded-full bg-[var(--dw-violet)]/20 px-1.5 py-0.5 text-[9px] text-[var(--dw-purple)]">
              {t("common.native")}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--dw-muted)]">{formatUsd(token.priceUsd)}</p>
      </div>

      <div className="hidden min-[360px]:block">
        <Sparkline data={token.spark} up={up} width={56} height={28} />
      </div>

      <div className="text-right">
        <p className="font-semibold tabular-nums">
          {hidden ? "••••" : formatUsd(value)}
        </p>
        <p className="text-xs tabular-nums text-[var(--dw-muted)]">
          {hidden ? "••• " + token.symbol : formatToken(token.balance, token.symbol)}
        </p>
      </div>

      <span
        className={`ml-1 w-12 text-right text-xs font-medium ${
          up ? "text-[var(--dw-green)]" : "text-[var(--dw-rose)]"
        }`}
      >
        {formatChange(token.change24h)}
      </span>
    </Link>
  );
}
