import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";
import {
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
    description: "Plan amazing group trips with collaborative tools. Let's walk through the key features.",
    icon: Star,
  },
  {
    title: "Create Your First Trip",
    description: "Start by creating a new trip calendar. Add destination, dates, and invite your travel companions.",
    icon: Plus,
    tip: 'Click "Create Trip" to get started',
  },
  {
    title: "Invite Your Travel Group",
    description: "Share your trip with friends using the invite link. Everyone can join and contribute to planning.",
    icon: Users,
    tip: 'Use the "Invite Members" button to share your trip',
  },
  {
    title: "Plan Activities Together",
    description: "Propose activities, restaurants, and experiences. Group members can accept or decline proposals.",
    icon: Calendar,
    tip: 'Click "Add Activity" to propose something fun',
  },
  {
    title: "Discover Local Experiences",
    description: "Search for activities, restaurants, and hotels in your destination with real-time availability.",
    icon: MapPin,
    tip: 'Explore the Activities, Restaurants, and Hotels tabs',
  },
  {
    title: "Split Expenses Fairly",
    description: "Track shared costs and split expenses among group members with integrated payment apps.",
    icon: DollarSign,
    tip: 'Use the Expenses tab to manage group spending',
  },
  {
    title: "Coordinate Packing",
    description: "Create shared packing lists and coordinate who brings what to avoid duplicates.",
    icon: Package,
    tip: 'Check out the Packing tab for group coordination',
  },
  {
    title: "Your Personal Schedule",
    description: "View only activities you've accepted in your personalized calendar view.",
    icon: CheckCircle,
    tip: 'Switch to "Personal Schedule" to see your confirmed activities',
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
    title: "You're All Set!",
    description: "Start planning your amazing trip! You can revisit this guide anytime from your dashboard.",
    icon: CheckCircle,
  },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-primary/80 to-red-500 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <Badge variant="secondary" className="bg-white/20 text-white border-white/40 mb-4">
            Product guide
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">How TripSync works</h1>
          <p className="max-w-3xl text-white/90 text-lg md:text-xl leading-relaxed">
            Collaborate with your travel group to plan unforgettable adventures. This guide summarizes the interactive tour and highlights where to find the tools you need.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/">
              <Button variant="secondary" className="bg-white text-primary hover:bg-white/90">
                Back to dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        <Card>
          <CardHeader>
            <CardTitle>Home dashboard essentials</CardTitle>
            <CardDescription>
              These steps mirror the original onboarding tour and show how to get oriented when you sign in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {dashboardSteps.map((step, index) => (
              <div key={step.title} className="flex gap-4">
                <div className="mt-1 h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <step.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {step.title}
                    </h3>
                    <Badge variant="secondary">Step {index + 1}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
                  {step.tip && (
                    <div className="text-sm text-primary-700 bg-primary/5 border border-primary/10 rounded-lg px-4 py-3">
                      💡 {step.tip}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deep-dive into trip planning</CardTitle>
            <CardDescription>
              When you open a specific trip, use these focus areas to collaborate and keep everyone informed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {tripSteps.map((step, index) => (
              <div key={step.title} className="flex gap-4">
                <div className="mt-1 h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <step.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {step.title}
                    </h3>
                    <Badge variant="outline" className="text-xs uppercase tracking-wide">
                      {index + 1} of {tripSteps.length}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
