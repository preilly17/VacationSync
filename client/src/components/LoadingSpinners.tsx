import { cn } from "@/lib/utils";
import { Plane, Globe, MapPin, Luggage, Camera, Compass, Train, Car, Ship, Mountain } from "lucide-react";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  text?: string;
}

// Plane Flying Animation
export function PlaneSpinner({ className, size = "md", text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8", 
    lg: "w-12 h-12"
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative">
        <div className={cn("animate-bounce", sizeClasses[size])}>
          <Plane className="w-full h-full text-blue-500 animate-pulse" />
        </div>
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-300 rounded-full animate-ping"></div>
      </div>
      {text && (
        <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}

// Globe Spinning Animation
export function GlobeSpinner({ className, size = "md", text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className={cn("animate-spin", sizeClasses[size])}>
        <Globe className="w-full h-full text-green-500" />
      </div>
      {text && (
        <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}

// Luggage Bounce Animation
export function LuggageSpinner({ className, size = "md", text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className={cn("animate-bounce", sizeClasses[size])}>
        <Luggage className="w-full h-full text-purple-500" />
      </div>
      {text && (
        <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}

// Map Pin Pulse Animation
export function MapPinSpinner({ className, size = "md", text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className={cn("animate-pulse", sizeClasses[size])}>
        <MapPin className="w-full h-full text-red-500 animate-bounce" />
      </div>
      {text && (
        <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}

// Compass Spinning Animation
export function CompassSpinner({ className, size = "md", text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className={cn("animate-spin", sizeClasses[size])}>
        <Compass className="w-full h-full text-orange-500" />
      </div>
      {text && (
        <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}

// Travel Journey Animation (Multiple Icons)
export function TravelJourneySpinner({ className, size = "md", text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8"
  };

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="flex items-center gap-2">
        <div className={cn("animate-bounce", sizeClasses[size])} style={{ animationDelay: "0ms" }}>
          <Plane className="w-full h-full text-blue-500" />
        </div>
        <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-green-500 animate-pulse"></div>
        </div>
        <div className={cn("animate-bounce", sizeClasses[size])} style={{ animationDelay: "200ms" }}>
          <MapPin className="w-full h-full text-red-500" />
        </div>
        <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-purple-500 animate-pulse"></div>
        </div>
        <div className={cn("animate-bounce", sizeClasses[size])} style={{ animationDelay: "400ms" }}>
          <Camera className="w-full h-full text-purple-500" />
        </div>
      </div>
      {text && (
        <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}

// Train Choo-Choo Animation
export function TrainSpinner({ className, size = "md", text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative">
        <div className={cn("animate-bounce", sizeClasses[size])}>
          <Train className="w-full h-full text-green-600" />
        </div>
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
          <div className="flex gap-1">
            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "200ms" }}></div>
            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "400ms" }}></div>
          </div>
        </div>
      </div>
      {text && (
        <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}

// Car Road Trip Animation
export function CarSpinner({ className, size = "md", text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative">
        <div className={cn("animate-bounce", sizeClasses[size])}>
          <Car className="w-full h-full text-red-500" />
        </div>
        <div className="absolute -bottom-2 left-0 right-0 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-full">
          <div className="h-full bg-yellow-400 rounded-full animate-pulse" style={{ width: "60%" }}></div>
        </div>
      </div>
      {text && (
        <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}

// Ship Sailing Animation
export function ShipSpinner({ className, size = "md", text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative">
        <div className={cn("animate-bounce", sizeClasses[size])}>
          <Ship className="w-full h-full text-blue-600" />
        </div>
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-blue-200 dark:bg-blue-800 rounded-full">
          <div className="h-full bg-blue-400 rounded-full animate-pulse" style={{ width: "80%" }}></div>
        </div>
      </div>
      {text && (
        <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}

// Mountain Adventure Animation
export function MountainSpinner({ className, size = "md", text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative">
        <div className={cn("animate-pulse", sizeClasses[size])}>
          <Mountain className="w-full h-full text-green-700" />
        </div>
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
        </div>
      </div>
      {text && (
        <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}

// Custom Travel Loading Animation with SVG
export function TravelLoadingSpinner({ className, size = "md", text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-24 h-24"
  };

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className={cn("relative", sizeClasses[size])}>
        <svg
          className="w-full h-full animate-spin"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer circle with travel icons */}
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            className="text-gray-300 dark:text-gray-600"
          />
          
          {/* Animated arc */}
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeDasharray="280"
            strokeDashoffset="280"
            className="text-blue-500 animate-pulse"
            style={{
              animation: "dash 2s linear infinite"
            }}
          />
          
          {/* Center plane */}
          <g transform="translate(50, 50)">
            <path
              d="M-8 -2 L-4 -6 L0 -2 L4 -6 L8 -2 L4 2 L0 6 L-4 2 Z"
              fill="currentColor"
              className="text-blue-500 animate-bounce"
            />
          </g>
        </svg>
        
        {/* Floating travel icons */}
        <div className="absolute inset-0 animate-pulse">
          <div className="absolute top-2 right-2 w-3 h-3 text-green-500">
            <Globe className="w-full h-full" />
          </div>
          <div className="absolute bottom-2 left-2 w-3 h-3 text-purple-500">
            <Luggage className="w-full h-full" />
          </div>
          <div className="absolute top-2 left-2 w-3 h-3 text-red-500">
            <MapPin className="w-full h-full" />
          </div>
          <div className="absolute bottom-2 right-2 w-3 h-3 text-orange-500">
            <Camera className="w-full h-full" />
          </div>
        </div>
      </div>
      
      {text && (
        <p className="text-sm text-gray-600 dark:text-gray-400 animate-pulse">
          {text}
        </p>
      )}
      
      <style>{`
        @keyframes dash {
          0% {
            stroke-dashoffset: 280;
          }
          50% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -280;
          }
        }
      `}</style>
    </div>
  );
}

// Main Loading Component with Random Animation
export function TravelLoading({ className, size = "md", text, variant }: LoadingSpinnerProps & { variant?: string }) {
  const spinners = [
    PlaneSpinner,
    GlobeSpinner,
    LuggageSpinner,
    MapPinSpinner,
    CompassSpinner,
    TravelJourneySpinner,
    TrainSpinner,
    CarSpinner,
    ShipSpinner,
    MountainSpinner,
    TravelLoadingSpinner
  ];

  // Use variant to determine spinner, or pick randomly
  let SpinnerComponent;
  if (variant) {
    const variantMap: { [key: string]: any } = {
      plane: PlaneSpinner,
      globe: GlobeSpinner,
      luggage: LuggageSpinner,
      mappin: MapPinSpinner,
      compass: CompassSpinner,
      journey: TravelJourneySpinner,
      train: TrainSpinner,
      car: CarSpinner,
      ship: ShipSpinner,
      mountain: MountainSpinner,
      travel: TravelLoadingSpinner
    };
    SpinnerComponent = variantMap[variant] || TravelLoadingSpinner;
  } else {
    // Pick a random spinner
    const randomIndex = Math.floor(Math.random() * spinners.length);
    SpinnerComponent = spinners[randomIndex];
  }

  return <SpinnerComponent className={className} size={size} text={text} />;
}