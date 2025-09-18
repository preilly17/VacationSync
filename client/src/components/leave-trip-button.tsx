import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LogOut } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { TripWithDetails, User } from "@shared/schema";

interface LeaveTripButtonProps {
  trip: TripWithDetails;
  user?: User;
}

export function LeaveTripButton({ trip, user }: LeaveTripButtonProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const leaveTripMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/trips/${trip.id}/leave`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Left Trip",
        description: `You have successfully left ${trip.name}`,
      });
      
      // Invalidate trips list to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      
      // Redirect to home page
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to leave trip",
        variant: "destructive",
      });
    },
  });

  const isCreator = trip.createdBy === user?.id;

  // For testing, let's temporarily allow creators to see the button but with a different dialog
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={isCreator ? "text-gray-600 border-gray-200" : "text-red-600 border-red-200 hover:bg-red-50"}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {isCreator ? "Trip Creator" : "Leave Trip"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isCreator ? "Trip Creator" : "Leave Trip"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isCreator ? (
              <>
                As the trip creator, you cannot leave "{trip.name}". 
                <br /><br />
                If you no longer want to manage this trip, you can:
                <br />
                • Transfer ownership to another member
                <br />
                • Delete the entire trip (this will remove it for everyone)
                <br /><br />
                This protects the trip from being left without an organizer.
              </>
            ) : (
              <>
                Are you sure you want to leave "{trip.name}"? This action will:
                <br /><br />
                • Remove you from the trip group
                <br />
                • Remove your access to trip activities and planning
                <br />
                • Keep your activity suggestions and responses visible to others
                <br />
                • Preserve the shared calendar for remaining members
                <br /><br />
                You won't be able to rejoin without a new invitation link.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {!isCreator && (
            <AlertDialogAction
              onClick={() => leaveTripMutation.mutate()}
              disabled={leaveTripMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {leaveTripMutation.isPending ? "Leaving..." : "Yes, leave trip"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}