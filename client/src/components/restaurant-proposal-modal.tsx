import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertRestaurantProposalSchema } from "@shared/schema";
import { useState } from "react";
import { format } from "date-fns";
import { 
  CalendarIcon, 
  Clock, 
  MapPin, 
  Star, 
  DollarSign, 
  ChefHat,
  Users,
  MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RestaurantProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurant: any;
  tripId: number;
}

const formSchema = insertRestaurantProposalSchema.omit({ 
  tripId: true,
  proposedBy: true,
  status: true,
  averageRanking: true,
  createdAt: true
}).extend({
  preferredDate: z.date({
    required_error: "Please select a preferred date for dining",
  }),
});

type FormData = z.infer<typeof formSchema>;

const mealTimes = [
  { value: 'breakfast', label: 'Breakfast', time: '8:00 AM - 11:00 AM' },
  { value: 'brunch', label: 'Brunch', time: '10:00 AM - 2:00 PM' },
  { value: 'lunch', label: 'Lunch', time: '12:00 PM - 3:00 PM' },
  { value: 'dinner', label: 'Dinner', time: '6:00 PM - 10:00 PM' },
  { value: 'late_night', label: 'Late Night', time: '10:00 PM - 2:00 AM' },
];

export function RestaurantProposalModal({ 
  open, 
  onOpenChange, 
  restaurant, 
  tripId 
}: RestaurantProposalModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      restaurantName: restaurant?.name || '',
      address: restaurant?.address || '',
      cuisineType: restaurant?.cuisine || restaurant?.cuisineType || '',
      priceRange: restaurant?.priceRange || '$$',
      rating: restaurant?.rating || 4.0,
      phoneNumber: restaurant?.phone || restaurant?.phoneNumber || '',
      website: restaurant?.website || '',
      reservationUrl: restaurant?.reservationUrl || '',
      platform: restaurant?.platform || 'Foursquare',
      preferredMealTime: 'dinner',
      preferredDates: [],
    },
  });

  const createProposalMutation = useMutation({
    mutationFn: (data: FormData) => {
      const proposalData = {
        ...data,
        tripId,
        preferredDates: selectedDate ? [format(selectedDate, 'yyyy-MM-dd')] : [],
        rating: data.rating?.toString() || '4.0',
      };
      return apiRequest(`/api/trips/${tripId}/restaurant-proposals`, {
        method: "POST",
        body: proposalData,
      });
    },
    onSuccess: () => {
      toast({
        title: "Restaurant Proposed",
        description: `${restaurant.name} has been proposed to your group for voting.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "restaurant-proposals"] });
      onOpenChange(false);
      form.reset();
      setSelectedDate(undefined);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to propose restaurant. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (!selectedDate) {
      toast({
        title: "Date Required",
        description: "Please select a preferred date for dining.",
        variant: "destructive",
      });
      return;
    }
    createProposalMutation.mutate({ ...data, preferredDate: selectedDate });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Propose Restaurant to Group
          </DialogTitle>
        </DialogHeader>

        {/* Restaurant Preview */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ChefHat className="h-5 w-5" />
              {restaurant?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{restaurant?.cuisine || restaurant?.cuisineType}</Badge>
                <span className="text-gray-600">{restaurant?.priceRange}</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span>{restaurant?.rating}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              {restaurant?.address}
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Date Selection */}
            <div className="space-y-2">
              <FormLabel className="text-base font-medium">
                Preferred Dining Date *
              </FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                    data-testid="button-select-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Meal Time Selection */}
            <FormField
              control={form.control}
              name="preferredMealTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-medium">Meal Time</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-meal-time">
                        <SelectValue placeholder="Select meal time" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {mealTimes.map((meal) => (
                        <SelectItem key={meal.value} value={meal.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{meal.label}</span>
                            <span className="text-xs text-gray-500">{meal.time}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />


            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel-proposal"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createProposalMutation.isPending}
                className="flex-1"
                data-testid="button-submit-proposal"
              >
                {createProposalMutation.isPending ? (
                  "Proposing..."
                ) : (
                  "Propose to Group"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}