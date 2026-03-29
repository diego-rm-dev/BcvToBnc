"use client";

import Link from "next/link";
import { NoticeTone } from "@/lib/ui/recovery-messages";

type RecoveryAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type RecoveryNoticeProps = {
  tone: NoticeTone;
  title: string;
  message: string;
  actions?: RecoveryAction[];
};

function toneClasses(tone: NoticeTone): string {
  if (tone === "error") return "border-red-200 bg-red-50 text-red-800";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-100 text-slate-800";
}

function actionClasses(tone: NoticeTone): string {
  if (tone === "error") return "border-red-300 text-red-800 hover:bg-red-100";
  if (tone === "warning") return "border-amber-300 text-amber-900 hover:bg-amber-100";
  return "border-slate-300 text-slate-800 hover:bg-slate-200";
}

export function RecoveryNotice({ tone, title, message, actions }: RecoveryNoticeProps) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClasses(tone)}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm">{message}</p>

      {actions && actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) =>
            action.href ? (
              <Link
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${actionClasses(tone)}`}
                href={action.href}
                key={`${action.label}-${action.href}`}
              >
                {action.label}
              </Link>
            ) : (
              <button
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${actionClasses(tone)}`}
                key={action.label}
                onClick={action.onClick}
                type="button"
              >
                {action.label}
              </button>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
