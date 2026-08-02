import type { ReactNode } from "react";

type Tone = "gray" | "blue" | "indigo" | "green" | "amber" | "red";

const TONE_CLASSES: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-600 ring-slate-500/10",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/10",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/10",
  red: "bg-red-50 text-red-700 ring-red-600/10",
};

export default function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
