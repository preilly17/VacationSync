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
  "w-full flex items-center px-3 py-2 text-sm font-medium rounded-xl transition-colors duration-150";

const inactiveNavItemClasses =
  "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:ring-1 hover:ring-sidebar-ring/40";

const activeNavItemClasses =
  "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm ring-1 ring-sidebar-ring/60";

export function Sidebar({ trip, user, activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="hidden lg:flex w-[260px] shrink-0 flex-col border border-sidebar-border/70 trip-themed-nav lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:overflow-x-hidden lg:z-20">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center px-6 py-4 border-b border-sidebar-border/60">
          <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center">
            <Calendar className="text-sidebar-primary-foreground w-5 h-5" />
          </div>
          <span className="ml-3 text-xl font-semibold text-sidebar-foreground">TripSync</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link
            href="/"
            className={cn(
              baseNavItemClasses,
              "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:ring-1 hover:ring-sidebar-ring/40",
            )}
          >
            <Home className="w-4 h-4 mr-3" />
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
            <Calendar className="w-4 h-4 mr-3" />
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
            <Clock className="w-4 h-4 mr-3" />
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
            <Vote className="w-4 h-4 mr-3" />
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
            <Package className="w-4 h-4 mr-3" />
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
            <Plane className="w-4 h-4 mr-3" />
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
            <Hotel className="w-4 h-4 mr-3" />
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
            <MapPin className="w-4 h-4 mr-3" />
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
            <Utensils className="w-4 h-4 mr-3" />
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
            <ShoppingCart className="w-4 h-4 mr-3" />
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
            <DollarSign className="w-4 h-4 mr-3" />
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
            <Sparkles className="w-4 h-4 mr-3" />
            Wish List
          </button>
          <Link
            href={`/trip/${trip.id}/members`}
            className={cn(
              baseNavItemClasses,
              activeTab === "members" ? activeNavItemClasses : inactiveNavItemClasses,
            )}
          >
            <Users className="w-4 h-4 mr-3" />
            Member Schedules
          </Link>
          <button
            className={cn(
              baseNavItemClasses,
              "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:ring-1 hover:ring-sidebar-ring/40",
            )}
          >
            <Settings className="w-4 h-4 mr-3" />
            Settings
          </button>
        </nav>

        {/* User Profile */}
        <div className="px-4 py-4 border-t border-sidebar-border/60">
          <div className="flex items-center">
            <Avatar className="w-10 h-10">
              <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
              <AvatarFallback>
                {(user?.firstName?.[0] || user?.email?.[0] || "U").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="ml-3">
              <p className="text-sm font-semibold text-sidebar-foreground">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.firstName || user?.email || "User"}
              </p>
              <p className="text-xs text-sidebar-foreground/60">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
