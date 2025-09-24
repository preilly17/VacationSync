import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { TravelLoading } from "@/components/LoadingSpinners";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Home from "@/pages/home";
import Trip from "@/pages/trip";
import MemberSchedule from "@/pages/member-schedule";
import Join from "@/pages/join";
import Profile from "@/pages/profile";
import Flights from "@/pages/flights";
import Hotels from "@/pages/hotels";
import Activities from "@/pages/activities";
import Restaurants from "@/pages/restaurants";
import Proposals, { ProposalsRoute } from "@/pages/proposals";
import AmadeusTest from "@/pages/amadeus-test";
import LocationDatabase from "@/pages/location-database";
import CurrencyConverter from "@/pages/currency-converter";
import Logout from "@/pages/logout";
import HowItWorks from "@/pages/how-it-works";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  console.log("Router state:", { isAuthenticated, isLoading, location });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <TravelLoading size="lg" text="Welcome to your travel planning adventure..." />
      </div>
    );
  }

  // Development bypass - allow access to enhanced interface
  const isDevelopment = import.meta.env.DEV;

  if (!isAuthenticated && !isDevelopment) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/join/:shareCode" component={Join} />
        <Route path="/api/logout" component={Logout} />
        <Route path="/amadeus-test" component={AmadeusTest} />
        <Route path="/location-database" component={LocationDatabase} />
        <Route path="/how-it-works" component={HowItWorks} />
        <Route path="/" component={Landing} />
        <Route path="*" component={Landing} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/trip/:id" component={Trip} />
      <Route path="/trip/:tripId/members" component={MemberSchedule} />
      <Route path="/trip/:tripId/flights" component={Flights} />
      <Route path="/trips/:tripId/flights" component={Flights} />
      <Route path="/trip/:tripId/hotels" component={Hotels} />
      <Route path="/trips/:tripId/hotels" component={Hotels} />
      <Route path="/trip/:tripId/activities" component={Activities} />
      <Route path="/trips/:tripId/activities" component={Activities} />
      <Route path="/trip/:tripId/restaurants" component={Restaurants} />
      <Route path="/trips/:tripId/restaurants" component={Restaurants} />
      <Route path="/trip/:tripId/proposals" component={ProposalsRoute} />
      <Route path="/trips/:tripId/proposals" component={ProposalsRoute} />
      <Route path="/flights" component={Flights} />
      <Route path="/restaurants" component={Restaurants} />
      <Route path="/hotels" component={Hotels} />
      <Route path="/join/:shareCode" component={Join} />
      <Route path="/profile" component={Profile} />
      <Route path="/currency-converter" component={CurrencyConverter} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/amadeus-test" component={AmadeusTest} />
      <Route path="/location-database" component={LocationDatabase} />
      <Route path="/api/logout" component={Logout} />
      <Route path="*" component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
