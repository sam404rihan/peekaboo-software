import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
}

export function Avatar({ src, alt, fallback, className, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-surface-container border-2 border-white shadow-sm items-center justify-center text-xs font-semibold text-on-surface-variant",
        className
      )}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span>{fallback || alt?.[0] || '?'}</span>
      )}
    </div>
  );
}
