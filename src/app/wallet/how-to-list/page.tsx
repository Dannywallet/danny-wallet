"use client";

import React from "react";
import { Screen } from "@/components/wallet/PhoneShell";
import { TopBar } from "@/components/wallet/TopBar";
import { BottomNav } from "@/components/wallet/BottomNav";
import { Check, Warn, ChevronRight } from "@/components/wallet/Icons";
import { useI18n } from "@/lib/wallet/i18n";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="dw-glass relative rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <span className="dw-btn-primary grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold">{n}</span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="mt-2 pl-10 text-sm leading-relaxed text-[var(--dw-muted)]">{children}</div>
    </div>
  );
}

export default function HowToListPage() {
  const { t } = useI18n();
  return (
    <>
      <TopBar title={t("howto.title")} />
      <Screen className="space-y-3 pb-8">
        <p className="px-1 pt-1 text-sm text-[var(--dw-muted)]">
          {t("howto.intro")}
        </p>

        <Step n={1} title={t("howto.step1Title")}>
          {t("howto.step1Body")}
        </Step>

        <Step n={2} title={t("howto.step2Title")}>
          {t("howto.step2Body")}
        </Step>

        <Step n={3} title={t("howto.step3Title")}>
          {t("howto.step3Body1")}{" "}
          <a href="https://dancharts.com/list/" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--dw-cyan)]">{t("howto.step3Link")}</a>{" "}
          {t("howto.step3Body2")}
        </Step>

        <div className="dw-glass rounded-2xl p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--dw-rose)]">
            <Warn size={15} /> {t("howto.notShownTitle")}
          </h3>
          <ul className="space-y-1.5 text-sm text-[var(--dw-muted)]">
            <li>{t("howto.notShown1")}</li>
            <li>{t("howto.notShown2")}</li>
            <li>{t("howto.notShown3")}</li>
          </ul>
        </div>

        <div className="dw-glass rounded-2xl p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--dw-green)]">
            <Check size={15} /> {t("howto.approveTitle")}
          </h3>
          <ul className="space-y-1.5 text-sm text-[var(--dw-muted)]">
            <li>{t("howto.approve1")}</li>
            <li>{t("howto.approve2")}</li>
            <li>{t("howto.approve3")}</li>
            <li>{t("howto.approve4")}</li>
          </ul>
        </div>

        <a
          href="https://dancharts.com/list/"
          target="_blank"
          rel="noopener noreferrer"
          className="dw-btn-primary mt-1 flex w-full items-center justify-center gap-1.5 rounded-2xl py-4 font-semibold"
        >
          {t("howto.submitBtn")} <ChevronRight size={16} />
        </a>
      </Screen>
      <BottomNav />
    </>
  );
}
