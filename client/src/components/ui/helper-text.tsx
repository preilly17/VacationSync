"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface HelperTextProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

const HelperText = React.forwardRef<HTMLParagraphElement, HelperTextProps>(
  ({ className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
      />
    );
  },
);

HelperText.displayName = "HelperText";

export { HelperText };
