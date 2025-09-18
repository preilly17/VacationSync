import { useEffect } from "react";
import { TravelLoading } from "@/components/LoadingSpinners";

export default function Logout() {
  useEffect(() => {
    // Clear all client-side data
    localStorage.clear();
    sessionStorage.clear();
    
    // Force a complete page reload to clear any cached state
    setTimeout(() => {
      window.location.replace('/');
    }, 1000);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
      <div className="text-center">
        <TravelLoading size="lg" text="Logging you out..." />
        <p className="mt-4 text-gray-600">Clearing your session...</p>
      </div>
    </div>
  );
}