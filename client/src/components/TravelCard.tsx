import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TravelMascot } from "./TravelMascot";
import { Calendar, Users, MapPin, Plane, Camera, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface TravelCardProps {
  title: string;
  destination?: string;
  dates?: string;
  memberCount?: number;
  status?: "upcoming" | "past" | "active";
  onClick?: () => void;
  className?: string;
  gradient?: "travel" | "sunset" | "ocean";
}

export function TravelCard({
  title,
  destination,
  dates,
  memberCount,
  status = "upcoming",
  onClick,
  className,
  gradient = "travel"
}: TravelCardProps) {
  const gradientClasses = {
    travel: "travel-gradient",
    sunset: "sunset-gradient", 
    ocean: "ocean-gradient"
  };

  const statusColors = {
    upcoming: "bg-blue-100 text-blue-800",
    active: "bg-green-100 text-green-800",
    past: "bg-gray-100 text-gray-800"
  };

  const statusIcons = {
    upcoming: "plane",
    active: "camera", 
    past: "heart"
  } as const;

  return (
    <Card 
      className={cn(
        "group cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-105 overflow-hidden border-0 shadow-lg",
        className
      )}
      onClick={onClick}
    >
      <div className={`h-2 ${gradientClasses[gradient]}`} />
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <TravelMascot 
              type={statusIcons[status]} 
              size="md" 
              className="group-hover:scale-110 transition-transform duration-300"
            />
            <div>
              <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                {title}
              </h3>
              {destination && (
                <p className="text-gray-600 flex items-center space-x-1 mt-1">
                  <MapPin className="w-4 h-4" />
                  <span>{destination}</span>
                </p>
              )}
            </div>
          </div>
          <Badge className={statusColors[status]}>
            {status}
          </Badge>
        </div>
        
        <div className="space-y-2">
          {dates && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>{dates}</span>
            </div>
          )}
          {memberCount && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Empty state card for when no trips exist
export function EmptyTravelCard({ onCreateTrip }: { onCreateTrip: () => void }) {
  return (
    <Card 
      className="group cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-2 border-dashed border-gray-300 hover:border-blue-400"
      onClick={onCreateTrip}
    >
      <CardContent className="p-8 text-center">
        <div className="mb-4">
          <div className="w-16 h-16 mx-auto travel-gradient rounded-full flex items-center justify-center pulse-travel">
            <Plane className="w-8 h-8 text-white" />
          </div>
        </div>
        <h3 className="font-semibold text-lg text-gray-900 mb-2">
          Start Your Adventure!
        </h3>
        <p className="text-gray-600 mb-4">
          Create your first trip and begin planning an amazing journey with friends.
        </p>
      </CardContent>
    </Card>
  );
}