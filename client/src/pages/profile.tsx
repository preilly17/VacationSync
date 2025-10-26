import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useAuth } from "@/hooks/useAuth";
import { NotificationsSection } from "@/components/notifications-section";
import { Smartphone, Settings, MapPin, Plane, PlayCircle, ArrowLeft, Search, Loader2, LogOut } from "lucide-react";
import { useState, useEffect, useMemo, type KeyboardEvent } from "react";
import { Link, useLocation } from "wouter";
import LocationUtils from "@/lib/locationUtils";

type RawLocationResult = Awaited<ReturnType<typeof LocationUtils.searchLocations>> extends Array<infer U> ? U : never;

type ProfileLocationOption = RawLocationResult & {
  formatted: string;
  countryName: string;
  locationCode: string;
};

const regionDisplayNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const getCountryName = (location: RawLocationResult): string => {
  if (location.countryCode) {
    const upper = location.countryCode.toUpperCase();
    const resolved = regionDisplayNames?.of(upper);
    return resolved ?? upper;
  }

  const match = location.displayName?.match(/\(([^)]+)\)/);
  return match ? match[1] : "";
};

const getLocationCode = (location: RawLocationResult): string => {
  if (location.type === "AIRPORT") {
    return location.iataCode ?? location.cityCode ?? "";
  }

  if (location.type === "CITY") {
    return location.cityCode ?? location.iataCode ?? "";
  }

  return location.iataCode ?? "";
};

const buildLocationDisplay = (location: RawLocationResult): string => {
  const country = getCountryName(location);
  const descriptorParts: string[] = [];

  if (location.type === "AIRPORT") {
    if (location.name) {
      descriptorParts.push(location.name);
    }

    if (location.cityCode) {
      descriptorParts.push(location.cityCode);
    }

    if (country) {
      descriptorParts.push(country);
    }
  } else {
    if (location.name) {
      descriptorParts.push(location.name);
    }

    if (location.region && !descriptorParts.includes(location.region)) {
      descriptorParts.push(location.region);
    }

    if (country && !descriptorParts.includes(country)) {
      descriptorParts.push(country);
    }
  }

  const mainLabel = descriptorParts.filter(Boolean).join(", ");
  const fallbackLabel = mainLabel || location.displayName || location.name || country || "";
  const code = getLocationCode(location);

  return code ? `${fallbackLabel} — ${code}` : fallbackLabel;
};

const formatLocationResult = (
  location: RawLocationResult,
  formatter: (location: RawLocationResult) => string = LocationUtils.formatLocation
): ProfileLocationOption => ({
  ...location,
  formatted: formatter(location),
  countryName: getCountryName(location),
  locationCode: getLocationCode(location),
});

