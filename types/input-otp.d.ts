declare module "input-otp" {
  import * as React from "react";

  export interface OTPInputProps
    extends React.ComponentPropsWithoutRef<"div"> {
    value?: string;
    onChange?: (value: string) => void;
    maxLength?: number;
    containerClassName?: string;
    className?: string;
  }

  export interface OTPSlot {
    char?: string | null;
    hasFakeCaret?: boolean;
    isActive?: boolean;
  }

  export const OTPInput: React.ForwardRefExoticComponent<
    OTPInputProps & React.RefAttributes<HTMLDivElement>
  >;

  export const OTPInputContext: React.Context<{
    slots: OTPSlot[];
  }>;
}
