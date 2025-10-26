import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CreateTripModal } from "@/components/create-trip-modal";

export default function PlanTrip() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) {
      setLocation("/");
    }
  }, [open, setLocation]);

  return (
    <div className="trip-themed-background">
      <CreateTripModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