const getTypeBadgeStyle = (type: ProfileLocationOption["type"]): string => {
  switch (type) {
    case "AIRPORT":
      return "bg-blue-100 text-blue-800";
    case "CITY":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getTypeLabel = (type: ProfileLocationOption["type"]): string => {
  switch (type) {
    case "AIRPORT":
      return "Airport";
    case "CITY":
      return "City";
    case "COUNTRY":
      return "Country";
    default:
      return type;
  }
};

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
  const [, setLocation] = useLocation();

  // Location search state
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<ProfileLocationOption[]>([]);
  const [showLocationResults, setShowLocationResults] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<ProfileLocationOption | null>(null);
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [highlightedResult, setHighlightedResult] = useState(-1);
  const [hasClearedLocation, setHasClearedLocation] = useState(false);
  const [pendingSubmitContext, setPendingSubmitContext] = useState<"profile" | "location" | null>(null);

  const hasExistingDefault = useMemo(
    () => Boolean(user?.defaultLocation || user?.defaultLocationCode),
    [user?.defaultLocation, user?.defaultLocationCode]
  );

  const handleLocationSelect = (location: ProfileLocationOption) => {
    const formattedName = location.displayName || location.formatted;
    const country = location.countryName || "";
    const cityName = location.type === "COUNTRY" ? "" : location.name ?? "";
    const locationCode = location.locationCode || "";

    setSelectedLocation(location);
    setLocationQuery(location.formatted);
    setShowLocationResults(false);
    setLocationResults([]);
    setIsSearchingLocations(false);
    setLocationError(null);
    setHasClearedLocation(false);
    setHighlightedResult(-1);

    form.setValue("defaultLocation", formattedName);
    form.setValue("defaultCity", cityName);
    form.setValue("defaultCountry", country);
    form.setValue("defaultLocationCode", locationCode);
  };

  // Debounced location search
  useEffect(() => {
    const trimmedQuery = locationQuery.trim();

    if (trimmedQuery.length < 2) {
      setLocationResults([]);
      setShowLocationResults(false);
      setIsSearchingLocations(false);
      setLocationError(null);
      setHighlightedResult(-1);
      return;
    }

    if (selectedLocation && trimmedQuery === selectedLocation.formatted.trim()) {
      return;
    }

    let isCancelled = false;
    setIsSearchingLocations(true);
    setLocationError(null);
    setShowLocationResults(true);
    setHighlightedResult(-1);

    const timer = setTimeout(async () => {
      try {
        const results = await LocationUtils.searchLocations({ query: trimmedQuery, limit: 8 });
        if (isCancelled) return;

        const filtered = results
          .filter((result): result is RawLocationResult => Boolean(result))
          .map((result) => formatLocationResult(result, buildLocationDisplay));

        setLocationResults(filtered);
        setShowLocationResults(true);
        setHighlightedResult(filtered.length > 0 ? 0 : -1);
      } catch (error) {
        if (!isCancelled) {
          console.error('Location search error:', error);
          setLocationResults([]);
          setShowLocationResults(true);
          setLocationError("Can't fetch places right now. Try again.");
        }
      } finally {
        if (!isCancelled) {
          setIsSearchingLocations(false);
        }
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [locationQuery, selectedLocation]);

  // Initialize location query from user data
  useEffect(() => {
    if (user?.defaultLocation) {
      setLocationQuery(user.defaultLocation);
      setHasClearedLocation(false);
    } else if (user?.defaultLocationCode) {
      setLocationQuery(user.defaultLocationCode);
      setHasClearedLocation(false);
    } else {
      setLocationQuery("");
      setHasClearedLocation(false);
    }

    setSelectedLocation(null);
    setLocationResults([]);
    setShowLocationResults(false);
    setLocationError(null);
    setHighlightedResult(-1);
  }, [user?.defaultLocation, user?.defaultLocationCode]);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      cashAppUsername: user?.cashAppUsername || "",
      venmoUsername: user?.venmoUsername || "",
      defaultLocation: user?.defaultLocation || "",
      defaultLocationCode: user?.defaultLocationCode || "",
      defaultCity: user?.defaultCity || "",
      defaultCountry: user?.defaultCountry || "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        cashAppUsername: user.cashAppUsername || "",
        venmoUsername: user.venmoUsername || "",
        defaultLocation: user.defaultLocation || "",
        defaultLocationCode: user.defaultLocationCode || "",
        defaultCity: user.defaultCity || "",
        defaultCountry: user.defaultCountry || "",
      });
    }
  }, [user, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      await apiRequest('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      const context = pendingSubmitContext;
      setPendingSubmitContext(null);

      if (context === "location") {
        const { defaultLocation, defaultLocationCode, defaultCity } = form.getValues();

        if (!defaultLocation && !defaultLocationCode) {
          toast({
            title: "Default location cleared",
            description: "We won't prefill departures until you set a new default.",
          });
        } else {
          const summary = defaultLocationCode
            ? `${defaultLocation || defaultCity || ""} (${defaultLocationCode})`
            : defaultLocation || defaultCity || "";

          toast({
            title: "Default location saved",
            description: summary ? `Default location saved: ${summary}` : "Your default location is saved.",
          });
        }
      } else {
        toast({
          title: "Profile updated",
          description: "Your payment app settings and location preferences have been saved.",
        });
      }
    },
    onError: (error) => {
      setPendingSubmitContext(null);
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (context: "profile" | "location") =>
    form.handleSubmit((data: ProfileFormData) => {
      setPendingSubmitContext(context);
      updateProfileMutation.mutate(data);
    });

  const handleClearLocation = () => {
    setLocationQuery("");
    setSelectedLocation(null);
    setLocationResults([]);
    setShowLocationResults(false);
    setLocationError(null);
    setHasClearedLocation(true);
    setHighlightedResult(-1);

    form.setValue("defaultLocation", "");
    form.setValue("defaultCity", "");
    form.setValue("defaultCountry", "");
    form.setValue("defaultLocationCode", "");
  };

  const queryMatchesSelection =
    selectedLocation && locationQuery.trim() === selectedLocation.formatted.trim();

  const hasValidSelection = Boolean(selectedLocation && queryMatchesSelection);

  const canUseExistingDefault =
    !selectedLocation &&
    !hasClearedLocation &&
    locationQuery.trim().length === 0 &&
    hasExistingDefault;

  const isLocationSaveDisabled =
    updateProfileMutation.isPending || !(hasValidSelection || hasClearedLocation || canUseExistingDefault);

  const handleLocationKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!showLocationResults && locationResults.length > 0) {
        setShowLocationResults(true);
        setHighlightedResult(0);
        return;
      }

      if (locationResults.length === 0) {
        return;
      }

      setHighlightedResult((prev) => {
        const next = prev + 1;
        return next >= locationResults.length ? 0 : next;
      });
    } else if (event.key === "ArrowUp") {
      if (locationResults.length === 0) {
        return;
      }

      event.preventDefault();
      setHighlightedResult((prev) => {
        if (prev <= 0) {
          return locationResults.length - 1;
        }
        return prev - 1;
      });
    } else if (event.key === "Enter") {
      if (highlightedResult >= 0 && locationResults[highlightedResult]) {
        event.preventDefault();
        handleLocationSelect(locationResults[highlightedResult]);
      }
    } else if (event.key === "Escape") {
      setShowLocationResults(false);
      setHighlightedResult(-1);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Failed to log out via API', error);
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      queryClient.clear();
      setLocation('/');
    }
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

      <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={user.profileImageUrl || undefined} />
            <AvatarFallback>
              {user.firstName?.[0] || user.email?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-gray-600">{user.email}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="flex items-center justify-center gap-2 w-full sm:w-auto"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          Log out of Profile
        </Button>
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
            <Link href="/how-it-works">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <PlayCircle className="w-4 h-4" />
                How it works
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={handleSubmit("profile")} className="space-y-6">
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
            <form onSubmit={handleSubmit("location")} className="space-y-6">
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
                            const value = e.target.value;
                            setLocationQuery(value);

                            if (value.length < 2) {
                              setShowLocationResults(false);
                            }

                            if (selectedLocation && value !== selectedLocation.formatted) {
                              setSelectedLocation(null);
                            }

                            if (hasClearedLocation) {
                              setHasClearedLocation(false);
                            }

                            setLocationError(null);
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowLocationResults(false), 200);
                          }}
                          onFocus={() => {
                            if (locationResults.length > 0 || locationError) {
                              setShowLocationResults(true);
                            }
                          }}
                          onKeyDown={handleLocationKeyDown}
                          placeholder="Search for your city, airport, or location..."
                          className="pl-10"
                        />
                      </div>

                      {(locationQuery || hasExistingDefault) && (
                        <div className="mt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={handleClearLocation}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Clear
                          </button>
                        </div>
                      )}

                      {showLocationResults && (
                        <div
                          className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
                          role="listbox"
                        >
                          {isSearchingLocations && (
                            <div className="flex items-center justify-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                              Searching for locations...
                            </div>
                          )}
                          {locationResults.map((location, index) => (
                            <div
                              key={`${location.id}-${location.locationCode || index}`}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                handleLocationSelect(location);
                              }}
                              className={`px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                                highlightedResult === index ? "bg-blue-50" : "hover:bg-gray-50"
                              }`}
                              role="option"
                              aria-selected={highlightedResult === index}
                            >
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                    <span>{location.formatted}</span>
                                    <Badge variant="outline" className={getTypeBadgeStyle(location.type)}>
                                      {getTypeLabel(location.type)}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {location.countryName || location.displayName}
                                    {location.countryName && location.region && ` • ${location.region}`}
                                  </div>
                                  {location.type === 'CITY' && location.locationCode && (
                                    <div className="text-xs text-blue-600 mt-1">
                                      Major airport code: {location.locationCode}
                                    </div>
                                  )}
                                  {location.type === 'AIRPORT' && location.cityCode && location.cityCode !== location.locationCode && (
                                    <div className="text-xs text-gray-400 mt-1">
                                      Serves city code {location.cityCode}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          {!isSearchingLocations && !locationError && locationResults.length === 0 && (
                            <div className="px-4 py-3 text-xs text-muted-foreground">
                              No results—try a city, country, or airport code.
                            </div>
                          )}
                          {locationError && (
                            <div className="px-4 py-3 text-xs text-red-600">
                              {locationError}
                            </div>
                          )}
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
                  disabled={isLocationSaveDisabled}
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
    </div>
  );
}