import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.memo(React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-2 text-sm text-on-surface ring-offset-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-all duration-200",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
));

Input.displayName = "Input";

export { Input };
