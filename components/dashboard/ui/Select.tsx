import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDownIcon } from "../icons";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", wrapperClassName = "inline-block", children, ...props }, ref) => (
    <div className={`relative ${wrapperClassName}`}>
      <select
        ref={ref}
        className={`w-full appearance-none rounded-lg border-0 bg-white py-2 pl-3 pr-9 text-sm text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition-colors hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
    </div>
  )
);
Select.displayName = "Select";

export default Select;
