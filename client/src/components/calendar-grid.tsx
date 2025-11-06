import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  addDays,
  eachDayOfInterval,
  isSameDay,
  isWithinInterval,
  isSameMonth,
} from "date-fns";
import type { ActivityWithDetails, TripWithDetails } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

type CalendarCssVariables = CSSProperties & Record<string, string | number | undefined>;

interface CalendarGridProps {
  currentMonth: Date;
  activities: ActivityWithDetails[];
  trip: TripWithDetails;
  selectedDate?: Date | null;
  onDayClick?: (date: Date) => void;
  onActivityClick?: (activity: ActivityWithDetails) => void;
  onDayOverflowClick?: (
    day: Date,
    activities: ActivityWithDetails[],
    hiddenCount: number,
    trigger: HTMLButtonElement | null,
  ) => void;
  currentUserId?: string;
  highlightPersonalProposals?: boolean;
  viewMode?: "month" | "week";
  weekStartsOn?: Date;
  selectedActivityId?: number | null;
}

const categoryIcons = {
  // Travel essentials
  flights: "✈️",
  hotels: "🏨", 
  transport: "🚊",
  
  // Food & dining
  food: "🍜",
  restaurants: "🍴",
  
  // Activities
  activities: "🎯",
  sightseeing: "🏯",
  entertainment: "🎤",
  outdoor: "🏔️",
  culture: "🎭",
  shopping: "🛍️",
  
  // Default
  other: "📍",
};

type EventThemeKey = "flights" | "stays" | "dining" | "adventure" | "personal" | "default";

type DisplayMode = "normal" | "compact" | "micro";

interface LayoutState {
  mode: DisplayMode;
  visibleCount: number;
  hiddenCount: number;
}

const MODE_CONFIG: Record<DisplayMode, { gap: number }> = {
  normal: { gap: 6 },
  compact: { gap: 4 },
  micro: { gap: 2 },
};

const MODE_ORDER: DisplayMode[] = ["normal", "compact", "micro"];

const getEventThemeKey = (category: string | null | undefined, isPersonal: boolean): EventThemeKey => {
  if (isPersonal) return "personal";

  const normalized = (category ?? "").toLowerCase();

  if (["flight", "flights", "air", "airfare"].some(token => normalized.includes(token))) {
    return "flights";
  }

  if (["hotel", "stay", "lodging", "resort"].some(token => normalized.includes(token))) {
    return "stays";
  }

  if (["restaurant", "food", "dining", "meal"].some(token => normalized.includes(token))) {
    return "dining";
  }

  if (
    [
      "activities",
      "activity",
      "tour",
      "sightseeing",
      "entertainment",
      "outdoor",
      "adventure",
      "culture",
      "shopping",
    ].some(token => normalized.includes(token))
  ) {
    return "adventure";
  }

  return "default";
};

