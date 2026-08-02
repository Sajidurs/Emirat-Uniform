import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 disabled:bg-indigo-300",
  secondary:
    "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 shadow-sm hover:bg-slate-50 hover:ring-slate-300 disabled:text-slate-400",
  ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-300",
  danger: "bg-white text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50 disabled:text-red-300",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5",
  md: "px-3.5 py-2 text-sm gap-2",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  )
);
Button.displayName = "Button";

export default Button;
