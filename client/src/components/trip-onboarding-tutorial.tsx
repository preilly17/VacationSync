import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, ChevronRight, ChevronLeft, Calendar, Users, Package, DollarSign, Plane, Hotel, Utensils, MapPin } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TripOnboardingProps {
  tripId: string;
  onComplete: () => void;
}

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string;
  icon: React.ComponentType<{ className?: string }>;
  position: "top" | "bottom" | "left" | "right";
}

const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Your Trip!",
    description: "Let's take a quick tour of how to plan your perfect vacation with your group.",
    target: "",
    icon: Calendar,
    position: "bottom"
  },
  {
    id: "navigation",
    title: "Trip Navigation",
    description: "Use these tabs to access different areas of your trip planning. Each section helps coordinate a different aspect of your vacation.",
    target: "[data-tutorial='trip-navigation']",
    icon: Calendar,
    position: "right"
  },
  {
    id: "calendar",
    title: "Group Calendar",
    description: "View all planned activities in one place. Click on any day to quickly add new activities for your group.",
    target: "[data-tutorial='group-calendar']",
    icon: Calendar,
    position: "top"
  },
  {
    id: "flights",
    title: "Flight Coordination",
    description: "Search and coordinate flights with your group. Compare prices and book together for the best deals.",
    target: "[data-tutorial='flights-tab']",
    icon: Plane,
    position: "right"
  },
  {
    id: "hotels",
    title: "Hotel Booking",
    description: "Find and book accommodations that work for everyone. Search by location, price, and amenities.",
    target: "[data-tutorial='hotels-tab']",
    icon: Hotel,
    position: "right"
  },
  {
    id: "activities",
    title: "Activity Discovery",
    description: "Search and discover authentic activities and experiences at your destination. Book tours, attractions, and adventures.",
    target: "[data-tutorial='activities-tab']",
    icon: MapPin,
    position: "right"
  },
  {
    id: "expenses",
    title: "Expense Splitting",
    description: "Track shared expenses and split costs fairly among group members. Never worry about who owes what again.",
    target: "[data-tutorial='expenses-tab']",
    icon: DollarSign,
    position: "right"
  },
  {
    id: "invite",
    title: "Invite Members",
    description: "Click here to invite friends and family to join your trip. They'll get access to all the planning tools.",
    target: "[data-tutorial='invite-button']",
    icon: Users,
    position: "bottom"
  },
  {
    id: "complete",
    title: "You're All Set!",
    description: "Start planning your amazing trip! You can restart this tour anytime from your profile settings.",
    target: "",
    icon: Calendar,
    position: "bottom"
  }
];

export function TripOnboardingTutorial({ tripId, onComplete }: TripOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Check if user has completed trip onboarding
    const hasCompletedTripOnboarding = localStorage.getItem(`trip-onboarding-completed-${tripId}`);
    if (!hasCompletedTripOnboarding) {
      // Small delay to ensure elements are rendered
      setTimeout(() => {
        setIsVisible(true);
      }, 1000);
    }
  }, [tripId]);

  useEffect(() => {
    if (isVisible && currentStep < tutorialSteps.length) {
      const step = tutorialSteps[currentStep];
      if (step.target) {
        const element = document.querySelector(step.target) as HTMLElement;
        setTargetElement(element);
        
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.style.position = "relative";
          element.style.zIndex = "1000";
          element.classList.add("tutorial-highlight");
        }
      } else {
        setTargetElement(null);
      }
    }

    return () => {
      // Clean up highlighting
      document.querySelectorAll(".tutorial-highlight").forEach(el => {
        el.classList.remove("tutorial-highlight");
        el.style.zIndex = "";
      });
    };
  }, [currentStep, isVisible]);

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTutorial();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTutorial = () => {
    completeTutorial();
  };

  const completeTutorial = async () => {
    try {
      await apiRequest('/api/onboarding/trip', { method: 'POST' });
      setIsVisible(false);
      onComplete();
    } catch (error) {
      console.error('Error completing trip onboarding:', error);
      // Still hide tutorial on error to avoid blocking user
      setIsVisible(false);
      onComplete();
    }
  };

  if (!isVisible) return null;

  const step = tutorialSteps[currentStep];
  const IconComponent = step.icon;

  const getTooltipPosition = () => {
    if (!targetElement) {
      return {
        position: "fixed" as const,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 1001
      };
    }

    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 200;

    let style: React.CSSProperties = {
      position: "fixed" as const,
      zIndex: 1001
    };

    switch (step.position) {
      case "top":
        style.bottom = window.innerHeight - rect.top + 10;
        style.left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "bottom":
        style.top = rect.bottom + 10;
        style.left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
        style.right = window.innerWidth - rect.left + 10;
        style.top = rect.top + rect.height / 2 - tooltipHeight / 2;
        break;
      case "right":
        style.left = rect.right + 10;
        style.top = rect.top + rect.height / 2 - tooltipHeight / 2;
        break;
    }

    // Keep tooltip in viewport
    if (style.left && style.left < 10) style.left = 10;
    if (style.left && style.left > window.innerWidth - tooltipWidth - 10) {
      style.left = window.innerWidth - tooltipWidth - 10;
    }
    if (style.top && style.top < 10) style.top = 10;
    if (style.top && style.top > window.innerHeight - tooltipHeight - 10) {
      style.top = window.innerHeight - tooltipHeight - 10;
    }

    return style;
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[999]" />
      
      {/* Tutorial Card */}
      <Card style={getTooltipPosition()} className="w-80 shadow-lg animate-in fade-in-0 zoom-in-95">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white">
                <IconComponent className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{step.title}</h3>
                <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                  <span>Step {currentStep + 1} of {tutorialSteps.length}</span>
                  <div className="flex space-x-1">
                    {tutorialSteps.map((_, index) => (
                      <div
                        key={index}
                        className={`w-1.5 h-1.5 rounded-full ${
                          index <= currentStep ? "bg-primary" : "bg-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={skipTutorial}
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            {step.description}
          </p>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center space-x-1"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Back</span>
            </Button>

            <div className="flex space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={skipTutorial}
                className="text-gray-500 hover:text-gray-700"
              >
                Skip Tour
              </Button>
              <Button
                size="sm"
                onClick={nextStep}
                className="bg-primary hover:bg-red-600 text-white flex items-center space-x-1"
              >
                <span>{currentStep === tutorialSteps.length - 1 ? "Finish" : "Next"}</span>
                {currentStep < tutorialSteps.length - 1 && <ChevronRight className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <style dangerouslySetInnerHTML={{
        __html: `
          .tutorial-highlight {
            animation: pulse-highlight 2s infinite;
            border-radius: 8px;
            box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.3);
          }

          @keyframes pulse-highlight {
            0%, 100% {
              box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.3);
            }
            50% {
              box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.2);
            }
          }
        `
      }} />
    </>
  );
}