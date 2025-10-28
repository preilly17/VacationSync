import { forwardRef, type KeyboardEvent, type ReactNode, useMemo } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type StatCardProps = {
  icon: ReactNode;
  value: string | number;
  label: string;
  description?: string;
  ariaLabel: string;
  controlsId: string;
  labelId: string;
  onRetry?: () => void;
  isLoading?: boolean;
  isError?: boolean;
  isSelected: boolean;
  onToggle: () => void;
  testId: string;
};

export const StatCard = forwardRef<HTMLButtonElement, StatCardProps>(
  (
    {
      icon,
      value,
      label,
      description,
      ariaLabel,
      controlsId,
      labelId,
      onRetry,
      isLoading = false,
      isError = false,
      isSelected,
      onToggle,
      testId,
    },
    ref,
  ) => {
    const formattedValue = useMemo(() => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value.toLocaleString();
      }
      return value;
    }, [value]);

    const isInteractive = !isLoading && !isError;

    return (
      <div
        data-testid={testId}
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-2xl dashboard-themed-card transition duration-200",
          isInteractive
            ? "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#6366f1]"
            : "opacity-90",
          isSelected
            ? "translate-y-0 shadow-[0_32px_70px_-35px_rgba(79,70,229,0.52)] ring-2 ring-[#6366f1]/35"
            : "hover:-translate-y-0.5 hover:shadow-[0_35px_80px_-40px_rgba(79,70,229,0.42)]",
        )}
      >
        <button
          ref={ref}
          type="button"
          aria-label={ariaLabel}
          aria-expanded={isSelected}
          aria-controls={controlsId}
          disabled={!isInteractive}
          className={cn(
            "relative z-[1] flex w-full flex-col gap-6 rounded-2xl bg-transparent p-6 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6366f1]",
            isInteractive ? "cursor-pointer" : "cursor-default",
          )}
          onClick={() => {
            if (!isInteractive) {
              return;
            }
            onToggle();
          }}
          onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
            if (!isInteractive) {
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggle();
            }
            if (event.key === "Escape" && isSelected) {
              event.preventDefault();
              onToggle();
            }
          }}
        >
          <CardContents
            icon={icon}
            value={formattedValue}
            label={label}
            labelId={labelId}
            description={description}
            isLoading={isLoading}
            isError={isError}
            onRetry={onRetry}
            isSelected={isSelected}
          />
        </button>
      </div>
    );
  },
);

type CardContentsProps = {
  icon: ReactNode;
  value: string | number;
  label: string;
  labelId: string;
  description?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  isSelected: boolean;
};

function CardContents({
  icon,
  value,
  label,
  labelId,
  description,
  isLoading,
  isError,
  onRetry,
  isSelected,
}: CardContentsProps) {
  if (isLoading) {
    return (
      <div className="flex h-full flex-col justify-between gap-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-10 rounded-2xl" />
          <Skeleton className="h-3 w-12 rounded-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-3 w-28 rounded-full" />
          <Skeleton className="h-3 w-20 rounded-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-rose-600">Couldn't load right now</p>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onRetry?.();
            }}
            aria-label="Retry loading stats"
            className="rounded-full border border-rose-200 bg-white/90 p-2 text-rose-600 transition hover:bg-rose-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="text-xs text-rose-500">Please try again in a moment.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#38bdf8]/20 via-[#6366f1]/12 to-[#a855f7]/20 text-[#2563eb]">
          {icon}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-slate-400 transition-transform duration-200",
            isSelected ? "rotate-180" : "rotate-0",
          )}
          aria-hidden="true"
        />
      </div>
      <div className="space-y-1.5">
        <div className="text-[30px] font-semibold leading-none text-slate-900">{value}</div>
        <p id={labelId} className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          {label}
        </p>
        {description ? (
          <p className="text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

StatCard.displayName = "StatCard";
