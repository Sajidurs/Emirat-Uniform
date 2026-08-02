import { forwardRef, type InputHTMLAttributes } from "react";

const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={`h-4 w-4 cursor-pointer rounded border-slate-300 accent-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-0 ${className}`}
      {...props}
    />
  )
);
Checkbox.displayName = "Checkbox";

export default Checkbox;
