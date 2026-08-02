import type { ReactNode } from "react";
import { InboxIcon } from "../icons";

export default function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon ?? <InboxIcon className="h-6 w-6" />}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">{title}</p>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
    </div>
  );
}
