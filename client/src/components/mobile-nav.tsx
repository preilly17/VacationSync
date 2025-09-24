import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Calendar, Plus, Menu, Users, Clock, Home, Package, DollarSign, MapPin, Lightbulb } from "lucide-react";
import { Link } from "wouter";
import { NotificationIcon } from "./notification-icon";
import type { TripWithDetails, User } from "@shared/schema";

interface MobileNavProps {
  trip: TripWithDetails;
  user?: User;
}

export function MobileNav({ trip, user }: MobileNavProps) {
  return (
    <nav className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="p-0">
                <Menu className="w-5 h-5 text-neutral-600" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex flex-col h-full">
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
                  <Link href="/how-it-works" className="flex items-center px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-gray-50 rounded-lg">
                    <Lightbulb className="w-4 h-4 mr-3" />
                    How it works
                  </Link>
                  <Link href={`/trip/${trip.id}`} className="flex items-center px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-gray-50 rounded-lg">
                    <Calendar className="w-4 h-4 mr-3" />
                    Trip Calendar
                  </Link>
                  <Link href={`/trip/${trip.id}/members`} className="flex items-center px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-gray-50 rounded-lg">
                    <Users className="w-4 h-4 mr-3" />
                    Member Schedules
                  </Link>
                  <Link href={`/trip/${trip.id}/activities`} className="flex items-center px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-gray-50 rounded-lg">
                    <MapPin className="w-4 h-4 mr-3" />
                    Activities
                  </Link>
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
            </SheetContent>
          </Sheet>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Calendar className="text-white w-4 h-4" />
          </div>
          <span className="text-lg font-semibold text-neutral-900">TripSync</span>
        </div>
        <div className="flex items-center space-x-3">
          <NotificationIcon />
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || 'User'} />
            <AvatarFallback className="text-xs">
              {(user?.firstName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </nav>
  );
}
