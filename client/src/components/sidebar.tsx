import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Clock, Users, Settings, Home, Package, DollarSign, ShoppingCart, MapPin, Plane, Hotel, Utensils, Vote, Sparkles } from "lucide-react";
import { Link } from "wouter";
import type { TripWithDetails, User } from "@shared/schema";

interface SidebarProps {
  trip: TripWithDetails;
  user?: User;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({ trip, user, activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="hidden lg:flex w-[240px] shrink-0 flex-col bg-white border-r border-gray-200 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:overflow-x-hidden lg:z-20">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex items-center px-6 py-4 border-b border-gray-200">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <Calendar className="text-white w-5 h-5" />
          </div>
          <span className="ml-3 text-xl font-semibold text-neutral-900">TripSync</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link href="/" className="flex items-center px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-gray-50 rounded-lg">
            <Home className="w-4 h-4 mr-3" />
            All Trips
          </Link>
          {/* 1. Group Calendar */}
          <button
            onClick={() => onTabChange("calendar")}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
              activeTab === "calendar"
                ? "text-primary bg-red-50"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-gray-50"
            }`}
          >
            <Calendar className="w-4 h-4 mr-3" />
            Group Calendar
          </button>
          {/* 2. My Schedule */}
          <button
            onClick={() => onTabChange("schedule")}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
              activeTab === "schedule"
                ? "text-primary bg-red-50"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-gray-50"
            }`}
          >
            <Clock className="w-4 h-4 mr-3" />
            My Schedule
          </button>
          {/* 3. Proposals */}
          <button
            onClick={() => onTabChange("proposals")}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
              activeTab === "proposals"
                ? "text-primary bg-red-50"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-gray-50"
            }`}
          >
            <Vote className="w-4 h-4 mr-3" />
            Proposals
          </button>
          {/* 4. Packing List */}
          <button
            onClick={() => onTabChange("packing")}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
              activeTab === "packing"
                ? "text-primary bg-red-50"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-gray-50"
            }`}
          >
            <Package className="w-4 h-4 mr-3" />
            Packing List
          </button>
          {/* 5. Flights */}
          <button
            onClick={() => onTabChange("flights")}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
              activeTab === "flights"
                ? "text-primary bg-red-50"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-gray-50"
            }`}
          >
            <Plane className="w-4 h-4 mr-3" />
            Flights
          </button>
          {/* 6. Hotels */}
          <button
            onClick={() => onTabChange("hotels")}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
              activeTab === "hotels"
                ? "text-primary bg-red-50"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-gray-50"
            }`}
          >
            <Hotel className="w-4 h-4 mr-3" />
            Hotels
          </button>
          {/* 7. Discover Activities */}
          <button
            onClick={() => onTabChange("activities")}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
              activeTab === "activities"
                ? "text-primary bg-red-50"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-gray-50"
            }`}
          >
            <MapPin className="w-4 h-4 mr-3" />
            Discover Activities
          </button>
          {/* 8. Restaurants */}
          <button
            onClick={() => onTabChange("restaurants")}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
              activeTab === "restaurants"
                ? "text-primary bg-red-50"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-gray-50"
            }`}
          >
            <Utensils className="w-4 h-4 mr-3" />
            Restaurants
          </button>
          {/* 9. Groceries */}
          <button
            onClick={() => onTabChange("groceries")}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
              activeTab === "groceries"
                ? "text-primary bg-red-50"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-gray-50"
            }`}
          >
            <ShoppingCart className="w-4 h-4 mr-3" />
            Groceries
          </button>
          {/* 10. Expenses */}
          <button
            onClick={() => onTabChange("expenses")}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
              activeTab === "expenses"
                ? "text-primary bg-red-50"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-gray-50"
            }`}
          >
            <DollarSign className="w-4 h-4 mr-3" />
            Expenses
          </button>
          {/* 11. Wish List */}
          <button
            onClick={() => onTabChange("wish-list")}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
              activeTab === "wish-list"
                ? "text-primary bg-red-50"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-gray-50"
            }`}
          >
            <Sparkles className="w-4 h-4 mr-3" />
            Wish List
          </button>
          <Link href={`/trip/${trip.id}/members`} className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
            activeTab === "members"
              ? "text-primary bg-red-50"
              : "text-neutral-600 hover:text-neutral-900 hover:bg-gray-50"
          }`}>
            <Users className="w-4 h-4 mr-3" />
            Member Schedules
          </Link>
          <button className="w-full flex items-center px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-gray-50 rounded-lg">
            <Settings className="w-4 h-4 mr-3" />
            Settings
          </button>
        </nav>

        {/* User Profile */}
        <div className="px-4 py-4 border-t border-gray-200">
          <div className="flex items-center">
            <Avatar className="w-10 h-10">
              <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || 'User'} />
              <AvatarFallback>
                {(user?.firstName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="ml-3">
              <p className="text-sm font-medium text-neutral-900">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user?.firstName || user?.email || 'User'
                }
              </p>
              <p className="text-xs text-neutral-600">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
