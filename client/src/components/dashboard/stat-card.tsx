import { type KeyboardEvent, type MouseEvent, type ReactNode, useMemo } from "react";
import { useLocation } from "wouter";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type StatCardProps = {
  icon: ReactNode;
  value: string | number;
  label: string;
  description?: string;
  ariaLabel: string;
  href?: string;
  onClick?: () => void;
  onRetry?: () => void;
  isLoading?: boolean;
  isError?: boolean;
  testId: string;
};

export function StatCard({
  icon,
  value,
  label,
  description,
  ariaLabel,
  href,
  onClick,
  onRetry,
  isLoading = false,
  isError = false,
  testId,
}: StatCardProps) {
  const [, setLocation] = useLocation();

  const formattedValue = useMemo(() => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value.toLocaleString();
    }
    return value;
  }, [value]);

  const isInteractive = !isLoading && !isError && (!!href || typeof onClick === "function");

  const handleNavigate = () => {
    if (href) {
      setLocation(href);
    }
  };

  const handleActivate = (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    if (!isInteractive) {
      event.preventDefault();
      return;
    }

    if (href) {
      event.preventDefault();
      handleNavigate();
    }

    onClick?.();
  };

  const sharedProps = {
    "data-testid": testId,
    "aria-label": ariaLabel,
    className: cn(
      "card card--accent group relative flex h-full flex-col justify-between overflow-hidden p-6 text-left",
      isInteractive
        ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c5cff]"
        : "cursor-default",
    ),
    onClick: handleActivate,
    onKeyDown: (event: KeyboardEvent<HTMLAnchorElement | HTMLButtonElement>) => {
      if (!isInteractive) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleNavigate();
        onClick?.();
      }
    },
    "aria-disabled": isInteractive ? undefined : true,
  } as const;

  if (href) {
    return (
      <a href={href} role="link" {...sharedProps}>
        <CardContents
          icon={icon}
          value={formattedValue}
          label={label}
          description={description}
          href={href}
          isLoading={isLoading}
          isError={isError}
          onRetry={onRetry}
          onNavigate={handleNavigate}
        />
      </a>
    );
  }

  return (
    <button type="button" disabled={!isInteractive} {...sharedProps}>
      <CardContents
        icon={icon}
        value={formattedValue}
        label={label}
        description={description}
        href={href}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        onNavigate={handleNavigate}
      />
    </button>
  );
}

type CardContentsProps = {
  icon: ReactNode;
  value: string | number;
  label: string;
  description?: string;
  href?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  onNavigate?: () => void;
};

function CardContents({
  icon,
  value,
  label,
  description,
  href,
  isLoading,
  isError,
  onRetry,
  onNavigate,
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
        <div className="icon-pill">
          {icon}
        </div>
        {href ? (
          <a
            href={href}
            aria-hidden="true"
            tabIndex={-1}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onNavigate?.();
            }}
            className="stat-label opacity-70 transition hover:opacity-100"
          >
            View
          </a>
        ) : (
          <span className="stat-label opacity-70">View</span>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="stat-number leading-none">{value}</div>
        <p className="stat-label">{label}</p>
        {description ? (
          <p className="body text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
