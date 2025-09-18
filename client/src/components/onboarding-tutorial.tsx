import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Users, 
  Calendar, 
  Plus, 
  MapPin, 
  DollarSign, 
  Package,
  CheckCircle,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  target?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  action?: string;
  highlight?: boolean;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to TripSync!',
    description: 'Plan amazing group trips with collaborative tools. Let\'s walk through the key features.',
    icon: Star,
    highlight: true
  },
  {
    id: 'create-trip',
    title: 'Create Your First Trip',
    description: 'Start by creating a new trip calendar. Add destination, dates, and invite your travel companions.',
    icon: Plus,
    target: '[data-onboarding="create-trip"]',
    placement: 'bottom',
    action: 'Click "Create Trip" to get started'
  },
  {
    id: 'invite-members',
    title: 'Invite Your Travel Group',
    description: 'Share your trip with friends using the invite link. Everyone can join and contribute to planning.',
    icon: Users,
    target: '[data-onboarding="invite-button"]',
    placement: 'bottom',
    action: 'Use the "Invite Members" button to share your trip'
  },
  {
    id: 'add-activities',
    title: 'Plan Activities Together',
    description: 'Propose activities, restaurants, and experiences. Group members can accept or decline proposals.',
    icon: Calendar,
    target: '[data-onboarding="add-activity"]',
    placement: 'bottom',
    action: 'Click "Add Activity" to propose something fun'
  },
  {
    id: 'discover-places',
    title: 'Discover Local Experiences',
    description: 'Search for activities, restaurants, and hotels in your destination with real-time availability.',
    icon: MapPin,
    target: '[data-onboarding="discover-tabs"]',
    placement: 'top',
    action: 'Explore the Activities, Restaurants, and Hotels tabs'
  },
  {
    id: 'track-expenses',
    title: 'Split Expenses Fairly',
    description: 'Track shared costs and split expenses among group members with integrated payment apps.',
    icon: DollarSign,
    target: '[data-onboarding="expenses-tab"]',
    placement: 'top',
    action: 'Use the Expenses tab to manage group spending'
  },
  {
    id: 'packing-lists',
    title: 'Coordinate Packing',
    description: 'Create shared packing lists and coordinate who brings what to avoid duplicates.',
    icon: Package,
    target: '[data-onboarding="packing-tab"]',
    placement: 'top',
    action: 'Check out the Packing tab for group coordination'
  },
  {
    id: 'personal-schedule',
    title: 'Your Personal Schedule',
    description: 'View only activities you\'ve accepted in your personalized calendar view.',
    icon: CheckCircle,
    target: '[data-onboarding="personal-schedule"]',
    placement: 'top',
    action: 'Switch to "Personal Schedule" to see your confirmed activities'
  }
];

interface OnboardingTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingTutorial({ onComplete, onSkip }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  const step = onboardingSteps[currentStep];
  const progress = ((currentStep + 1) / onboardingSteps.length) * 100;

  useEffect(() => {
    if (step.target) {
      const element = document.querySelector(step.target) as HTMLElement;
      setTargetElement(element);
      
      if (element) {
        element.style.position = 'relative';
        element.style.zIndex = '1001';
        element.classList.add('onboarding-highlight');
      }
    }

    return () => {
      if (targetElement) {
        targetElement.style.position = '';
        targetElement.style.zIndex = '';
        targetElement.classList.remove('onboarding-highlight');
      }
    };
  }, [currentStep, step.target]);

  const nextStep = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    if (targetElement) {
      targetElement.style.position = '';
      targetElement.style.zIndex = '';
      targetElement.classList.remove('onboarding-highlight');
    }
    onComplete();
  };

  const handleSkip = () => {
    setIsVisible(false);
    if (targetElement) {
      targetElement.style.position = '';
      targetElement.style.zIndex = '';
      targetElement.classList.remove('onboarding-highlight');
    }
    onSkip();
  };

  if (!isVisible) return null;

  const getTooltipPosition = () => {
    if (!targetElement || !step.target) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    
    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    
    switch (step.placement) {
      case 'top':
        return {
          top: rect.top - tooltipHeight - 20,
          left: rect.left + (rect.width / 2) - (tooltipWidth / 2),
        };
      case 'bottom':
        return {
          top: rect.bottom + 20,
          left: rect.left + (rect.width / 2) - (tooltipWidth / 2),
        };
      case 'left':
        return {
          top: rect.top + (rect.height / 2) - (tooltipHeight / 2),
          left: rect.left - tooltipWidth - 20,
        };
      case 'right':
        return {
          top: rect.top + (rect.height / 2) - (tooltipHeight / 2),
          left: rect.right + 20,
        };
      default:
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-1000" />
      
      {/* Tutorial Card */}
      <Card 
        className={cn(
          "fixed z-1001 w-80 shadow-2xl border-2",
          step.highlight ? "border-primary" : "border-gray-200"
        )}
        style={step.target ? getTooltipPosition() : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                step.highlight ? "bg-primary text-white" : "bg-gray-100"
              )}>
                <step.icon className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-lg">{step.title}</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {currentStep + 1} of {onboardingSteps.length}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <Progress value={progress} className="mt-2" />
        </CardHeader>
        
        <CardContent className="space-y-4">
          <CardDescription className="text-sm leading-relaxed">
            {step.description}
          </CardDescription>
          
          {step.action && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700 font-medium">
                💡 {step.action}
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </Button>
            
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-gray-500"
              >
                Skip Tour
              </Button>
              
              <Button
                onClick={nextStep}
                size="sm"
                className="flex items-center gap-2"
              >
                {currentStep === onboardingSteps.length - 1 ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Finish
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}