const themeVariableMap: Record<EventThemeKey, CalendarCssVariables> = {
  flights: {
    "--chip-bg": "var(--chip-flights-bg)",
    "--chip-border": "var(--chip-flights-border)",
    "--chip-dot": "var(--chip-flights-dot)",
    "--chip-text": "var(--chip-flights-text)",
    "--chip-ring": "var(--chip-flights-ring)",
    "--chip-glow": "var(--chip-flights-glow)",
  },
  stays: {
    "--chip-bg": "var(--chip-stays-bg)",
    "--chip-border": "var(--chip-stays-border)",
    "--chip-dot": "var(--chip-stays-dot)",
    "--chip-text": "var(--chip-stays-text)",
    "--chip-ring": "var(--chip-stays-ring)",
    "--chip-glow": "var(--chip-stays-glow)",
  },
  dining: {
    "--chip-bg": "var(--chip-dining-bg)",
    "--chip-border": "var(--chip-dining-border)",
    "--chip-dot": "var(--chip-dining-dot)",
    "--chip-text": "var(--chip-dining-text)",
    "--chip-ring": "var(--chip-dining-ring)",
    "--chip-glow": "var(--chip-dining-glow)",
  },
  adventure: {
    "--chip-bg": "var(--chip-adventure-bg)",
    "--chip-border": "var(--chip-adventure-border)",
    "--chip-dot": "var(--chip-adventure-dot)",
    "--chip-text": "var(--chip-adventure-text)",
    "--chip-ring": "var(--chip-adventure-ring)",
    "--chip-glow": "var(--chip-adventure-glow)",
  },
  personal: {
    "--chip-bg": "var(--chip-personal-bg)",
    "--chip-border": "var(--chip-personal-border)",
    "--chip-dot": "var(--chip-personal-dot)",
    "--chip-text": "var(--chip-personal-text)",
    "--chip-ring": "var(--chip-personal-ring)",
    "--chip-glow": "var(--chip-personal-glow)",
  },
  default: {
    "--chip-bg": "var(--chip-default-bg)",
    "--chip-border": "var(--chip-default-border)",
    "--chip-dot": "var(--chip-default-dot)",
    "--chip-text": "var(--chip-default-text)",
    "--chip-ring": "var(--chip-default-ring)",
    "--chip-glow": "var(--chip-default-glow)",
  },
};

type ActivityWithOptionalTimeOptions = ActivityWithDetails & {
  startTime?: string | Date | null;
  endTime?: string | Date | null;
  timeOptions?: (string | Date | null | undefined)[] | null;
};

const parseDateValue = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const getActivityTimeOptions = (activity: ActivityWithOptionalTimeOptions): Date[] => {
  const rawOptions = activity.timeOptions;
  if (!Array.isArray(rawOptions)) {
    return [];
  }

  const seen = new Set<number>();

  return rawOptions
    .map(option => parseDateValue(option))
    .filter((option): option is Date => Boolean(option))
    .filter(option => {
      const timestamp = option.getTime();
      if (seen.has(timestamp)) {
        return false;
      }
      seen.add(timestamp);
      return true;
    });
};

const getActivityPrimaryDate = (activity: ActivityWithOptionalTimeOptions): Date | null => {
  const rawStartTime = activity.startTime ?? (activity as ActivityWithDetails).startTime;
  const startDate = parseDateValue(rawStartTime);
  if (startDate) {
    return startDate;
  }

  const [firstOption] = getActivityTimeOptions(activity);
  return firstOption ?? null;
};

const getActivityDateCandidates = (activity: ActivityWithOptionalTimeOptions): Date[] => {
  const primary = getActivityPrimaryDate(activity);
  const candidates: Date[] = [];

  if (primary) {
    candidates.push(primary);
  }

  for (const option of getActivityTimeOptions(activity)) {
    if (!primary || option.getTime() !== primary.getTime()) {
      candidates.push(option);
    }
  }

  return candidates;
};

const formatBadgeTime = (dateInput: string | Date | null | undefined) => {
  const parsed = parseDateValue(dateInput);
  if (!parsed) {
    return "Time TBD";
  }

  return format(parsed, "h:mmaaa").toLowerCase().replace("m", "");
};

const formatActivityAriaLabel = (activity: ActivityWithDetails, day: Date) => {
  const activityWithOptions = activity as ActivityWithOptionalTimeOptions;
  const scheduledStart = parseDateValue(activityWithOptions.startTime ?? activity.startTime ?? null);
  const dateLabel = format(day, "MMM d");

  if (!scheduledStart) {
    return `${activity.name} time to be determined on ${dateLabel}`;
  }

  const timeLabel = format(scheduledStart, "h:mm a");
  return `${activity.name} at ${timeLabel} on ${dateLabel}`;
};

