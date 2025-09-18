import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { 
  Lightbulb, 
  ChevronDown, 
  ChevronUp, 
  Package, 
  Globe, 
  Car, 
  Cloud, 
  Utensils, 
  Shield, 
  DollarSign, 
  MessageCircle, 
  Heart, 
  FileText, 
  Camera,
  X,
  Info,
  Star
} from "lucide-react";
import { TravelLoading } from "@/components/LoadingSpinners";

interface TravelTip {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  destinations: string[];
  activityTypes: string[];
  priority: number;
  isGeneral: boolean;
  relevanceScore?: number;
  matchingReasons?: string[];
}

interface TravelTipsProps {
  tripId: number;
  destination?: string;
}

// Category icons and colors mapping
const categoryConfig = {
  packing: {
    icon: Package,
    label: "Packing",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    bgColor: "bg-blue-50 dark:bg-blue-950"
  },
  local_customs: {
    icon: Globe,
    label: "Local Customs",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    bgColor: "bg-purple-50 dark:bg-purple-950"
  },
  transportation: {
    icon: Car,
    label: "Transportation",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    bgColor: "bg-green-50 dark:bg-green-950"
  },
  weather: {
    icon: Cloud,
    label: "Weather",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    bgColor: "bg-orange-50 dark:bg-orange-950"
  },
  dining: {
    icon: Utensils,
    label: "Dining",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    bgColor: "bg-red-50 dark:bg-red-950"
  },
  safety: {
    icon: Shield,
    label: "Safety",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    bgColor: "bg-yellow-50 dark:bg-yellow-950"
  },
  money: {
    icon: DollarSign,
    label: "Money",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    bgColor: "bg-emerald-50 dark:bg-emerald-950"
  },
  communication: {
    icon: MessageCircle,
    label: "Communication",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
    bgColor: "bg-indigo-50 dark:bg-indigo-950"
  },
  health: {
    icon: Heart,
    label: "Health",
    color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    bgColor: "bg-pink-50 dark:bg-pink-950"
  },
  documents: {
    icon: FileText,
    label: "Documents",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    bgColor: "bg-gray-50 dark:bg-gray-950"
  },
  activities: {
    icon: Camera,
    label: "Activities",
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
    bgColor: "bg-cyan-50 dark:bg-cyan-950"
  },
  accommodation: {
    icon: Camera,
    label: "Accommodation",
    color: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
    bgColor: "bg-violet-50 dark:bg-violet-950"
  }
};

export function TravelTips({ tripId, destination }: TravelTipsProps) {
  const { toast } = useToast();
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Fetch travel tips for the trip
  const { data: tips = [], isLoading, error } = useQuery<TravelTip[]>({
    queryKey: [`/api/trips/${tripId}/travel-tips`],
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Filter out dismissed tips
  const visibleTips = tips.filter(tip => !dismissedTips.has(tip.id));

  // Group tips by category
  const tipsByCategory = visibleTips.reduce((acc, tip) => {
    if (!acc[tip.category]) {
      acc[tip.category] = [];
    }
    acc[tip.category].push(tip);
    return acc;
  }, {} as Record<string, TravelTip[]>);

  // Sort categories by priority (most important tips first)
  const sortedCategories = Object.entries(tipsByCategory).sort(([, tipsA], [, tipsB]) => {
    const avgPriorityA = tipsA.reduce((sum, tip) => sum + tip.priority, 0) / tipsA.length;
    const avgPriorityB = tipsB.reduce((sum, tip) => sum + tip.priority, 0) / tipsB.length;
    return avgPriorityB - avgPriorityA;
  });

  const handleDismissTip = (tipId: string) => {
    setDismissedTips(prev => new Set([...Array.from(prev), tipId]));
    toast({
      title: "Tip dismissed",
      description: "The tip has been hidden from your list.",
    });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newExpanded = new Set(Array.from(prev));
      if (newExpanded.has(category)) {
        newExpanded.delete(category);
      } else {
        newExpanded.add(category);
      }
      return newExpanded;
    });
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 5) return "text-red-600 dark:text-red-400";
    if (priority >= 4) return "text-orange-600 dark:text-orange-400";
    if (priority >= 3) return "text-yellow-600 dark:text-yellow-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getPriorityStars = (priority: number) => {
    return Array.from({ length: Math.min(priority, 5) }, (_, i) => (
      <Star key={i} className={`w-3 h-3 fill-current ${getPriorityColor(priority)}`} />
    ));
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="travel-tips-loading">
        <TravelLoading variant="journey" size="md" text="Loading personalized travel tips..." />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="w-full" data-testid="travel-tips-error">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center text-center">
            <div>
              <Info className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                Unable to load travel tips
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                We couldn't fetch your personalized travel tips at the moment. Please try again later.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (visibleTips.length === 0) {
    return (
      <Card className="w-full" data-testid="travel-tips-empty">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center text-center">
            <div>
              <Lightbulb className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                No travel tips available
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {destination 
                  ? `We don't have specific tips for ${destination} right now.`
                  : "Add more details to your trip to get personalized travel tips."
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="travel-tips-container">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Travel Tips for Your Trip
          </h2>
        </div>
        {destination && (
          <Badge variant="outline" className="text-xs">
            {destination}
          </Badge>
        )}
      </div>

      {/* Tips by Category */}
      <div className="space-y-3">
        {sortedCategories.map(([category, categoryTips]) => {
          const config = categoryConfig[category as keyof typeof categoryConfig] || categoryConfig.activities;
          const IconComponent = config.icon;
          const isExpanded = expandedCategories.has(category);
          
          return (
            <Card key={category} className={`transition-all duration-200 ${isExpanded ? config.bgColor : ''}`} data-testid={`category-${category}`}>
              <Collapsible>
                <CollapsibleTrigger 
                  asChild
                  onClick={() => toggleCategory(category)}
                >
                  <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${config.color}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-medium">
                            {config.label}
                          </CardTitle>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {categoryTips.length} tip{categoryTips.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary" className="text-xs">
                          {categoryTips.length}
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-3">
                    {categoryTips.map((tip) => (
                      <div 
                        key={tip.id} 
                        className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 relative group"
                        data-testid={`tip-${tip.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 pr-8">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                {tip.title}
                              </h4>
                              <div className="flex items-center space-x-1">
                                {getPriorityStars(tip.priority)}
                              </div>
                            </div>
                            
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                              {tip.description}
                            </p>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex flex-wrap gap-1">
                                {tip.tags.slice(0, 3).map((tag) => (
                                  <Badge 
                                    key={tag} 
                                    variant="outline" 
                                    className="text-xs px-2 py-0.5"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                                {tip.tags.length > 3 && (
                                  <Badge variant="outline" className="text-xs px-2 py-0.5">
                                    +{tip.tags.length - 3} more
                                  </Badge>
                                )}
                              </div>
                              
                              {tip.relevanceScore && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {Math.round(tip.relevanceScore * 100)}% relevant
                                </div>
                              )}
                            </div>
                            
                            {tip.matchingReasons && tip.matchingReasons.length > 0 && (
                              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                <span className="font-medium">Why this matters:</span> {tip.matchingReasons.join(', ')}
                              </div>
                            )}
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDismissTip(tip.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 p-0"
                            data-testid={`dismiss-tip-${tip.id}`}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Footer */}
      {visibleTips.length > 0 && (
        <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-2">
          Showing {visibleTips.length} personalized tips • Tips are updated based on your destination and activities
        </div>
      )}
    </div>
  );
}