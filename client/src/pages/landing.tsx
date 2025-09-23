import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, MapPin, Bell, Plane, Camera, Compass, Star } from "lucide-react";
import { HeroTravelMascot, TravelDecorations } from "@/components/TravelMascot";

export default function Landing() {
  return (
    <div className="min-h-screen animated-gradient relative overflow-hidden">
      <TravelDecorations />
      
      {/* Navigation */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-gray-200/30 px-4 lg:px-8 py-4 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 travel-gradient rounded-lg flex items-center justify-center">
              <Plane className="text-white w-5 h-5" />
            </div>
            <span className="text-2xl font-bold text-gray-900">TripSync</span>
          </div>
          <Button 
            onClick={() => window.location.href = '/register'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 transition-colors"
          >
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 lg:py-24 relative z-10">
        <div className="text-center mb-16">
          <div className="mb-8">
            <HeroTravelMascot />
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold text-white mb-6 drop-shadow-lg">
            Plan group travel
            <span className="block bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
              without the group chat chaos
            </span>
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto mb-8 drop-shadow-md">
            TripSync keeps destination ideas, RSVPs, and schedules in one shared workspace so your
            crew can make decisions faster and book with confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              onClick={() => (window.location.href = "/login")}
              className="sunset-gradient hover:opacity-90 text-white text-lg px-8 py-4 font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105"
            >
              <Plane className="mr-2 w-5 h-5" />
              Create your trip
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={() => {
                document.getElementById('preview-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-white/10 border-white/30 text-white hover:bg-white/20 text-lg px-8 py-4 font-semibold backdrop-blur-sm"
            >
              <Camera className="mr-2 w-5 h-5" />
              See how TripSync works
            </Button>
            <div className="flex items-center space-x-4 text-white/80 text-sm">
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-300" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4 text-green-300" />
                <span>Built for group decisions</span>
              </div>
              <div className="flex items-center space-x-1">
                <Compass className="w-4 h-4 text-blue-300" />
                <span>Keeps everyone on schedule</span>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced UI Preview Section */}
        <div id="preview-section" className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">
              Everything you need to plan together
            </h2>
            <p className="text-lg text-white/80 max-w-2xl mx-auto drop-shadow-md">
              TripSync brings planning, voting, and scheduling into one place so no one has to chase down answers.
            </p>
          </div>

          {/* UI Preview Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Flight Interface Preview */}
            <Card className="overflow-hidden shadow-2xl flight-card-gradient border-0">
              <div className="search-header-gradient p-4">
                <div className="flex items-center gap-3">
                  <div className="airplane-animate">
                    <Plane className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Collect options in one place</h3>
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <p className="text-gray-700 text-sm">
                  Share flight, hotel, and activity ideas with full details so everyone is looking at the same information.
                </p>
              </CardContent>
            </Card>

            {/* Hotel Interface Preview */}
            <Card className="overflow-hidden shadow-2xl hotel-card-gradient border-0 airplane-pattern">
              <div className="search-header-gradient p-4">
                <div className="flex items-center gap-3">
                  <div className="airplane-animate">
                    <MapPin className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Decide with confidence</h3>
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <p className="text-gray-700 text-sm">
                  Rank proposals, see the group's favorites, and confirm the plans your travelers are excited about.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Demo Features */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white mb-4 drop-shadow-lg">
              What your group gains
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Animated Loading Demo */}
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardContent className="p-6 text-center">
                  <div className="airplane-animate mb-4">
                    <Plane className="h-12 w-12 text-blue-400 mx-auto" />
                  </div>
                  <h4 className="text-white font-semibold mb-2">Decisions everyone can follow</h4>
                  <p className="text-white/70 text-sm">Use built-in polls and rankings to surface the top choice without endless message threads.</p>
                </CardContent>
              </Card>

              {/* Gradient Backgrounds Demo */}
              <Card className="bg-gradient-to-br from-blue-500/20 to-green-500/20 border-white/20">
                <CardContent className="p-6 text-center">
                  <div className="mb-4">
                    <MapPin className="h-12 w-12 text-green-400 mx-auto" />
                  </div>
                  <h4 className="text-white font-semibold mb-2">Real-time RSVPs</h4>
                  <p className="text-white/70 text-sm">See who’s in, who’s out, and what still needs attention at a glance.</p>
                </CardContent>
              </Card>

              {/* Travel Patterns Demo */}
              <Card className="airplane-pattern bg-white/10 border-white/20">
                <CardContent className="p-6 text-center">
                  <div className="mb-4">
                    <Compass className="h-12 w-12 text-orange-400 mx-auto" />
                  </div>
                  <h4 className="text-white font-semibold mb-2">Automatic reminders</h4>
                  <p className="text-white/70 text-sm">TripSync pings the group before every booking and meetup so nothing slips through the cracks.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="text-primary w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">Shared trip hub</h3>
              <p className="text-neutral-600 text-sm">
                Organize every proposal, note, and reservation in a collaborative calendar for the whole group.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="text-secondary w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">Group decision tools</h3>
              <p className="text-neutral-600 text-sm">
                Invite travelers to vote on options and watch participation numbers update instantly.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <MapPin className="text-purple-600 w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">Personal itineraries</h3>
              <p className="text-neutral-600 text-sm">
                Each member's calendar highlights only the activities they've accepted, complete with times and details.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Bell className="text-yellow-600 w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">Smart reminders</h3>
              <p className="text-neutral-600 text-sm">
                Automatic notifications keep deadlines, RSVPs, and meeting points front and center.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Closing CTA */}
        <div className="relative">
          <div className="bg-white/10 border border-white/20 rounded-3xl p-10 text-center shadow-2xl backdrop-blur-sm">
            <h3 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">Ready to plan smarter?</h3>
            <p className="text-white/80 max-w-2xl mx-auto mb-6">
              Join TripSync today and turn planning time into excitement for the trip ahead.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                onClick={() => (window.location.href = "/register")}
                className="sunset-gradient hover:opacity-90 text-white text-lg px-8 py-4 font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105"
              >
                Get started free
              </Button>
            </div>
            <p className="text-white/70 text-sm mt-4">Invite your crew in minutes—cancel anytime.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Calendar className="text-white w-4 h-4" />
            </div>
            <span className="text-lg font-semibold text-neutral-900">TripSync</span>
          </div>
          <p className="text-neutral-600">
            The collaborative way to plan your next adventure
          </p>
        </div>
      </footer>
    </div>
  );
}