export function CalendarGrid({
  currentMonth,
  activities,
  trip,
  selectedDate,
  onDayClick,
  onActivityClick,
  onDayOverflowClick,
  currentUserId,
  highlightPersonalProposals,
  viewMode = "month",
  weekStartsOn,
  selectedActivityId,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const effectiveWeekStart = viewMode === "week"
    ? startOfDay(weekStartsOn ?? startOfWeek(currentMonth))
    : null;
  const effectiveWeekEnd = viewMode === "week" && effectiveWeekStart
    ? endOfDay(addDays(effectiveWeekStart, 6))
    : null;

  const days = viewMode === "week" && effectiveWeekStart && effectiveWeekEnd
    ? eachDayOfInterval({ start: effectiveWeekStart, end: effectiveWeekEnd })
    : eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getActivitiesForDay = (day: Date) => {
    return activities
      .filter(activity => {
        const activityType = (activity.type ?? "").toString().toUpperCase();
        if (activityType !== "SCHEDULED") {
          return false;
        }

        const candidates = getActivityDateCandidates(activity);
        if (candidates.some(candidate => isSameDay(candidate, day))) {
          return true;
        }
        return false;
      })
      .sort((a, b) => {
        const aDate = getActivityPrimaryDate(a);
        const bDate = getActivityPrimaryDate(b);

        if (aDate && bDate) {
          return aDate.getTime() - bDate.getTime();
        }

        if (aDate) return -1;
        if (bDate) return 1;

        return a.name.localeCompare(b.name);
      });
  };

  const isTripDay = (day: Date) => {
    const tripStart = startOfDay(parseDateValue(trip.startDate) ?? new Date(trip.startDate));
    const tripEnd = endOfDay(parseDateValue(trip.endDate) ?? new Date(trip.endDate));

    return isWithinInterval(day, {
      start: tripStart,
      end: tripEnd,
    });
  };

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-5">
      <div className="trip-calendar-panel rounded-[20px] border border-[color:var(--calendar-line)]/70 p-4 shadow-[0_10px_30px_-12px_rgba(16,24,40,0.18)] transition-all duration-300 dark:shadow-[0_20px_44px_-18px_rgba(2,6,23,0.9)]">
        <div className="rounded-[18px] border border-[color:var(--calendar-line)]/50 bg-[var(--calendar-surface)]/95 backdrop-blur-xl">
          <div className="grid grid-cols-7 gap-2 px-4 pt-4 pb-3 text-center">
            {weekdays.map(day => (
              <div key={day} className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--calendar-muted)]">
                {day}
              </div>
            ))}
          </div>
          <div className="h-px w-full bg-[color:var(--calendar-line)]/70" />
          <div className="grid grid-cols-7 gap-2 px-4 pb-4 pt-3">
            {viewMode === "month"
              ? Array.from({ length: monthStart.getDay() }, (_, index) => (
                  <div
                    key={`empty-${index}`}
                    className="h-32 rounded-2xl border border-dashed border-[color:var(--calendar-line)]/30 bg-transparent"
                    aria-hidden
                  />
                ))
              : null}

            {days.map(day => {
              const dayActivities = getActivitiesForDay(day);
              const isTripActive = isTripDay(day);
              const isSelected = Boolean(selectedDate && isSameDay(day, selectedDate));
              const isToday = isSameDay(day, new Date());
              const outsideMonth = viewMode === "month" ? !isSameMonth(day, currentMonth) : false;

              const dayClasses = cn(
                "group/day relative flex h-32 flex-col overflow-hidden rounded-2xl border border-transparent bg-[var(--calendar-surface)]/95 p-2.5 shadow-[0_6px_18px_-14px_rgba(15,23,42,0.35)] transition-all duration-200 ease-out dark:shadow-[0_10px_24px_-16px_rgba(2,6,23,0.7)] lg:h-40",
                isTripActive
                  ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--calendar-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--calendar-canvas)] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-18px_rgba(16,24,40,0.28)] dark:hover:shadow-[0_18px_36px_-18px_rgba(2,6,23,0.85)]"
                  : "cursor-default",
                isSelected
                  ? "border-[color:var(--calendar-selected-border)] bg-[var(--calendar-selected-bg)]"
                  : isToday
                    ? "border-[color:var(--calendar-today-ring)] bg-[color:var(--calendar-today-bg)]/70"
                    : "border-[color:transparent]",
              );

              const dateLabelClass = cn(
                "text-sm font-semibold leading-none",
                outsideMonth
                  ? "text-[color:var(--calendar-muted)]/55"
                  : isTripActive
                    ? "text-[color:var(--calendar-ink)]"
                    : "text-[color:var(--calendar-muted)]/70",
              );

              return (
                <div
                  key={day.toISOString()}
                  role={isTripActive ? "button" : undefined}
                  tabIndex={isTripActive ? 0 : -1}
                  onClick={() => isTripActive && onDayClick?.(day)}
                  onKeyDown={event => {
                    if (!isTripActive) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onDayClick?.(day);
                    }
                  }}
                  aria-label={format(day, "MMMM d, yyyy")}
                  className={dayClasses}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={dateLabelClass}>{format(day, "d")}</span>
                    {isToday && !isSelected && (
                      <span className="rounded-full border border-[color:var(--calendar-today-ring)] bg-[color:var(--calendar-today-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-tight text-[color:var(--calendar-ink)]/80 leading-[1.15]">
                        Today
                      </span>
                    )}
                    {isSelected && (
                      <span className="rounded-full border border-[color:var(--calendar-selected-border)] bg-[var(--calendar-selected-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-tight text-[color:var(--calendar-ink)] leading-[1.15]">
                        Selected
                      </span>
                    )}
                  </div>

                  {isTripActive && dayActivities.length === 0 && (
                    <div className="mt-auto flex items-center justify-center">
                      <span className="rounded-full bg-[var(--calendar-canvas-accent)] px-2.5 py-0.5 text-[10px] font-medium leading-[1.2] text-[color:var(--calendar-muted)] opacity-0 transition-opacity duration-200 group-hover/day:opacity-100 group-focus-visible/day:opacity-100">
                        Tap to add plans
                      </span>
                    </div>
                  )}

                  {dayActivities.length > 0 && (
                    <DayActivityList
                      day={day}
                      activities={dayActivities}
                      onActivityClick={onActivityClick}
                      highlightPersonalProposals={highlightPersonalProposals}
                      currentUserId={currentUserId}
                      onOverflowClick={onDayOverflowClick}
                      selectedActivityId={selectedActivityId}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DayActivityListProps {
  day: Date;
  activities: ActivityWithDetails[];
  onActivityClick?: (activity: ActivityWithDetails) => void;
  onOverflowClick?: (
    day: Date,
    activities: ActivityWithDetails[],
    hiddenCount: number,
    trigger: HTMLButtonElement | null,
  ) => void;
  highlightPersonalProposals?: boolean;
  currentUserId?: string;
  selectedActivityId?: number | null;
}

function DayActivityList({
  day,
  activities,
  onActivityClick,
  onOverflowClick,
  highlightPersonalProposals,
  currentUserId,
  selectedActivityId,
}: DayActivityListProps) {
  const [layout, setLayout] = useState<LayoutState>({
    mode: "normal",
    visibleCount: activities.length,
    hiddenCount: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const setLayoutIfChanged = useCallback((next: LayoutState) => {
    setLayout(previous => {
      if (
        previous.mode === next.mode
        && previous.visibleCount === next.visibleCount
        && previous.hiddenCount === next.hiddenCount
      ) {
        return previous;
      }

      return next;
    });
  }, []);

  const computeLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const wrappers = Array.from(
      container.querySelectorAll<HTMLDivElement>("[data-calendar-chip-wrapper]"),
    );

    const overflowWrapper = container.querySelector<HTMLDivElement>(
      "[data-overflow-pill-wrapper]",
    );
    const overflowButton = overflowWrapper?.querySelector<HTMLButtonElement>(
      "[data-overflow-pill]",
    );

    const chips = wrappers
      .map(wrapper => wrapper.querySelector<HTMLButtonElement>("[data-calendar-chip]"))
      .filter((chip): chip is HTMLButtonElement => Boolean(chip));

    const totalChips = wrappers.length;
    if (totalChips === 0) {
      setLayoutIfChanged({ mode: "normal", visibleCount: 0, hiddenCount: 0 });
      return;
    }

    const availableHeight = container.clientHeight;
    if (availableHeight <= 0) {
      setLayoutIfChanged({ mode: "normal", visibleCount: totalChips, hiddenCount: 0 });
      return;
    }

    const originalMode = container.dataset.mode ?? "";
    const originalWrapperHiddenStates = wrappers.map(wrapper => wrapper.dataset.hidden ?? "");
    const originalHiddenStates = chips.map(chip => chip.dataset.hidden ?? "");
    const originalOverflowWrapperHidden = overflowWrapper?.dataset.hidden ?? "";
    const originalOverflowHidden = overflowButton?.dataset.hidden ?? "";

    let resolvedState: LayoutState | null = null;

    try {
      for (const mode of MODE_ORDER) {
        container.dataset.mode = mode;
        wrappers.forEach(wrapper => {
          wrapper.dataset.hidden = "false";
        });
        chips.forEach(chip => {
          chip.dataset.hidden = "false";
        });
        if (overflowWrapper) {
          overflowWrapper.dataset.hidden = "false";
        }
        if (overflowButton) {
          overflowButton.dataset.hidden = "false";
        }

        const gap = MODE_CONFIG[mode].gap;
        const chipHeights = wrappers.map(wrapper => wrapper.offsetHeight);
        const overflowHeight = overflowWrapper?.offsetHeight ?? 0;

        let usedHeight = 0;
        let visibleCount = 0;
        const cumulativeHeights: number[] = [];

        for (const height of chipHeights) {
          const addition = height + (visibleCount > 0 ? gap : 0);
          if (usedHeight + addition <= availableHeight) {
            usedHeight += addition;
            visibleCount += 1;
            cumulativeHeights.push(usedHeight);
          } else {
            break;
          }
        }

        let hiddenCount = Math.max(totalChips - visibleCount, 0);

        if (hiddenCount === 0) {
          resolvedState = { mode, visibleCount, hiddenCount: 0 };
          break;
        }

        if (!overflowWrapper) {
          if (visibleCount > 0) {
            resolvedState = {
              mode,
              visibleCount: Math.min(visibleCount, totalChips),
              hiddenCount,
            };
            break;
          }

          continue;
        }

        let totalWithOverflow = usedHeight + (visibleCount > 0 ? gap : 0) + overflowHeight;

        while (visibleCount > 0 && totalWithOverflow > availableHeight) {
          cumulativeHeights.pop();
          visibleCount -= 1;
          hiddenCount = Math.max(totalChips - visibleCount, 0);
          usedHeight = visibleCount > 0 ? cumulativeHeights[visibleCount - 1] : 0;
          totalWithOverflow = usedHeight + (visibleCount > 0 ? gap : 0) + overflowHeight;
        }

        hiddenCount = Math.max(totalChips - visibleCount, 0);

        if (visibleCount === 0) {
          if (mode === MODE_ORDER[MODE_ORDER.length - 1]) {
            resolvedState = {
              mode,
              visibleCount: 0,
              hiddenCount,
            };
            break;
          }

          continue;
        }

        resolvedState = {
          mode,
          visibleCount: Math.min(visibleCount, totalChips),
          hiddenCount,
        };
        break;
      }

      if (!resolvedState) {
        resolvedState = {
          mode: "micro",
          visibleCount: 0,
          hiddenCount: totalChips,
        };
      }
    } finally {
      container.dataset.mode = originalMode;
      wrappers.forEach((wrapper, index) => {
        const original = originalWrapperHiddenStates[index];
        if (original) {
          wrapper.dataset.hidden = original;
        } else {
          wrapper.removeAttribute("data-hidden");
        }
      });

      chips.forEach((chip, index) => {
        const original = originalHiddenStates[index];
        if (original) {
          chip.dataset.hidden = original;
        } else {
          chip.removeAttribute("data-hidden");
        }
      });

      if (overflowWrapper) {
        if (originalOverflowWrapperHidden) {
          overflowWrapper.dataset.hidden = originalOverflowWrapperHidden;
        } else {
          overflowWrapper.removeAttribute("data-hidden");
        }
      }

      if (overflowButton) {
        if (originalOverflowHidden) {
          overflowButton.dataset.hidden = originalOverflowHidden;
        } else {
          overflowButton.removeAttribute("data-hidden");
        }
      }

      if (resolvedState) {
        setLayoutIfChanged(resolvedState);
      }
    }
  }, [setLayoutIfChanged]);

  useLayoutEffect(() => {
    computeLayout();
  }, [computeLayout, activities, highlightPersonalProposals, currentUserId, layout.mode, layout.visibleCount]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      computeLayout();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [computeLayout]);

  useLayoutEffect(() => {
    setLayout(previous => {
      const nextVisible = activities.length;
      if (previous.visibleCount === nextVisible && previous.hiddenCount === 0) {
        return previous;
      }

      return {
        mode: previous.mode,
        visibleCount: nextVisible,
        hiddenCount: 0,
      };
    });
  }, [activities.length]);

  const visibleCount = Math.min(layout.visibleCount, activities.length);
  const hiddenCount = Math.max(activities.length - visibleCount, 0);

  return (
    <div className="mt-1 flex-1 overflow-hidden">
      <div
        ref={containerRef}
        data-mode={layout.mode}
        className="group/mode flex h-full flex-col overflow-visible gap-y-1.5 data-[mode=compact]:gap-y-1 data-[mode=micro]:gap-y-0.5"
      >
        {activities.map((activity, index) => {
          const activityWithOptions = activity as ActivityWithOptionalTimeOptions;
          const activityType = activity.type;
          const isProposal = activityType === "PROPOSE";
          const isCreator = Boolean(
            currentUserId && (activity.postedBy === currentUserId || activity.poster?.id === currentUserId),
          );
          const showPersonalProposalChip = Boolean(
            highlightPersonalProposals && isProposal && isCreator,
          );
          const showGlobalProposalChip = Boolean(isProposal && !showPersonalProposalChip);
          const isPersonalScheduleView = Boolean(currentUserId && highlightPersonalProposals);
          const inviteCount = activity.invites?.length ?? 0;
          const isPersonalEvent = Boolean(
            isPersonalScheduleView
              && ((inviteCount === 0 && activity.postedBy === currentUserId)
                || (inviteCount === 1 && activity.invites?.[0]?.userId === currentUserId)),
          );

          const themeKey = getEventThemeKey(activity.category, isPersonalEvent);
          const style = { ...themeVariableMap[themeKey] } as CalendarCssVariables;

          const primaryDate = getActivityPrimaryDate(activityWithOptions);
          const scheduledStart = parseDateValue(activityWithOptions.startTime ?? activity.startTime ?? null);
          const locationLabel = activity.location?.trim() ?? "";
          const metadata: string[] = [];

          const timeLabel = formatBadgeTime(scheduledStart ?? null);

          if (locationLabel.length > 0) {
            metadata.push(locationLabel);
          }

          const metadataLabel = metadata.join(" • ");
          const showMetadataLabel = metadataLabel.length > 0;
          const showTimeWithMetadata = Boolean(timeLabel && showMetadataLabel);
        const showStandaloneTime = Boolean(timeLabel && !showMetadataLabel);

        const isHidden = index >= visibleCount;
        const isSelected = selectedActivityId === activity.id;

        return (
          <div
            key={activity.id}
            data-calendar-chip-wrapper
              data-hidden={isHidden ? "true" : "false"}
              className={cn(
                "relative",
                "data-[hidden=true]:hidden",
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-calendar-chip
                    data-hidden={isHidden ? "true" : "false"}
                  onClick={event => {
                    event.stopPropagation();
                    onActivityClick?.(activity);
                  }}
                  style={style}
                  aria-pressed={isSelected}
                  className={cn(
                    "group/chip relative flex w-full items-start gap-2 rounded-xl border bg-[var(--chip-bg)] px-2.5 py-2 text-left text-[13px] font-semibold text-[var(--chip-text)] shadow-[0_8px_20px_-14px_rgba(15,23,42,0.4)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_26px_-14px_rgba(15,23,42,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chip-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--calendar-surface)]",
                    "min-h-[52px]",
                    "border-[var(--chip-border)]",
                    showPersonalProposalChip || showGlobalProposalChip ? "pr-2" : null,
                    isProposal ? "border-dashed" : null,
                    isSelected ? "ring-2 ring-[var(--chip-ring)]" : null,
                    "data-[hidden=true]:hidden",
                    "group-data-[mode=compact]/mode:rounded-lg group-data-[mode=compact]/mode:px-2 group-data-[mode=compact]/mode:py-1.5 group-data-[mode=compact]/mode:text-[12px] group-data-[mode=compact]/mode:font-semibold group-data-[mode=compact]/mode:gap-1.5",
                    "group-data-[mode=micro]/mode:rounded-md group-data-[mode=micro]/mode:px-1.5 group-data-[mode=micro]/mode:py-1 group-data-[mode=micro]/mode:text-[11px] group-data-[mode=micro]/mode:font-medium group-data-[mode=micro]/mode:items-center group-data-[mode=micro]/mode:gap-1.5",
                  )}
                    aria-label={formatActivityAriaLabel(activity, day)}
                  >
                    <span className="flex items-start gap-1.5 pt-0.5">
                      <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--chip-dot)] shadow-[0_0_0_3px_rgba(255,255,255,0.6)] dark:shadow-[0_0_0_3px_rgba(2,6,23,0.6)] group-data-[mode=compact]/mode:mt-0 group-data-[mode=compact]/mode:h-2 group-data-[mode=compact]/mode:w-2 group-data-[mode=micro]/mode:mt-0 group-data-[mode=micro]/mode:h-2 group-data-[mode=micro]/mode:w-2" />
                      <span className="shrink-0 text-sm leading-none group-data-[mode=compact]/mode:text-xs group-data-[mode=micro]/mode:text-xs">
                        {categoryIcons[activity.category as keyof typeof categoryIcons] || categoryIcons.other}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex min-w-0 items-start gap-1.5 text-[13px] font-semibold leading-[1.25] text-[var(--chip-text)] group-data-[mode=compact]/mode:text-[12px] group-data-[mode=compact]/mode:leading-[1.25] group-data-[mode=micro]/mode:hidden">
                        <span className="truncate text-left">{activity.name}</span>
                        {isPersonalEvent && (
                          <span className="shrink-0 rounded-full bg-[var(--chip-border)]/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--chip-text)]/75 leading-[1.1] group-data-[mode=compact]/mode:text-[9px] group-data-[mode=compact]/mode:px-1.5 group-data-[mode=micro]/mode:hidden">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--chip-dot)]" />
                            Me
                          </span>
                        )}
                      </div>
                      {showMetadataLabel && (
                        <div className="flex min-w-0 items-center gap-1 text-[11px] font-medium leading-[1.25] text-[color:var(--calendar-muted)] group-data-[mode=compact]/mode:hidden group-data-[mode=micro]/mode:hidden">
                          {showTimeWithMetadata && <span className="shrink-0">{timeLabel}</span>}
                          {showTimeWithMetadata && (
                            <span aria-hidden className="text-[color:var(--calendar-muted)]/60">
                              •
                            </span>
                          )}
                          <span className="truncate text-left">{metadataLabel}</span>
                        </div>
                      )}
                      {showStandaloneTime && (
                        <div className="flex min-w-0 items-center text-[11px] font-medium leading-[1.25] text-[color:var(--calendar-muted)] group-data-[mode=compact]/mode:hidden group-data-[mode=micro]/mode:hidden">
                          <span className="truncate text-left">{timeLabel}</span>
                        </div>
                      )}
                      {(showPersonalProposalChip || showGlobalProposalChip) && (
                        <div className="flex items-center">
                          <span
                            className={cn(
                              "inline-flex shrink-0 items-center rounded-full px-1.75 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] leading-[1.1]",
                              showPersonalProposalChip
                                ? "bg-white/70 text-[var(--chip-text)]"
                                : "bg-[var(--chip-border)]/20 text-[var(--chip-text)]/80",
                              "group-data-[mode=compact]/mode:text-[9px] group-data-[mode=compact]/mode:px-1.5 group-data-[mode=micro]/mode:hidden",
                            )}
                          >
                            Proposed
                          </span>
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "ml-auto shrink-0 self-start rounded-full bg-[var(--chip-border)]/10 px-1.75 py-0.5 text-[10px] font-semibold uppercase tracking-tight text-[color:var(--calendar-muted)] leading-[1.1]",
                        "group-data-[mode=compact]/mode:ml-1.5 group-data-[mode=compact]/mode:px-1.5",
                        "group-data-[mode=micro]/mode:ml-auto group-data-[mode=micro]/mode:bg-transparent group-data-[mode=micro]/mode:px-1 group-data-[mode=micro]/mode:text-[11px] group-data-[mode=micro]/mode:font-semibold group-data-[mode=micro]/mode:text-[var(--chip-text)] group-data-[mode=micro]/mode:tracking-[0.18em]",
                      )}
                    >
                      {formatBadgeTime(scheduledStart ?? null)}
                    </span>
                    <span className="pointer-events-none absolute inset-0 rounded-xl border border-transparent transition-all duration-200 group-hover/chip:border-[var(--chip-border)]/50" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs rounded-xl border border-[color:var(--calendar-line)]/50 bg-[var(--calendar-surface)] px-3 py-2 text-xs text-[color:var(--calendar-ink)] shadow-lg" side="top" align="start">
                  <div className="font-semibold text-[color:var(--calendar-ink)]">{activity.name}</div>
                  <div className="mt-1 text-[11px] text-[color:var(--calendar-muted)]">
                    {scheduledStart
                      ? format(scheduledStart, "EEEE • MMM d • h:mm a")
                      : primaryDate
                        ? `Proposed for ${format(primaryDate, "EEE • MMM d • h:mm a")}`
                        : "Time TBD"}
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}
        <div
          data-overflow-pill-wrapper
          data-hidden={hiddenCount > 0 ? "false" : "true"}
          className="data-[hidden=true]:hidden"
        >
          {hiddenCount > 0 && (
            <span className="sr-only" aria-live="polite">{`${hiddenCount} hidden events`}</span>
          )}
          <button
            type="button"
            data-overflow-pill
            data-hidden={hiddenCount > 0 ? "false" : "true"}
            onClick={event => {
              event.stopPropagation();
              onOverflowClick?.(day, activities, hiddenCount, event.currentTarget);
            }}
            className={cn(
              "flex w-full items-center justify-center rounded-full bg-[color:var(--calendar-canvas-accent)]/80 px-3 py-1.5 text-[12px] font-semibold tracking-tight text-[color:var(--calendar-ink)] shadow-[0_12px_22px_-16px_rgba(15,23,42,0.5)] transition-all duration-200",
              "hover:-translate-y-0.5 hover:shadow-[0_16px_26px_-16px_rgba(15,23,42,0.55)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--calendar-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--calendar-surface)]",
              "active:translate-y-0.5",
              "group-data-[mode=compact]/mode:py-1.25 group-data-[mode=compact]/mode:text-[11px]",
              "group-data-[mode=micro]/mode:py-1 group-data-[mode=micro]/mode:text-[10px]",
            )}
            aria-label={`Show ${hiddenCount} more events for ${format(day, "EEEE, MMMM d")}.`}
          >
            {`+${hiddenCount} more`}
          </button>
        </div>
      </div>
    </div>
  );
}
