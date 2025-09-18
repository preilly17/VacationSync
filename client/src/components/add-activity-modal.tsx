import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertActivitySchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface AddActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: number;
  selectedDate?: Date | null;
}

const formSchema = insertActivitySchema.extend({
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().optional(),
  cost: z.string().optional(),
  maxCapacity: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const categories = [
  { value: "food", label: "Food & Dining" },
  { value: "sightseeing", label: "Sightseeing" },
  { value: "transport", label: "Transportation" },
  { value: "entertainment", label: "Entertainment" },
  { value: "shopping", label: "Shopping" },
  { value: "culture", label: "Culture" },
  { value: "outdoor", label: "Outdoor" },
  { value: "other", label: "Other" },
];

export function AddActivityModal({ open, onOpenChange, tripId, selectedDate }: AddActivityModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getDefaultValues = () => ({
    name: "",
    description: "",
    startDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : "",
    startTime: "",
    endTime: "",
    location: "",
    cost: "",
    maxCapacity: "",
    category: "other",
    tripCalendarId: tripId,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(),
  });

  // Update form when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      form.setValue('startDate', format(selectedDate, 'yyyy-MM-dd'));
    } else {
      form.reset(getDefaultValues());
    }
  }, [selectedDate, form]);

  const createActivityMutation = useMutation({
    mutationFn: async (data: any) => {
      // Validate that we have both date and time
      if (!data.startDate || !data.startTime) {
        throw new Error("Start date and time are required");
      }

      // Combine date and time into ISO string
      const startDateTime = new Date(`${data.startDate}T${data.startTime}`);
      const endDateTime = data.endTime 
        ? new Date(`${data.startDate}T${data.endTime}`)
        : null;

      // Check if the date is valid
      if (isNaN(startDateTime.getTime())) {
        throw new Error("Invalid start date or time");
      }

      if (endDateTime && isNaN(endDateTime.getTime())) {
        throw new Error("Invalid end time");
      }

      const activityData = {
        ...data,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime?.toISOString() || null,
        cost: data.cost ? parseFloat(data.cost) : null,
        maxCapacity: data.maxCapacity ? parseInt(data.maxCapacity) : null,
      };

      await apiRequest(`/api/trips/${tripId}/activities`, {
        method: 'POST',
        body: JSON.stringify(activityData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId.toString(), "activities"] });
      toast({
        title: "Activity created!",
        description: "Your activity has been added to the trip calendar.",
      });
      onOpenChange(false);
      form.reset(getDefaultValues());
    },
    onError: (error) => {
      console.error("Activity creation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create activity. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    console.log('Form data:', data);
    console.log('Form errors:', form.formState.errors);
    createActivityMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Activity</DialogTitle>
          <DialogDescription>
            Create a new activity for your trip that members can accept or decline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Activity Name</Label>
            <Input
              id="name"
              placeholder="e.g., Tokyo Skytree Visit"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what you'll be doing..."
              rows={3}
              {...form.register("description")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startDate">Date</Label>
              <Input
                id="startDate"
                type="date"
                {...form.register("startDate")}
              />
              {form.formState.errors.startDate && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.startDate.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                {...form.register("startTime")}
              />
              {form.formState.errors.startTime && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.startTime.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="endTime">End Time (Optional)</Label>
            <Input
              id="endTime"
              type="time"
              {...form.register("endTime")}
            />
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="Address or landmark"
              {...form.register("location")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cost">Cost per Person</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...form.register("cost")}
              />
              {form.formState.errors.cost && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.cost.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="maxCapacity">Max Participants</Label>
              <Input
                id="maxCapacity"
                type="number"
                placeholder="No limit"
                {...form.register("maxCapacity")}
              />
              {form.formState.errors.maxCapacity && (
                <p className="text-sm text-red-600 mt-1">{form.formState.errors.maxCapacity.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select 
              value={form.watch("category")} 
              onValueChange={(value) => form.setValue("category", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {Object.keys(form.formState.errors).length > 0 && (
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-sm font-medium text-red-800 mb-2">Please fix these errors:</p>
              <ul className="text-sm text-red-600 space-y-1">
                {Object.entries(form.formState.errors).map(([field, error]) => (
                  <li key={field}>• {field}: {error?.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary hover:bg-red-600 text-white"
              disabled={createActivityMutation.isPending}
            >
              {createActivityMutation.isPending ? "Creating..." : "Create Activity"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
