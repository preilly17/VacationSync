import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Compass,
  DollarSign,
  Hotel,
  MapPin,
  Package,
  Plane,
  Plus,
  Star,
  Users,
} from "lucide-react";

interface Step {
  title: string;
  description: string;
  icon: LucideIcon;
  tip?: string;
}

const dashboardSteps: Step[] = [
  {
    title: "Welcome to TripSync!",
    description: "Plan unforgettable group trips with your friends. Let's get you set up in just a few steps.",
    icon: Star,
  },
  {
    title: "Create Your First Trip",
    description: "Pick your destination and dates to start your trip calendar. This is the hub for everything your group will plan together.",
    icon: Plus,
    tip: 'Click "Create Trip" to get started',
  },
  {
    title: "Invite Your Group",
    description: "Send your trip link to friends. Once they join, they can add ideas, vote, and help plan every detail.",
    icon: Users,
    tip: 'Use the "Invite Members" button to share your trip',
  },
  {
    title: "Plan Activities & Meals",
    description: "Suggest activities or group meals, and let everyone vote. You'll quickly see what the group is most excited about.",
    icon: Calendar,
    tip: 'Use "Add Activity" to propose plans the whole crew can weigh in on',
  },
  {
    title: "Find Hotels & Flights",
    description: "Compare options as a group and vote on the ones that work best. See real-time availability and make decisions together.",
    icon: Plane,
    tip: 'Review the Hotels and Flights tabs to decide together before booking',
  },
  {
    title: "Split Costs Easily",
    description: "Keep track of who paid for what. Expenses are divided fairly so no one is left chasing payments.",
    icon: DollarSign,
    tip: 'Use the Expenses tab to log purchases and settle up',
  },
  {
    title: "Groceries & Packing Lists",
    description: "Stay organized with shared grocery and packing lists. Everyone can add items so nothing gets forgotten.",
    icon: Package,
    tip: 'Open the Packing tab to coordinate grocery runs and packing duties',
  },
  {
    title: "Your Schedule",
    description: "See only the activities you've joined, alongside the full group calendar. No clutter, just what matters to you.",
    icon: CheckCircle,
    tip: 'Switch to "Personal Schedule" to see your confirmed plans',
  },
  {
    title: "You're Ready to Go!",
    description: "Your trip is set up — now explore, plan, and enjoy. You can always return to this guide from your dashboard.",
    icon: Compass,
    tip: 'Reopen this guide from your dashboard any time you need a refresher',
  },
];

const tripSteps: Step[] = [
  {
    title: "Welcome to Your Trip!",
    description: "Let's take a quick tour of how to plan your perfect vacation with your group.",
    icon: Calendar,
  },
  {
    title: "Trip Navigation",
    description: "Use these tabs to access different areas of your trip planning. Each section helps coordinate a different aspect of your vacation.",
    icon: Compass,
  },
  {
    title: "Group Calendar",
    description: "View all planned activities in one place. Click on any day to quickly add new activities for your group.",
    icon: Calendar,
  },
  {
    title: "Flight Coordination",
    description: "Search and coordinate flights with your group. Compare prices and book together for the best deals.",
    icon: Plane,
  },
  {
    title: "Hotel Booking",
    description: "Find and book accommodations that work for everyone. Search by location, price, and amenities.",
    icon: Hotel,
  },
  {
    title: "Activity Discovery",
    description: "Search and discover authentic activities and experiences at your destination. Book tours, attractions, and adventures.",
    icon: MapPin,
  },
  {
    title: "Expense Splitting",
    description: "Track shared expenses and split costs fairly among group members. Never worry about who owes what again.",
    icon: DollarSign,
  },
  {
    title: "Invite Members",
    description: "Click here to invite friends and family to join your trip. They'll get access to all the planning tools.",
    icon: Users,
  },
  {
    title: "You're Ready to Go!",
    description: "Your trip is set up — now explore, plan, and enjoy. You can always return to this guide from your dashboard.",
    icon: CheckCircle,
  },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            TripSync tutorial
          </span>
          <Link href="/">
            <Button
              variant="outline"
              className="gap-2 border-primary/30 text-primary shadow-none transition hover:-translate-y-0.5 hover:bg-primary/10"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to dashboard
            </Button>
          </Link>
        </div>
      </header>

      <section className="bg-gradient-to-br from-white via-primary/10 to-emerald-50/80">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="max-w-3xl space-y-4">
            <Badge
              variant="secondary"
              className="w-fit rounded-full border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium uppercase tracking-wide text-primary"
            >
              Product guide
            </Badge>
            <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">How TripSync works</h1>
            <p className="text-lg leading-relaxed text-slate-600 md:text-xl">
              Collaborate with your travel group to plan unforgettable adventures. This guide summarizes the interactive tour and highlights where to find the tools you need.
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-12 px-6 py-12">
        <Card className="border-none bg-white shadow-xl ring-1 ring-primary/10">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-slate-900">Home dashboard essentials</CardTitle>
            <CardDescription className="text-base text-slate-600">
              These steps mirror the original onboarding tour and show how to get oriented when you sign in.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <ol className="space-y-4">
              {dashboardSteps.map((step, index) => (
                <li
                  key={step.title}
                  className="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <step.icon className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                    </div>
                    <Badge
                      variant="secondary"
                      className="border border-primary/20 bg-primary/10 text-primary"
                    >
                      Step {index + 1}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{step.description}</p>
                  {step.tip && (
                    <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                      💡 {step.tip}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="border-none bg-white shadow-xl ring-1 ring-emerald-100/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-slate-900">Deep-dive into trip planning</CardTitle>
            <CardDescription className="text-base text-slate-600">
              When you open a specific trip, use these focus areas to collaborate and keep everyone informed.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <ol className="space-y-4">
              {tripSteps.map((step, index) => (
                <li
                  key={step.title}
                  className="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                        <step.icon className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                    </div>
                    <Badge
                      variant="outline"
                      className="border border-emerald-200 bg-emerald-50 text-xs font-medium uppercase tracking-wide text-emerald-700"
                    >
                      {index + 1} of {tripSteps.length}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{step.description}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
