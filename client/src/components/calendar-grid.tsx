import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, isSameMonth } from "date-fns";
import type { ActivityWithDetails, TripWithDetails } from "@shared/schema";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

type CalendarCssVariables = CSSProperties & Record<string, string | number | undefined>;

interface CalendarGridProps {
  currentMonth: Date;
  activities: ActivityWithDetails[];
  trip: TripWithDetails;
  selectedDate?: Date | null;
  onDayClick?: (date: Date) => void;
  onActivityClick?: (activity: ActivityWithDetails) => void;
  currentUserId?: string;
  highlightPersonalProposals?: boolean;
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

const MAX_VISIBLE_EVENTS = 3;

type EventThemeKey = "flights" | "stays" | "dining" | "adventure" | "personal" | "default";

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

const formatBadgeTime = (dateInput: string | Date) => {
  const dateValue = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return format(dateValue, "h:mmaaa").toLowerCase().replace("m", "");
};

const formatActivityAriaLabel = (activity: ActivityWithDetails, day: Date) => {
  const start = new Date(activity.startTime);
  const timeLabel = format(start, "h:mm a");
  const dateLabel = format(day, "MMM d");
  return `${activity.name} at ${timeLabel} on ${dateLabel}`;
};

export function CalendarGrid({
  currentMonth,
  activities,
  trip,
  selectedDate,
  onDayClick,
  onActivityClick,
  currentUserId,
  highlightPersonalProposals,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getActivitiesForDay = (day: Date) => {
    return activities
      .filter(activity => isSameDay(new Date(activity.startTime), day))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  const isTripDay = (day: Date) => {
    return isWithinInterval(day, {
      start: new Date(trip.startDate),
      end: new Date(trip.endDate)
    });
  };

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get unique categories from current activities for the legend
  const activeCategories = Array.from(new Set(activities.map(a => a.category || 'other')));

  const legendItems = [
    { category: 'flights', name: 'Flights', icon: '✈️' },
    { category: 'hotels', name: 'Hotels', icon: '🏨' },
    { category: 'restaurants', name: 'Restaurants', icon: '🍴' },
    { category: 'activities', name: 'Activities', icon: '🎯' },
    { category: 'sightseeing', name: 'Sightseeing', icon: '🏯' },
    { category: 'entertainment', name: 'Entertainment', icon: '🎤' },
  ].filter(item => activeCategories.includes(item.category));

  return (
    <div className="space-y-5">
      {activities.length > 0 && legendItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-full border border-[color:var(--calendar-line)]/60 bg-[var(--calendar-canvas)]/70 px-4 py-2.5 text-xs text-[color:var(--calendar-muted)] shadow-[0_12px_30px_-22px_rgba(16,24,40,0.25)] transition-colors dark:border-[color:var(--calendar-line)]/70">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--calendar-muted)]">Legend</span>
          {legendItems.map(({ category, name, icon }) => {
            const themeKey = getEventThemeKey(category, false);
            const style = { ...themeVariableMap[themeKey] } as CalendarCssVariables;

            return (
              <span
                key={category}
                className="flex items-center gap-2 rounded-full bg-[var(--calendar-surface)]/80 px-3 py-1.5 shadow-[0_6px_12px_-10px_rgba(15,23,42,0.25)]"
                style={style}
              >
                <span className="flex h-2.5 w-2.5 items-center justify-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--chip-dot)]" aria-hidden />
                </span>
                <span className="text-[11px] font-medium text-[var(--chip-text)]">
                  {icon} {name}
                </span>
              </span>
            );
          })}
        </div>
      )}

      <div className="rounded-[20px] border border-[color:var(--calendar-line)]/70 bg-[var(--calendar-canvas)]/90 p-4 shadow-[0_10px_30px_-12px_rgba(16,24,40,0.18)] transition-all duration-300 dark:shadow-[0_20px_44px_-18px_rgba(2,6,23,0.9)]">
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
            {Array.from({ length: monthStart.getDay() }, (_, index) => (
              <div
                key={`empty-${index}`}
                className="h-32 rounded-2xl border border-dashed border-[color:var(--calendar-line)]/30 bg-transparent"
                aria-hidden
              />
            ))}

            {days.map(day => {
              const dayActivities = getActivitiesForDay(day);
              const isTripActive = isTripDay(day);
              const isSelected = Boolean(selectedDate && isSameDay(day, selectedDate));
              const isToday = isSameDay(day, new Date());
              const outsideMonth = !isSameMonth(day, currentMonth);

              const visibleActivities = dayActivities.slice(0, MAX_VISIBLE_EVENTS);
              const hiddenCount = Math.max(dayActivities.length - visibleActivities.length, 0);

              const dayClasses = cn(
                "group/day relative flex h-32 flex-col overflow-hidden rounded-2xl border border-transparent bg-[var(--calendar-surface)]/95 p-3 shadow-[0_6px_18px_-14px_rgba(15,23,42,0.35)] transition-all duration-200 ease-out dark:shadow-[0_10px_24px_-16px_rgba(2,6,23,0.7)] lg:h-40",
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
                  <div className="flex items-center justify-between">
                    <span className={dateLabelClass}>{format(day, "d")}</span>
                    {isToday && !isSelected && (
                      <span className="rounded-full border border-[color:var(--calendar-today-ring)] bg-[color:var(--calendar-today-bg)] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-tight text-[color:var(--calendar-ink)]/80">
                        Today
                      </span>
                    )}
                    {isSelected && (
                      <span className="rounded-full border border-[color:var(--calendar-selected-border)] bg-[var(--calendar-selected-bg)] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-tight text-[color:var(--calendar-ink)]">
                        Selected
                      </span>
                    )}
                  </div>

                  {isTripActive && dayActivities.length === 0 && (
                    <div className="mt-auto flex items-center justify-center">
                      <span className="rounded-full bg-[var(--calendar-canvas-accent)] px-3 py-1 text-[11px] font-medium text-[color:var(--calendar-muted)] opacity-0 transition-opacity duration-200 group-hover/day:opacity-100 group-focus-visible/day:opacity-100">
                        Tap to add plans
                      </span>
                    </div>
                  )}

                  {dayActivities.length > 0 && (
                    <div className="mt-2 flex-1 space-y-1 overflow-hidden">
                      {visibleActivities.map(activity => {
                        const activityType = (activity.type ?? "SCHEDULED").toUpperCase();
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

                        const metadata: string[] = [
                          format(new Date(activity.startTime), "h:mm a"),
                        ];

                        if (activity.location && activity.location.trim().length > 0) {
                          metadata.push(activity.location);
                        }

                        return (
                          <Tooltip key={activity.id}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={event => {
                                  event.stopPropagation();
                                  onActivityClick?.(activity);
                                }}
                                style={style}
                                className={cn(
                                  "group/chip relative flex w-full items-start gap-2 rounded-xl border bg-[var(--chip-bg)] px-3 py-2 text-left text-sm font-semibold text-[var(--chip-text)] shadow-[0_8px_20px_-14px_rgba(15,23,42,0.4)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_26px_-14px_rgba(15,23,42,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chip-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--calendar-surface)]",
                                  showPersonalProposalChip || showGlobalProposalChip ? "pr-2" : "",
                                  "border-[var(--chip-border)]",
                                  isProposal ? "border-dashed" : null,
                                )}
                                aria-label={formatActivityAriaLabel(activity, day)}
                              >
                                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--chip-dot)] shadow-[0_0_0_3px_rgba(255,255,255,0.6)] dark:shadow-[0_0_0_3px_rgba(2,6,23,0.6)]" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1 text-[13px] font-semibold leading-5 text-[var(--chip-text)]">
                                    <span className="shrink-0 text-sm">
                                      {categoryIcons[activity.category as keyof typeof categoryIcons] || categoryIcons.other}
                                    </span>
                                    <span className="truncate">
                                      {activity.name}
                                    </span>
                                    {isPersonalEvent && (
                                      <span className="ml-1 flex items-center gap-1 rounded-full bg-[var(--chip-border)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--chip-text)]/75">
                                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--chip-dot)]" />
                                        Me
                                      </span>
                                    )}
                                    {(showPersonalProposalChip || showGlobalProposalChip) && (
                                      <span
                                        className={cn(
                                          "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                                          showPersonalProposalChip
                                            ? "bg-white/70 text-[var(--chip-text)]"
                                            : "bg-[var(--chip-border)]/20 text-[var(--chip-text)]/80",
                                        )}
                                      >
                                        Proposed
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[color:var(--calendar-muted)]">
                                    <span className="truncate">
                                      {metadata.join(" • ")}
                                    </span>
                                  </div>
                                </div>
                                <span className="ml-2 shrink-0 rounded-full bg-[var(--chip-border)]/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-tight text-[color:var(--calendar-muted)]">
                                  {formatBadgeTime(activity.startTime)}
                                </span>
                                <span className="pointer-events-none absolute inset-0 rounded-xl border border-transparent transition-all duration-200 group-hover/chip:border-[var(--chip-border)]/50" aria-hidden />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs rounded-xl border border-[color:var(--calendar-line)]/50 bg-[var(--calendar-surface)] px-3 py-2 text-xs text-[color:var(--calendar-ink)] shadow-lg" side="top" align="start">
                              <div className="font-semibold text-[color:var(--calendar-ink)]">{activity.name}</div>
                              <div className="mt-1 text-[11px] text-[color:var(--calendar-muted)]">
                                {format(new Date(activity.startTime), "EEEE • MMM d • h:mm a")}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                      {hiddenCount > 0 && (
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            onDayClick?.(day);
                          }}
                          className="group self-end rounded-full border border-dashed border-[color:var(--calendar-line)]/70 bg-transparent px-3 py-1 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--calendar-muted)] transition-all duration-200 hover:bg-[var(--calendar-canvas-accent)] hover:text-[color:var(--calendar-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--calendar-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--calendar-surface)]"
                          aria-label={`${hiddenCount} more activities on ${format(day, "MMMM d")}`}
                        >
                          +{hiddenCount} more
                        </button>
                      )}
                    </div>
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
