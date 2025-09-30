import { type ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface HowItWorksPanelProps {
  titleId: string;
  descriptionId: string;
  onDismiss: () => void;
  onCreateTrip: () => void;
  onInviteMembers: () => void;
  onAddActivity: () => void;
  onBrowseDiscovery: () => void;
  onOpenExpenses: () => void;
  onOpenPacking: () => void;
  onOpenPreferences: () => void;
}

type Benefit = {
  title: string;
  description: string;
  icon: ReactNode;
};

type FlowStep = {
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
};

const benefits: Benefit[] = [
  {
    title: "Plan together, in one place.",
    description:
      "Keep flights, stays, meals, activities, and RSVPs on a single shared timeline.",
    icon: (
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
        <UsersRound className="h-5 w-5" aria-hidden="true" />
      </div>
    ),
  },
  {
    title: "Decide fast.",
    description: "Propose options, vote, and convert winners into scheduled items.",
    icon: (
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
      </div>
    ),
  },
  {
    title: "Stay in sync.",
    description:
      "Personal schedule for what you’re attending; group calendar for everything the trip sees.",
    icon: (
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <CalendarDays className="h-5 w-5" aria-hidden="true" />
      </div>
    ),
  },
];

export default function HowItWorksPanel({
  titleId,
  descriptionId,
  onDismiss,
  onCreateTrip,
  onInviteMembers,
  onAddActivity,
  onBrowseDiscovery,
  onOpenExpenses,
  onOpenPacking,
  onOpenPreferences,
}: HowItWorksPanelProps) {
  const flowSteps: FlowStep[] = [
    {
      title: "Create Your First Trip",
      description: "Start a new trip calendar with destination and dates.",
      cta: "Create trip",
      onClick: onCreateTrip,
    },
    {
      title: "Invite Your Travel Group",
      description: "Share your trip link so friends can join and collaborate.",
      cta: "Invite members",
      onClick: onInviteMembers,
    },
    {
      title: "Plan Activities Together",
      description:
        "Propose or schedule restaurants, tours, and more. Friends can vote or RSVP yes/no.",
      cta: "Add activity",
      onClick: onAddActivity,
    },
    {
      title: "Discover Local Experiences",
      description:
        "Search hotels, restaurants, and activities with live filters — add straight to the trip.",
      cta: "Browse discovery",
      onClick: onBrowseDiscovery,
    },
    {
      title: "Split Expenses Fairly",
      description: "Log group costs, see who owes who, and settle up later.",
      cta: "Open expenses",
      onClick: onOpenExpenses,
    },
    {
      title: "Coordinate Packing",
      description: "Keep a shared checklist so nothing gets missed.",
      cta: "Open packing list",
      onClick: onOpenPacking,
    },
    {
      title: "Tune Notifications & Preferences",
      description: "Choose what updates you get and how you’re notified.",
      cta: "Profile & Preferences",
      onClick: onOpenPreferences,
    },
  ];

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex-1 overflow-y-auto px-6 pb-28 pt-10 sm:px-10">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-slate-600">
            <Sparkles className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
            How it works
          </div>
          <div className="space-y-3">
            <h1 id={titleId} className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              How TripSync Works
            </h1>
            <p id={descriptionId} className="max-w-2xl text-base text-slate-600 sm:text-lg">
              Plan amazing group trips with collaborative tools — all in one place.
            </p>
          </div>
        </header>

        <section aria-labelledby="how-it-works-why" className="mt-10 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="how-it-works-why" className="text-lg font-semibold text-slate-900">
              Why TripSync
            </h2>
            <span className="text-sm text-slate-500">Three quick benefits</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {benefits.map((benefit) => (
              <article
                key={benefit.title}
                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                {benefit.icon}
                <h3 className="mt-5 text-base font-semibold text-slate-900">{benefit.title}</h3>
                <p className="mt-3 text-sm text-slate-600">{benefit.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="how-it-works-flow" className="mt-12 space-y-5">
          <div className="space-y-2">
            <h2 id="how-it-works-flow" className="text-lg font-semibold text-slate-900">
              The flow
            </h2>
            <p className="text-sm text-slate-500">Seven quick steps to launch your next adventure.</p>
          </div>
          <div className="space-y-3">
            {flowSteps.map((step, index) => (
              <article
                key={step.title}
                className="flex flex-col gap-4 rounded-3xl border border-slate-200/90 bg-slate-50/70 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-1 items-start gap-4">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
                    <p className="text-sm text-slate-600">{step.description}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 shrink-0 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                  onClick={step.onClick}
                >
                  {step.cta}
                  <ArrowUpRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                </Button>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="how-it-works-tips" className="mt-12 space-y-4">
          <h2 id="how-it-works-tips" className="text-lg font-semibold text-slate-900">
            Tips
          </h2>
          <div className="space-y-4 rounded-3xl border border-sky-100 bg-sky-50/80 p-6 shadow-sm">
            <div>
              <h3 className="text-base font-semibold text-sky-900">Scheduled vs Proposed</h3>
              <p className="mt-1.5 text-sm text-sky-900/80">
                Use <strong>Scheduled</strong> when a time/date is set and you need accept/decline. Use <strong>Proposed</strong> to
                collect interest/votes before booking.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-sky-900">Two calendars</h3>
              <p className="mt-1.5 text-sm text-sky-900/80">
                <strong>My Schedule</strong> shows only what you’re attending; <strong>Group Calendar</strong> shows everything on the trip.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-sky-900">Quick add</h3>
              <p className="mt-1.5 text-sm text-sky-900/80">
                You can add items from each tab without leaving the page (search sits in-page).
              </p>
            </div>
          </div>
        </section>
      </div>

      <footer className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-6 py-5 backdrop-blur sm:px-10">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-full px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            onClick={onCreateTrip}
          >
            Create a trip
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full bg-sky-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
            onClick={onDismiss}
          >
            Got it
          </Button>
        </div>
      </footer>
    </div>
  );
}
