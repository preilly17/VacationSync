import * as React from "react";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const ProfileSectionCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <Card ref={ref} className={cn("w-full", className)} {...props} />
));
ProfileSectionCard.displayName = "ProfileSectionCard";

export const ProfileSectionHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <CardHeader
    ref={ref}
    className={cn("space-y-3 px-6 pt-6 pb-4", className)}
    {...props}
  />
));
ProfileSectionHeader.displayName = "ProfileSectionHeader";

export const ProfileSectionContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <CardContent ref={ref} className={cn("px-6 pb-6 pt-0", className)} {...props} />
));
ProfileSectionContent.displayName = "ProfileSectionContent";

export const ProfileSectionFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <CardFooter
    ref={ref}
    className={cn("justify-end px-6 pb-6 pt-4", className)}
    {...props}
  />
));
ProfileSectionFooter.displayName = "ProfileSectionFooter";
