import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  CalendarCheck,
  CircleCheck,
  Clock,
  MapPin,
  MessagesSquare,
  Plane,
  Receipt,
  Sparkles,
  Star,
  Vote,
  Wallet,
  Users,
} from "lucide-react"

const heroChecklist = [
  "Collect flights, stays, and activities in one shared board",
  "Vote and comment together—no more scattered group chats",
  "Personal schedules stay synced with the master itinerary",
  "Split every cost automatically so no one chases receipts",
]

type Feature = {
  title: string
  description: string
  icon: LucideIcon
}

const coreFeatures: Feature[] = [
  {
    title: "One place to collect ideas",
    description:
      "Save flights, stays, and activities side by side so everyone can compare options without digging through messages.",
    icon: MapPin,
  },
  {
    title: "Vote on the plan in minutes",
    description:
      "Use polls, reactions, and live tallies to see the group’s favorite choice emerge instantly.",
    icon: Vote,
  },
  {
    title: "Personal schedules, synced",
    description:
      "Each traveler sees a custom agenda that updates automatically when plans shift.",
    icon: CalendarCheck,
  },
  {
    title: "Expenses that balance themselves",
    description:
      "Track payments, set who owes what, and settle up without a single spreadsheet.",
    icon: Wallet,
  },
]

type FlowStep = {
  title: string
  description: string
  icon: LucideIcon
}

const planningFlow: FlowStep[] = [
  {
    title: "Collect every idea",
    description:
      "Drop in flight deals, dream stays, and must-do experiences with rich details everyone can skim in seconds.",
    icon: Sparkles,
  },
  {
    title: "Decide together",
    description:
      "Votes, threads, and nudges happen inside TripSync so the best option rises to the top—without 97 unread messages.",
    icon: MessagesSquare,
  },
  {
    title: "Sync the itinerary",
    description:
      "Personal calendars update automatically and reminders keep the whole crew on time.",
    icon: CalendarCheck,
  },
  {
    title: "Settle up without stress",
    description:
      "Track shared costs as you go and let TripSync split everything fairly when the adventure ends.",
    icon: Receipt,
  },
]

type ScheduleItem = {
  time: string
  title: string
  detail: string
  icon: LucideIcon
}

const sampleSchedule: ScheduleItem[] = [
  {
    time: "09:00",
    title: "Rooftop breakfast meetup",
    detail: "Hotel Lumia • reserved for everyone who RSVP’d",
    icon: Clock,
  },
  {
    time: "13:30",
    title: "Kayak along the coast",
    detail: "Praia da Marinha • optional add-on",
    icon: MapPin,
  },
  {
    time: "19:00",
    title: "Group dinner & vote reveal",
    detail: "Taberna do Mar • booked after poll closed",
    icon: Users,
  },
]

