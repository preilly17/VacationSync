import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { NotificationsSection } from "@/components/notifications-section";
import { OnboardingTutorial } from "@/components/onboarding-tutorial";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Smartphone, Settings, User as UserIcon, MapPin, Plane, PlayCircle, ArrowLeft, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";

const profileFormSchema = z.object({
  cashAppUsername: z.string().optional(),
  venmoUsername: z.string().optional(),
  defaultLocation: z.string().optional(),
  defaultLocationCode: z.string().optional(),
  defaultCity: z.string().optional(),
  defaultCountry: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function Profile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();
  const { resetOnboarding } = useOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Location search state
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [showLocationResults, setShowLocationResults] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  const handleStartTour = () => {
    resetOnboarding();
    setShowOnboarding(true);
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
  };

  // Location search functionality
  const searchLocations = async (query: string) => {
    if (query.length < 2) {
      setLocationResults([]);
      setShowLocationResults(false);
      return;
    }

    try {
      const response = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const results = await response.json();
        setLocationResults(results);
        setShowLocationResults(true);
      }
    } catch (error) {
      console.error('Location search error:', error);
    }
  };

  const handleLocationSelect = (location: any) => {
    setSelectedLocation(location);
    setLocationQuery(location.fullName);
    setShowLocationResults(false);
    
    // Auto-populate form fields with location data
    form.setValue('defaultLocation', location.fullName);
    form.setValue('defaultCity', location.city || location.name);
    form.setValue('defaultCountry', location.country);
    form.setValue('defaultLocationCode', location.airportCode || '');
  };

  // Debounced location search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (locationQuery) {
        searchLocations(locationQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [locationQuery]);

  // Initialize location query from user data
  useEffect(() => {
    if (user?.defaultLocation) {
      setLocationQuery(user.defaultLocation);
    }
  }, [user]);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      cashAppUsername: user?.cashAppUsername || '',
      venmoUsername: user?.venmoUsername || '',
      defaultLocation: user?.defaultLocation || '',
      defaultLocationCode: user?.defaultLocationCode || '',
      defaultCity: user?.defaultCity || '',
      defaultCountry: user?.defaultCountry || '',
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      await apiRequest('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile updated",
        description: "Your payment app settings and location preferences have been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Please log in</h2>
          <p className="text-gray-600">You need to be logged in to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {/* Back to Main Page Button */}
      <div className="mb-6">
        <Link href="/">
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Main Page
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <Avatar className="w-16 h-16">
          <AvatarImage src={user.profileImageUrl || undefined} />
          <AvatarFallback>
            {user.firstName?.[0] || user.email?.[0] || 'U'}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-gray-600">{user.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Profile Settings
              </CardTitle>
              <CardDescription>
                Configure your payment app usernames for easy expense splitting
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartTour}
              className="flex items-center gap-2"
            >
              <PlayCircle className="w-4 h-4" />
              Start Tour
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Payment Apps
                </h3>
                <p className="text-sm text-gray-600">
                  Adding your payment app usernames helps group members quickly send you money 
                  when splitting expenses.
                </p>
                
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="cashAppUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CashApp Username</FormLabel>
                        <FormControl>
                          <div className="flex items-center">
                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                              $
                            </span>
                            <Input
                              {...field}
                              placeholder="your-cashapp-username"
                              className="rounded-l-none"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="venmoUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Venmo Username</FormLabel>
                        <FormControl>
                          <div className="flex items-center">
                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                              @
                            </span>
                            <Input
                              {...field}
                              placeholder="your-venmo-username"
                              className="rounded-l-none"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {(user.cashAppUsername || user.venmoUsername) && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">Current Payment Methods:</h4>
                    <div className="flex gap-2">
                      {user.cashAppUsername && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <Smartphone className="w-3 h-3 mr-1" />
                          CashApp: ${user.cashAppUsername}
                        </Badge>
                      )}
                      {user.venmoUsername && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <Smartphone className="w-3 h-3 mr-1" />
                          Venmo: @{user.venmoUsername}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={updateProfileMutation.isPending}
                  className="min-w-32"
                >
                  {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Location Management Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Default Location Settings
          </CardTitle>
          <CardDescription>
            Set your default departure location for flight searches and group coordination
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                    <Plane className="w-4 h-4" />
                    How this helps
                  </h4>
                  <p className="text-sm text-blue-700">
                    When you join new trips, your location will be automatically used for flight searches. 
                    You can also update this per trip if needed.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Search Your Location</Label>
                    <div className="relative">
                      <div className="flex">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          value={locationQuery}
                          onChange={(e) => {
                            setLocationQuery(e.target.value);
                            if (e.target.value.length < 2) {
                              setShowLocationResults(false);
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowLocationResults(false), 200);
                          }}
                          onFocus={() => {
                            if (locationResults.length > 0) {
                              setShowLocationResults(true);
                            }
                          }}
                          placeholder="Search for your city, airport, or location..."
                          className="pl-10"
                        />
                      </div>
                      
                      {showLocationResults && locationResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                          {locationResults.map((location, index) => (
                            <div
                              key={index}
                              onClick={() => handleLocationSelect(location)}
                              className="px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <div className="flex-1">
                                  <div className="font-medium text-sm">{location.name}</div>
                                  <div className="text-xs text-gray-500">{location.fullName}</div>
                                  <div className="text-xs text-gray-400">{location.country}</div>
                                </div>
                                {location.airportCode && (
                                  <div className="flex items-center gap-1">
                                    <Plane className="w-3 h-3 text-blue-500" />
                                    <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1 py-0.5 rounded">
                                      {location.airportCode}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Start typing to search for your departure location. This will be used for flight and hotel searches.
                    </p>
                  </div>
                </div>

                {(user?.defaultLocation || user?.defaultCity) && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-green-600" />
                      <h4 className="font-medium text-green-800">Current Default Location</h4>
                      {user.defaultLocationCode && (
                        <div className="flex items-center gap-1">
                          <Plane className="w-3 h-3 text-green-600" />
                          <span className="text-xs font-mono text-green-700 bg-green-100 px-1 py-0.5 rounded">
                            {user.defaultLocationCode}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-green-700">
                      <p>{user?.defaultLocation || `${user?.defaultCity}, ${user?.defaultCountry}`}</p>
                      {user.defaultCity && user.defaultCountry && (
                        <p className="text-xs opacity-75">{user.defaultCity}, {user.defaultCountry}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={updateProfileMutation.isPending}
                  className="min-w-32"
                >
                  {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <NotificationsSection />
      
      {showOnboarding && (
        <OnboardingTutorial
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}
    </div>
  );
}