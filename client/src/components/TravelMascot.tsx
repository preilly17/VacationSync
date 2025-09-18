import { Plane, MapPin, Calendar, Users, Camera, Heart } from "lucide-react";

interface TravelMascotProps {
  type?: "plane" | "map" | "calendar" | "group" | "camera" | "heart";
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
}

export function TravelMascot({ 
  type = "plane", 
  size = "md", 
  animated = true,
  className = "" 
}: TravelMascotProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12", 
    lg: "w-16 h-16"
  };

  const animationClass = animated ? "float-animation" : "";
  
  const iconProps = {
    className: `${sizeClasses[size]} ${animationClass} ${className}`,
    strokeWidth: 1.5
  };

  const icons = {
    plane: <Plane {...iconProps} className={`${iconProps.className} text-blue-500`} />,
    map: <MapPin {...iconProps} className={`${iconProps.className} text-green-500`} />,
    calendar: <Calendar {...iconProps} className={`${iconProps.className} text-purple-500`} />,
    group: <Users {...iconProps} className={`${iconProps.className} text-orange-500`} />,
    camera: <Camera {...iconProps} className={`${iconProps.className} text-pink-500`} />,
    heart: <Heart {...iconProps} className={`${iconProps.className} text-red-500`} />
  };

  return (
    <div className="inline-flex items-center justify-center">
      {icons[type]}
    </div>
  );
}

// Travel-themed decorative elements
export function TravelDecorations() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Floating travel icons */}
      <div className="absolute top-10 left-10 opacity-10">
        <TravelMascot type="plane" size="lg" />
      </div>
      <div className="absolute top-20 right-20 opacity-10">
        <TravelMascot type="map" size="md" />
      </div>
      <div className="absolute bottom-20 left-20 opacity-10">
        <TravelMascot type="camera" size="lg" />
      </div>
      <div className="absolute bottom-10 right-10 opacity-10">
        <TravelMascot type="heart" size="md" />
      </div>
    </div>
  );
}

// Hero travel mascot for landing pages
export function HeroTravelMascot() {
  return (
    <div className="relative">
      <div className="w-32 h-32 mx-auto travel-gradient rounded-full flex items-center justify-center shadow-2xl pulse-travel">
        <Plane className="w-16 h-16 text-white wave-animation" strokeWidth={1.5} />
      </div>
      <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
        <MapPin className="w-4 h-4 text-white" />
      </div>
      <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-green-400 rounded-full flex items-center justify-center shadow-lg">
        <Calendar className="w-4 h-4 text-white" />
      </div>
    </div>
  );
}