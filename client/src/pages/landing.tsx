import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, MapPin, Bell, Plane, Camera, Heart, Compass, Star } from "lucide-react";
import { HeroTravelMascot, TravelMascot, TravelDecorations } from "@/components/TravelMascot";

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
            Plan Your Perfect
            <span className="block bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
              Group Adventure
            </span>
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto mb-8 drop-shadow-md">
            Collaborate with friends to discover amazing destinations, vote on exciting activities, 
            and create unforgettable memories together with personalized travel calendars.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg"
              onClick={() => window.location.href = '/api/login'}
              className="sunset-gradient hover:opacity-90 text-white text-lg px-8 py-4 font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105"
            >
              <Plane className="mr-2 w-5 h-5" />
              Start Your Journey
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
              See Preview Below
            </Button>
            <div className="flex items-center space-x-4 text-white/80 text-sm">
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-300" />
                <span>Free to use</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4 text-green-300" />
                <span>Group friendly</span>
              </div>
              <div className="flex items-center space-x-1">
                <Compass className="w-4 h-4 text-blue-300" />
                <span>Enhanced Graphics</span>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced UI Preview Section */}
        <div id="preview-section" className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">
              Beautiful Travel-Themed Interface
            </h2>
            <p className="text-lg text-white/80 max-w-2xl mx-auto drop-shadow-md">
              Experience our enhanced UI with animated airplane icons, gradient backgrounds, and professional travel graphics
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
                    <h3 className="text-lg font-bold text-gray-800">Flight Search & Booking</h3>
                    <p className="text-gray-700 text-sm">Animated airplane icons and travel patterns</p>
                  </div>
                  <div className="flex gap-2 ml-auto">
                    <MapPin className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-gray-400">→</span>
                    <Plane className="h-4 w-4 text-green-500" />
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border border-blue-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Sample Flight Price:</span>
                    <span className="text-xl font-bold text-green-600">$458</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">With beautiful graphics & animations</div>
                </div>
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
                    <h3 className="text-lg font-bold text-gray-800">Hotel Search & Booking</h3>
                    <p className="text-gray-700 text-sm">Travel patterns and building icons</p>
                  </div>
                  <div className="flex gap-2 ml-auto">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-gray-400">→</span>
                    <Heart className="h-4 w-4 text-green-500" />
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border border-green-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Sample Hotel Price:</span>
                    <span className="text-xl font-bold text-green-600">$125/night</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Enhanced with travel graphics</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Demo Features */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white mb-4 drop-shadow-lg">
              Interactive Features Preview
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Animated Loading Demo */}
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardContent className="p-6 text-center">
                  <div className="airplane-animate mb-4">
                    <Plane className="h-12 w-12 text-blue-400 mx-auto" />
                  </div>
                  <h4 className="text-white font-semibold mb-2">Animated Icons</h4>
                  <p className="text-white/70 text-sm">Beautiful airplane animations throughout the interface</p>
                </CardContent>
              </Card>
              
              {/* Gradient Backgrounds Demo */}
              <Card className="bg-gradient-to-br from-blue-500/20 to-green-500/20 border-white/20">
                <CardContent className="p-6 text-center">
                  <div className="mb-4">
                    <MapPin className="h-12 w-12 text-green-400 mx-auto" />
                  </div>
                  <h4 className="text-white font-semibold mb-2">Gradient Backgrounds</h4>
                  <p className="text-white/70 text-sm">Professional travel-themed color schemes</p>
                </CardContent>
              </Card>
              
              {/* Travel Patterns Demo */}
              <Card className="airplane-pattern bg-white/10 border-white/20">
                <CardContent className="p-6 text-center">
                  <div className="mb-4">
                    <Compass className="h-12 w-12 text-orange-400 mx-auto" />
                  </div>
                  <h4 className="text-white font-semibold mb-2">Travel Patterns</h4>
                  <p className="text-white/70 text-sm">Subtle background patterns add professional touch</p>
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
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">Shared Calendar</h3>
              <p className="text-neutral-600 text-sm">
                Everyone can propose activities and see what's planned for each day
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="text-secondary w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">Accept & Decline</h3>
              <p className="text-neutral-600 text-sm">
                Vote on activities you want to join and see real-time participant counts
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <MapPin className="text-purple-600 w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">Personal Schedule</h3>
              <p className="text-neutral-600 text-sm">
                Your personalized calendar shows only activities you've accepted
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Bell className="text-yellow-600 w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">Smart Reminders</h3>
              <p className="text-neutral-600 text-sm">
                Get notifications before activities so you never miss what matters
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Demo Preview */}
        <div className="relative">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
            <div className="bg-gradient-to-r from-primary to-secondary px-6 py-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Calendar className="text-white w-4 h-4" />
                </div>
                <span className="text-white font-semibold">Japan Adventure 2025</span>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-7 gap-1 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-neutral-600 py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }, (_, i) => (
                  <div key={i} className="aspect-square bg-gray-50 rounded border flex items-center justify-center text-sm">
                    {i < 10 ? '' : i - 9}
                    {i === 20 && (
                      <div className="absolute bg-primary text-white text-xs px-1 py-0.5 rounded mt-4">
                        🍜 Ramen
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
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
