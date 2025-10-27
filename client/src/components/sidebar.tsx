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
import { cn } from "@/lib/utils";
import type { TripWithDetails, User } from "@shared/schema";

interface SidebarProps {
  trip: TripWithDetails;
  user?: User;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const baseNavItemClasses =
  "relative w-full flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70";

const inactiveNavItemClasses =
  "text-white/75 hover:text-white hover:bg-white/10 hover:ring-1 hover:ring-white/30";

const activeNavItemClasses =
  "bg-white/20 text-white shadow-lg shadow-black/10 ring-1 ring-white/45 backdrop-blur-sm";

export function Sidebar({ trip, user, activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="hidden lg:flex w-[260px] shrink-0 flex-col border border-sidebar-border/70 trip-themed-nav lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:overflow-x-hidden lg:z-20">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center px-6 py-4 border-b border-sidebar-border/60">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/15 border border-white/25">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <span className="ml-3 text-xl font-semibold text-white drop-shadow-sm">TripSync</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link
            href="/"
            className={cn(baseNavItemClasses, inactiveNavItemClasses)}
          >
            <Home className="w-4 h-4 mr-3 text-current" />
            All Trips
          </Link>
          {/* 1. Group Calendar */}
          <button
            onClick={() => onTabChange("calendar")}
            className={cn(
              baseNavItemClasses,
              activeTab === "calendar" ? activeNavItemClasses : inactiveNavItemClasses,
            )}
          >
            <Calendar className="w-4 h-4 mr-3 text-current" />
            Group Calendar
          </button>
          {/* 2. My Schedule */}
          <button
            onClick={() => onTabChange("schedule")}
            className={cn(
              baseNavItemClasses,
              activeTab === "schedule" ? activeNavItemClasses : inactiveNavItemClasses,
            )}
          >
            <Clock className="w-4 h-4 mr-3 text-current" />
            My Schedule
          </button>
          {/* 3. Proposals */}
          <button
            onClick={() => onTabChange("proposals")}
            className={cn(
              baseNavItemClasses,
              activeTab === "proposals" ? activeNavItemClasses : inactiveNavItemClasses,
            )}
          >
            <Vote className="w-4 h-4 mr-3 text-current" />
            Proposals
          </button>
          {/* 4. Packing List */}
          <button
            onClick={() => onTabChange("packing")}
            className={cn(
              baseNavItemClasses,
              activeTab === "packing" ? activeNavItemClasses : inactiveNavItemClasses,
            )}
          >
            <Package className="w-4 h-4 mr-3 text-current" />
            Packing List
          </button>
          {/* 5. Flights */}
          <button
            onClick={() => onTabChange("flights")}
            className={cn(
              baseNavItemClasses,
              activeTab === "flights" ? activeNavItemClasses : inactiveNavItemClasses,
            )}
          >
            <Plane className="w-4 h-4 mr-3 text-current" />
            Flights
          </button>
          {/* 6. Accommodations */}
          <button
            onClick={() => onTabChange("hotels")}
            className={cn(
              baseNavItemClasses,
              activeTab === "hotels" ? activeNavItemClasses : inactiveNavItemClasses,
            )}
          >
            <Hotel className="w-4 h-4 mr-3 text-current" />
            Accommodations
          </button>
          {/* 7. Discover Activities */}
          <button
            onClick={() => onTabChange("activities")}
            className={cn(
              baseNavItemClasses,
              activeTab === "activities" ? activeNavItemClasses : inactiveNavItemClasses,
            )}
          >
            <MapPin className="w-4 h-4 mr-3 text-current" />
            Discover Activities
          </button>
          {/* 8. Restaurants */}
          <button
            onClick={() => onTabChange("restaurants")}
            className={cn(
              baseNavItemClasses,
              activeTab === "restaurants" ? activeNavItemClasses : inactiveNavItemClasses,
            )}
          >
            <Utensils className="w-4 h-4 mr-3 text-current" />
            Restaurants
          </button>
          {/* 9. Groceries */}
          <button
            onClick={() => onTabChange("groceries")}
            className={cn(
              baseNavItemClasses,
              activeTab === "groceries" ? activeNavItemClasses : inactiveNavItemClasses,
            )}
          >
            <ShoppingCart className="w-4 h-4 mr-3 text-current" />
            Groceries
          </button>
          {/* 10. Expenses */}
          <button
            onClick={() => onTabChange("expenses")}
            className={cn(
              baseNavItemClasses,
              activeTab === "expenses" ? activeNavItemClasses : inactiveNavItemClasses,
            )}
          >
            <DollarSign className="w-4 h-4 mr-3 text-current" />
            Expenses
          </button>
          {/* 11. Wish List */}
          <button
            onClick={() => onTabChange("wish-list")}
            className={cn(
              baseNavItemClasses,
              activeTab === "wish-list" ? activeNavItemClasses : inactiveNavItemClasses,
            )}
          >
            <Sparkles className="w-4 h-4 mr-3 text-current" />
            Wish List
          </button>
          <Link
            href={`/trip/${trip.id}/members`}
            className={cn(
              baseNavItemClasses,
              activeTab === "members" ? activeNavItemClasses : inactiveNavItemClasses,
            )}
          >
            <Users className="w-4 h-4 mr-3 text-current" />
            Member Schedules
          </Link>
          <button
            className={cn(
              baseNavItemClasses,
              inactiveNavItemClasses,
            )}
          >
            <Settings className="w-4 h-4 mr-3 text-current" />
            Settings
          </button>
        </nav>

        {/* User Profile */}
        <div className="px-4 py-4 border-t border-sidebar-border/60">
          <div className="flex items-center">
            <Avatar className="w-10 h-10 ring-2 ring-white/20">
              <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
              <AvatarFallback className="bg-white/15 text-white">
                {(user?.firstName?.[0] || user?.email?.[0] || "U").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="ml-3">
              <p className="text-sm font-semibold text-white">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.firstName || user?.email || "User"}
              </p>
              <p className="text-xs text-white/70">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