export default function Landing() {
  const year = useMemo(() => new Date().getFullYear(), [])

  return (
    <div className="bg-slate-950 text-white min-h-screen flex flex-col">
      <nav className="w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-semibold tracking-tight">TripSync</span>
          </div>
          <div className="hidden md:flex items-center space-x-6 text-sm text-white/80">
            <button
              className="hover:text-white transition"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              Features
            </button>
            <button
              className="hover:text-white transition"
              onClick={() => document.getElementById("flow")?.scrollIntoView({ behavior: "smooth" })}
            >
              How it works
            </button>
            <button
              className="hover:text-white transition"
              onClick={() => document.getElementById("social-proof")?.scrollIntoView({ behavior: "smooth" })}
            >
              Stories
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="hidden sm:inline-flex text-white hover:bg-white/10"
              onClick={() => (window.location.href = "/login")}
            >
              Log in
            </Button>
            <Button
              size="lg"
              onClick={() => (window.location.href = "/register")}
              className="sunset-gradient text-white font-semibold text-base px-6 h-auto py-3 hover:shadow-xl hover:-translate-y-0.5 transition"
            >
              Get started
            </Button>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1800&q=80"
              alt="Friends exploring a coastal city together"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-slate-950/75" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 lg:px-8 py-24 lg:py-36">
            <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
              <div>
                <Badge className="bg-white/15 text-white border border-white/30 uppercase tracking-wide">
                  Plan group trips without the chaos
                </Badge>
                <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight drop-shadow-xl">
                  Make group travel planning feel like part of the adventure
                </h1>
                <p className="mt-6 text-lg text-white/80 max-w-xl">
                  TripSync replaces scattered chats and messy spreadsheets with one dynamic workspace built for planning together. Give
                  your crew clarity, celebrate the best ideas, and keep the excitement high from proposal to takeoff.
                </p>
                <ul className="mt-8 space-y-3">
                  {heroChecklist.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
                        <CircleCheck className="w-4 h-4 text-emerald-300" />
                      </span>
                      <span className="text-base text-white/90 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-10 flex flex-wrap items-center gap-4">
                  <Button
                    size="lg"
                    onClick={() => (window.location.href = "/register")}
                    className="sunset-gradient text-white text-lg font-semibold px-8 h-auto py-4 shadow-2xl hover:shadow-3xl hover:-translate-y-0.5 transition"
                  >
                    Start planning
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                    className="border-white/40 bg-white/10 text-white hover:bg-white/20 h-auto px-8 py-4 text-lg"
                  >
                    See what’s inside
                  </Button>
                </div>
                <div className="mt-12 flex flex-wrap items-center gap-6 text-sm text-white/80">
                  <div className="flex -space-x-3">
                    <Avatar className="border-2 border-white bg-white/10">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-sm font-semibold">
                        AL
                      </AvatarFallback>
                    </Avatar>
                    <Avatar className="border-2 border-white bg-white/10">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-cyan-500 text-white text-sm font-semibold">
                        JP
                      </AvatarFallback>
                    </Avatar>
                    <Avatar className="border-2 border-white bg-white/10">
                      <AvatarFallback className="bg-gradient-to-br from-orange-500 to-pink-500 text-white text-sm font-semibold">
                        MK
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-amber-300">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star key={index} className="w-4 h-4" fill="currentColor" strokeWidth={0} />
                      ))}
                    </div>
                    <p className="mt-1 text-white/80">
                      Loved by crews planning over 500 trips this year
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative flex flex-col gap-6 lg:items-end">
                <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
                <div className="absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
                <Card className="relative border-none bg-white text-slate-900 shadow-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                      <Vote className="w-5 h-5 text-blue-600" />
                      Trip decisions in the open
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      Compare proposals, tally votes, and keep everyone in the loop without leaving the workspace.
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Algarve Beach Villa</p>
                          <p className="text-xs text-slate-500">7 votes • 3 comments</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-600">
                          <CircleCheck className="w-3 h-3" />
                          Leading
                        </span>
                      </div>
                      <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
                        <div className="h-full w-4/5 rounded-full bg-blue-500" />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Boutique Alfama Flats</p>
                          <p className="text-xs text-slate-500">5 votes • 8 watching</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Users className="w-4 h-4" />
                          gaining
                        </span>
                      </div>
                      <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
                        <div className="h-full w-2/3 rounded-full bg-indigo-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="relative w-full max-w-sm border-none bg-slate-900 text-white/90 shadow-xl lg:self-end">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-white">
                      <Wallet className="w-5 h-5 text-emerald-300" />
                      Expense snapshot
                    </CardTitle>
                    <p className="text-xs text-white/70">
                      Everyone sees what they owe in real time—no awkward reminders.
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Surf lesson deposit</span>
                      <span className="font-semibold">$240.00</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Brunch at Dear Breakfast</span>
                      <span className="font-semibold">$168.50</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Airbnb balance</span>
                      <span className="font-semibold">$1,124.00</span>
                    </div>
                    <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-xs text-emerald-200">
                      TripSync Split: 4 people settled, 2 pending
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="bg-white text-slate-900 py-24">
          <div className="max-w-7xl mx-auto px-4 lg:px-8">
            <div className="max-w-3xl">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                Everything your group needs to plan together
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                TripSync keeps information, decisions, schedules, and expenses in one collaborative space so your next getaway feels
                organized before you even pack.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {coreFeatures.map(({ title, description, icon: Icon }) => (
                <Card key={title} className="h-full border-slate-100 shadow-lg">
                  <CardHeader className="space-y-4 pb-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <Icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-xl text-slate-900">{title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-600 leading-relaxed">
                    {description}
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-14 flex flex-col items-center gap-3 text-center">
              <Button
                size="lg"
                onClick={() => (window.location.href = "/register")}
                className="sunset-gradient text-white text-lg font-semibold px-10 h-auto py-4 shadow-xl hover:shadow-2xl"
              >
                Get started free
              </Button>
              <p className="text-sm text-slate-500">Invite your crew in minutes. No credit card required.</p>
            </div>
          </div>
        </section>

        <section id="flow" className="relative overflow-hidden bg-slate-900 py-24 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_50%)]" />
          <div className="relative max-w-7xl mx-auto px-4 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1.05fr,0.95fr]">
              <div>
                <h2 className="text-3xl sm:text-4xl font-semibold">
                  A shared flow that keeps everyone excited for takeoff
                </h2>
                <p className="mt-4 text-lg text-white/80 max-w-2xl">
                  From the first idea to the final receipt, TripSync is built around how groups actually plan. Check the flow, nudge the
                  crew, and watch decisions happen faster than ever.
                </p>
                <div className="mt-10 space-y-6">
                  {planningFlow.map(({ title, description, icon: Icon }, index) => (
                    <div key={title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
                      <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-white/10 text-cyan-300">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-white/60">Step {index + 1}</p>
                        <h3 className="mt-1 text-xl font-semibold text-white">{title}</h3>
                        <p className="mt-2 text-sm text-white/80 leading-relaxed">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Card className="border-none bg-white text-slate-900 shadow-2xl">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-slate-900">
                      Personal schedule view
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      Every traveler sees what they signed up for and where to be—automatically synced with the group calendar.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {sampleSchedule.map(({ time, title, detail, icon: Icon }) => (
                      <div key={title} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
                        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{time}</p>
                          <p className="text-base font-semibold text-slate-900">{title}</p>
                          <p className="text-sm text-slate-500">{detail}</p>
                        </div>
                      </div>
                    ))}
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      Calendar sync on • RSVP reminders scheduled 24 hours ahead
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section id="social-proof" className="bg-white py-24 text-slate-900">
          <div className="max-w-6xl mx-auto px-4 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1fr,0.9fr] items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-semibold">
                  Groups love planning with TripSync
                </h2>
                <p className="mt-4 text-lg text-slate-600">
                  Families, wedding parties, and remote teams use TripSync to make decisions faster and keep the vibe high. That’s why we
                  see a 4.9/5 satisfaction rating across thousands of travelers.
                </p>
                <div className="mt-8 grid gap-6 sm:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 p-6 shadow-sm">
                    <p className="text-3xl font-semibold text-slate-900">500+</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Trips planned collaboratively on TripSync so far this year.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex items-center gap-1 text-amber-500">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star key={index} className="w-4 h-4" fill="currentColor" strokeWidth={0} />
                      ))}
                    </div>
                    <p className="mt-3 text-3xl font-semibold text-slate-900">4.9/5</p>
                    <p className="text-sm text-slate-500">Average rating from planning crews worldwide.</p>
                  </div>
                </div>
              </div>
              <Card className="border-none bg-slate-900 text-white shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl leading-snug text-white">
                    “TripSync turned 11 opinions into one itinerary we all loved.”
                  </CardTitle>
                  <p className="text-sm text-white/70">Janelle, Annual Friendsgiving Trip Organizer</p>
                </CardHeader>
                <CardContent className="space-y-4 text-white/80">
                  <p>
                    “Before TripSync we had three spreadsheets, four flights, and zero decisions. Now everyone drops ideas into the board,
                    votes on their favorites, and our weekend plans stay perfectly in sync. It actually made planning fun.”
                  </p>
                  <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/70">
                    Used by travel crews in {year} across retreats, reunions, and milestone celebrations.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden py-24 text-center">
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1530785602389-07594beb8b75?auto=format&fit=crop&w=1600&q=80"
              alt="Travelers celebrating sunset together"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-slate-950/80" />
          </div>
          <div className="relative max-w-3xl mx-auto px-4">
            <h2 className="text-3xl sm:text-4xl font-semibold text-white">
              Create your first TripSync board today
            </h2>
            <p className="mt-4 text-lg text-white/80">
              Bring your people together, capture every idea, and turn the planning chaos into a shared countdown to the trip.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => (window.location.href = "/register")}
                className="sunset-gradient text-white text-lg font-semibold px-10 h-auto py-4 shadow-2xl hover:shadow-3xl"
              >
                Get started
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => (window.location.href = "/login")}
                className="border-white/50 bg-white/10 text-white hover:bg-white/20 h-auto px-8 py-4 text-lg"
              >
                Explore my dashboard
              </Button>
            </div>
            <p className="mt-4 text-sm text-white/70">
              Invite unlimited collaborators and cancel anytime.
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 border-t border-white/10 py-10 text-white/70">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 flex flex-col items-center space-y-3 text-center">
          <div className="flex items-center space-x-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
              <Plane className="w-4 h-4" />
            </div>
            <span className="text-lg font-semibold text-white">TripSync</span>
          </div>
          <p className="text-sm text-white/70">
            The simple, collaborative way to plan unforgettable group adventures.
          </p>
        </div>
      </footer>
    </div>
  )
}
