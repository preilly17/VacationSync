import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  Clock,
  Users,
  Settings,
  Home,
  Package,
  DollarSign,
  ShoppingCart,
  MapPin,
  Plane,
  Hotel,
  Utensils,
  Vote,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import type { TripWithDetails, User } from "@shared/schema";
import { cn } from "@/lib/utils";

interface SidebarProps {
  trip: TripWithDetails;
  user?: User;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({ trip, user, activeTab, onTabChange }: SidebarProps) {
  const navItemBase =
    "w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const navItemActive = "bg-white/90 text-primary shadow-sm ring-1 ring-white/40 dark:bg-white/10 dark:text-white dark:ring-white/10";
  const navItemInactive = "text-neutral-600 hover:text-neutral-900 hover:bg-white/40 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10";

  const getNavClassName = (tab: string) =>
    cn(navItemBase, activeTab === tab ? navItemActive : navItemInactive);

  return (
    <aside className="trip-themed-nav hidden w-[260px] shrink-0 flex-col border lg:flex lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:overflow-y-auto lg:overflow-x-hidden">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center border-b border-white/30 px-6 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/40">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <span className="ml-3 text-lg font-semibold text-neutral-900 dark:text-white">TripSync</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 px-4 py-6">
          <Link href="/" className={cn(navItemBase, navItemInactive)}>
            <Home className="h-4 w-4" />
            All Trips
          </Link>
          {/* 1. Group Calendar */}
          <button onClick={() => onTabChange("calendar")} className={getNavClassName("calendar")}>
            <Calendar className="h-4 w-4" />
            Group Calendar
          </button>
          {/* 2. My Schedule */}
          <button onClick={() => onTabChange("schedule")} className={getNavClassName("schedule")}>
            <Clock className="h-4 w-4" />
            My Schedule
          </button>
          {/* 3. Proposals */}
          <button onClick={() => onTabChange("proposals")} className={getNavClassName("proposals")}>
            <Vote className="h-4 w-4" />
            Proposals
          </button>
          {/* 4. Packing List */}
          <button onClick={() => onTabChange("packing")} className={getNavClassName("packing")}>
            <Package className="h-4 w-4" />
            Packing List
          </button>
          {/* 5. Flights */}
          <button onClick={() => onTabChange("flights")} className={getNavClassName("flights")}>
            <Plane className="h-4 w-4" />
            Flights
          </button>
          {/* 6. Accommodations */}
          <button onClick={() => onTabChange("hotels")} className={getNavClassName("hotels")}>
            <Hotel className="h-4 w-4" />
            Accommodations
          </button>
          {/* 7. Discover Activities */}
          <button onClick={() => onTabChange("activities")} className={getNavClassName("activities")}>
            <MapPin className="h-4 w-4" />
            Discover Activities
          </button>
          {/* 8. Restaurants */}
          <button onClick={() => onTabChange("restaurants")} className={getNavClassName("restaurants")}>
            <Utensils className="h-4 w-4" />
            Restaurants
          </button>
          {/* 9. Groceries */}
          <button onClick={() => onTabChange("groceries")} className={getNavClassName("groceries")}>
            <ShoppingCart className="h-4 w-4" />
            Groceries
          </button>
          {/* 10. Expenses */}
          <button onClick={() => onTabChange("expenses")} className={getNavClassName("expenses")}>
            <DollarSign className="h-4 w-4" />
            Expenses
          </button>
          {/* 11. Wish List */}
          <button onClick={() => onTabChange("wish-list")} className={getNavClassName("wish-list")}>
            <Sparkles className="h-4 w-4" />
            Wish List
          </button>
          <Link
            href={`/trip/${trip.id}/members`}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
              activeTab === "members" ? navItemActive : navItemInactive,
            )}
          >
            <Users className="h-4 w-4" />
            Member Schedules
          </Link>
          <button className={cn(navItemBase, navItemInactive)}>
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </nav>

        {/* User Profile */}
        <div className="border-t border-white/30 px-4 py-4">
          <div className="flex items-center">
            <Avatar className="h-11 w-11 border border-white/40 shadow-md shadow-primary/20">
              <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
              <AvatarFallback>
                {(user?.firstName?.[0] || user?.email?.[0] || "U").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="ml-3">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.firstName || user?.email || "User"}
              </p>
              <p className="text-xs text-neutral-600 dark:text-slate-300">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
