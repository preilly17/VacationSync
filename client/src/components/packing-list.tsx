import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Package, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { PackingItem, User } from "@shared/schema";
import { format } from "date-fns";

interface PackingListProps {
  tripId: number;
}

const categories = [
  { value: "general", label: "General", color: "bg-gray-100 text-gray-800" },
  { value: "clothing", label: "Clothing", color: "bg-blue-100 text-blue-800" },
  { value: "electronics", label: "Electronics", color: "bg-purple-100 text-purple-800" },
  { value: "toiletries", label: "Toiletries", color: "bg-green-100 text-green-800" },
  { value: "documents", label: "Documents", color: "bg-red-100 text-red-800" },
  { value: "medication", label: "Medication", color: "bg-orange-100 text-orange-800" },
  { value: "food", label: "Food & Snacks", color: "bg-yellow-100 text-yellow-800" },
  { value: "activities", label: "Activities", color: "bg-indigo-100 text-indigo-800" },
];

export function PackingList({ tripId }: PackingListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [newItem, setNewItem] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("general");
  const [selectedItemType, setSelectedItemType] = useState<"personal" | "group">("personal");
  const [showCompleted, setShowCompleted] = useState(true);

  const { data: packingItems = [], isLoading } = useQuery<(PackingItem & { user: User })[]>({
    queryKey: [`/api/trips/${tripId}/packing`],
    retry: false,
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: { item: string; category: string; itemType: "personal" | "group" }) => {
      await apiRequest(`/api/trips/${tripId}/packing`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/packing`] });
      setNewItem("");
      setSelectedCategory("general");
      setSelectedItemType("personal");
      toast({
        title: "Item added!",
        description: "The packing item has been added to the list.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add packing item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest(`/api/packing/${itemId}/toggle`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/packing`] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest(`/api/packing/${itemId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/packing`] });
      toast({
        title: "Item deleted",
        description: "The packing item has been removed.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    
    addItemMutation.mutate({
      item: newItem.trim(),
      category: selectedCategory,
      itemType: selectedItemType,
    });
  };

  const personalItems = packingItems.filter(
    (item) => item.itemType === "personal" && item.userId === user?.id,
  );
  const groupItems = packingItems.filter((item) => item.itemType === "group");
  const visibleItems = [...personalItems, ...groupItems];

  const groupedPersonalItems = personalItems.reduce((acc, item) => {
    if (!acc[item.category || 'general']) {
      acc[item.category || 'general'] = [];
    }
    acc[item.category || 'general'].push(item);
    return acc;
  }, {} as Record<string, (PackingItem & { user: User })[]>);

  const groupedGroupItems = groupItems.reduce((acc, item) => {
    if (!acc[item.category || 'general']) {
      acc[item.category || 'general'] = [];
    }
    acc[item.category || 'general'].push(item);
    return acc;
  }, {} as Record<string, (PackingItem & { user: User })[]>);

  const getCategoryInfo = (categoryValue: string) => {
    return categories.find(cat => cat.value === categoryValue) || categories[0];
  };

  const completedCount = visibleItems.filter((item) => item.isChecked).length;
  const totalCount = visibleItems.length;

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Package className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Packing Essentials</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Package className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Packing Essentials</h2>
          <Badge variant="outline">
            {completedCount}/{totalCount} packed
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCompleted(!showCompleted)}
        >
          {showCompleted ? "Hide Completed" : "Show Completed"}
        </Button>
      </div>

      {totalCount > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{Math.round((completedCount / totalCount) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      <form onSubmit={handleAddItem} className="mb-6">
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add a packing item..."
            className="flex-1"
          />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedItemType} onValueChange={(value: "personal" | "group") => setSelectedItemType(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="group">Group</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            type="submit" 
            disabled={!newItem.trim() || addItemMutation.isPending}
            size="icon"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </form>

      {totalCount === 0 ? (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No packing items yet</h3>
          <p className="text-gray-600 mb-4">
            Start adding essential items that everyone should consider packing for this trip.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Personal Items Section */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-medium text-gray-900">Personal Items</h3>
              <Badge variant="outline">
                You: {personalItems.filter(item => item.isChecked).length}/{personalItems.length} packed
              </Badge>
            </div>
            
            {Object.keys(groupedPersonalItems).length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-gray-600">No personal items added yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {categories.map(category => {
                  const items = groupedPersonalItems[category.value] || [];
                  const visibleItems = showCompleted ? items : items.filter(item => !item.isChecked);
                  
                  if (visibleItems.length === 0) return null;

                  return (
                    <div key={category.value}>
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={category.color}>
                          {category.label}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          You: {items.filter(item => item.isChecked).length}/{items.length} packed
                        </span>
                      </div>
                      <div className="space-y-2">
                        {visibleItems.map(item => (
                          <div
                            key={item.id}
                            data-testid={`packing-item-${item.id}`}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                              item.isChecked 
                                ? 'bg-blue-50 border-blue-200 shadow-sm' 
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center space-x-3 flex-1">
                              <div className="cursor-pointer p-1 -m-1 rounded hover:bg-gray-100">
                                <Checkbox
                                  data-testid={`checkbox-${item.id}`}
                                  checked={!!item.isChecked}
                                  onCheckedChange={() => toggleItemMutation.mutate(item.id)}
                                />
                              </div>
                              <div className="flex-1">
                                <span 
                                  data-testid={`item-text-${item.id}`}
                                  className={`font-medium block transition-colors ${
                                  item.isChecked 
                                    ? 'line-through text-blue-600' 
                                    : 'text-gray-900'
                                }`}>
                                  {item.item}
                                </span>
                                {item.isChecked && (
                                  <span className="text-sm text-blue-600 font-medium" data-testid={`packed-indicator-${item.id}`}>✓ Packed</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="flex items-center space-x-1 text-sm text-gray-500">
                                <Users className="w-3 h-3" />
                                <span>{item.user.firstName || item.user.email}</span>
                              </div>
                              {user?.id === item.userId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteItemMutation.mutate(item.id)}
                                  disabled={deleteItemMutation.isPending}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Group Items Section */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Package className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-medium text-gray-900">Group Items</h3>
              <Badge variant="outline">
                You: {groupItems.filter(item => item.isChecked).length}/{groupItems.length} handled
              </Badge>
            </div>
            
            {Object.keys(groupedGroupItems).length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-gray-600">No group items added yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Add items that need to be purchased or coordinated by someone in the group
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {categories.map(category => {
                  const items = groupedGroupItems[category.value] || [];
                  const visibleItems = showCompleted ? items : items.filter(item => !item.isChecked);
                  
                  if (visibleItems.length === 0) return null;

                  return (
                    <div key={category.value}>
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={category.color}>
                          {category.label}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          You: {items.filter(item => item.isChecked).length}/{items.length} handled
                        </span>
                      </div>
                      <div className="space-y-2">
                        {visibleItems.map(item => (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                              item.isChecked 
                                ? 'bg-blue-50 border-blue-200 shadow-sm' 
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center space-x-3 flex-1">
                              <div 
                                className="cursor-pointer p-1 -m-1 rounded hover:bg-gray-100" 
                                onClick={() => toggleItemMutation.mutate(item.id)}
                              >
                                <Checkbox
                                  checked={!!item.isChecked}
                                  onCheckedChange={() => toggleItemMutation.mutate(item.id)}
                                />
                              </div>
                              <div className="flex-1">
                                <span className={`font-medium block transition-colors ${
                                  item.isChecked
                                    ? 'line-through text-blue-600'
                                    : 'text-gray-900'
                                }`}>
                                  {item.item}
                                </span>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  {item.isChecked && (
                                    <span className="text-sm text-blue-600 font-medium">✓ Handled</span>
                                  )}
                                  {item.groupStatus && item.groupStatus.memberCount > 0 && (
                                    <Badge variant="secondary" className="text-xs font-normal px-2 py-0.5">
                                      Group: {item.groupStatus.checkedCount}/{item.groupStatus.memberCount} handled
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="flex items-center space-x-1 text-sm text-gray-500">
                                <Users className="w-3 h-3" />
                                <span>Suggested by {item.user.firstName || item.user.email}</span>
                              </div>
                              {user?.id === item.userId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteItemMutation.mutate(item.id)}
                                  disabled={deleteItemMutation.isPending}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}