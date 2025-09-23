import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { Plus, ShoppingCart, Receipt, DollarSign, Trash2, Users } from "lucide-react";
import type { GroceryItemWithDetails, TripMember, User } from "@shared/schema";

interface GroceryListProps {
  tripId: number;
  user?: User;
  members?: TripMemberWithUser[];
}

type NewGroceryItemForm = {
  item: string;
  category: string;
  quantity: string;
  estimatedCost: string;
  notes: string;
  allergies: string;
  exclusions: string;
};

type TripMemberWithUser = TripMember & { user: User };

const normalizeTagList = (value: unknown): string[] => {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
  }

  return [];
};

const normalizeAmount = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const toStructuredNotes = (
  notes: GroceryItemWithDetails["notes"],
): { text: string; allergies: string[]; exclusions: string[] } => {
  if (!notes) {
    return { text: "", allergies: [], exclusions: [] };
  }

  if (typeof notes === "string") {
    return { text: notes.trim(), allergies: [], exclusions: [] };
  }

  return {
    text: typeof notes.text === "string" ? notes.text.trim() : "",
    allergies: normalizeTagList(notes.allergies),
    exclusions: normalizeTagList(notes.exclusions),
  };
};

const renderTagBadges = (
  tags: string[],
  prefix: string,
  variant: "destructive" | "outline",
) =>
  tags.length > 0 ? (
    <div className="flex flex-wrap gap-2 mt-2">
      {tags.map((tag) => (
        <Badge key={tag} variant={variant}>
          {prefix}
          {tag}
        </Badge>
      ))}
    </div>
  ) : null;

const renderNotesSection = (notes: GroceryItemWithDetails["notes"]) => {
  const { text, allergies, exclusions } = toStructuredNotes(notes);

  return (
    <>
      {text && <p className="text-sm text-gray-600 mt-1">{text}</p>}
      {renderTagBadges(allergies, "Allergy: ", "destructive")}
      {renderTagBadges(exclusions, "Exclude: ", "outline")}
    </>
  );
};

const categories = [
  "produce",
  "dairy",
  "meat",
  "pantry",
  "snacks",
  "beverages",
  "frozen",
  "personal",
  "other"
];

export function GroceryList({ tripId, user, members = [] }: GroceryListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeAllergyFilters, setActiveAllergyFilters] = useState<string[]>([]);
  const createEmptyNewItem = (): NewGroceryItemForm => ({
    item: "",
    category: "other",
    estimatedCost: "",
    notes: "",
    allergies: "",
    exclusions: "",
    quantity: "1",
  });
  const [newItem, setNewItem] = useState<NewGroceryItemForm>(createEmptyNewItem());
  const allergyPreview = normalizeTagList(newItem.allergies);
  const exclusionPreview = normalizeTagList(newItem.exclusions);

  const { data: groceryItems = [], isLoading } = useQuery<GroceryItemWithDetails[]>({
    queryKey: ["/api/trips", tripId, "groceries"],
  });

  const { data: groceryBill } = useQuery({
    queryKey: ["/api/trips", tripId, "groceries", "bill"],
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/trips/${tripId}/groceries`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "groceries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "groceries", "bill"] });
      toast({
        title: "Success",
        description: "Item added to grocery list",
      });
      setIsAddDialogOpen(false);
      setNewItem(createEmptyNewItem());
    },
  });

  const participateMutation = useMutation({
    mutationFn: async ({ itemId, userId }: { itemId: number; userId?: string }) => {
      const options: { method: string; body?: any } = { method: "POST" };
      if (userId) {
        options.body = { userId };
      }

      return await apiRequest(`/api/groceries/${itemId}/participate`, options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "groceries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "groceries", "bill"] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return await apiRequest(`/api/groceries/${itemId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "groceries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "groceries", "bill"] });
      toast({
        title: "Success",
        description: "Item removed from grocery list",
      });
    },
  });

  const markPurchasedMutation = useMutation({
    mutationFn: async ({ itemId, actualCost }: { itemId: number; actualCost?: string }) => {
      return await apiRequest(`/api/groceries/${itemId}/purchase`, {
        method: "PATCH",
        body: JSON.stringify({ actualCost }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "groceries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "groceries", "bill"] });
      toast({
        title: "Success",
        description: "Item marked as purchased",
      });
    },
  });

  const handleAddItem = () => {
    const itemName = newItem.item.trim();
    if (!itemName) return;

    const estimatedCostValue = parseFloat(newItem.estimatedCost);
    const quantityValue = newItem.quantity.trim();
    const notesText = newItem.notes.trim();
    const notesPayload =
      notesText || allergyPreview.length || exclusionPreview.length
        ? {
            ...(notesText ? { text: notesText } : {}),
            ...(allergyPreview.length ? { allergies: allergyPreview } : {}),
            ...(exclusionPreview.length ? { exclusions: exclusionPreview } : {}),
          }
        : undefined;

    addItemMutation.mutate({
      item: itemName,
      category: newItem.category,
      quantity: quantityValue ? quantityValue : undefined,
      notes: notesPayload,
      estimatedCost: Number.isFinite(estimatedCostValue) ? estimatedCostValue : undefined,
    });
  };

  const handleParticipate = (itemId: number, participantId?: string) => {
    participateMutation.mutate({ itemId, userId: participantId });
  };

  const handleDeleteItem = (itemId: number) => {
    deleteItemMutation.mutate(itemId);
  };

  const handleMarkPurchased = (itemId: number, actualCost?: string) => {
    markPurchasedMutation.mutate({ itemId, actualCost });
  };

  const toggleAllergyFilter = (allergy: string) => {
    setActiveAllergyFilters((previous) =>
      previous.includes(allergy)
        ? previous.filter((value) => value !== allergy)
        : [...previous, allergy],
    );
  };

  const clearAllergyFilters = () => setActiveAllergyFilters([]);

  const getItemsByCategory = (category: string) => {
    return groceryItems
      .filter((item) => item.category === category)
      .filter((item) => {
        if (activeAllergyFilters.length === 0) {
          return true;
        }
        const normalized = toStructuredNotes(item.notes)
          .allergies.map((value) => value.toLowerCase());
        return activeAllergyFilters.every(
          (filter) => !normalized.includes(filter.toLowerCase()),
        );
      });
  };

  const allergyOptions = useMemo(() => {
    const unique = new Map<string, string>();
    for (const item of groceryItems) {
      for (const allergy of toStructuredNotes(item.notes).allergies) {
        const key = allergy.toLowerCase();
        if (!unique.has(key)) {
          unique.set(key, allergy);
        }
      }
    }
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  }, [groceryItems]);

  const isUserParticipating = (item: GroceryItemWithDetails) => {
    return item.participants.some(p => p.userId === user?.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Grocery List</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Grocery Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="item-name">Item Name</Label>
                <Input
                  id="item-name"
                  value={newItem.item}
                  onChange={(e) => setNewItem({ ...newItem, item: e.target.value })}
                  placeholder="e.g., Milk, Bread, Apples"
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={newItem.category} onValueChange={(value) => setNewItem({ ...newItem, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="estimated-cost">Estimated Cost ($)</Label>
                <Input
                  id="estimated-cost"
                  type="number"
                  step="0.01"
                  value={newItem.estimatedCost}
                  onChange={(e) => setNewItem({ ...newItem, estimatedCost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  value={newItem.notes}
                  onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                  placeholder="Brand preference, dietary restrictions, etc."
                />
              </div>
              <div>
                <Label htmlFor="allergy-list">Allergies (comma separated)</Label>
                <Input
                  id="allergy-list"
                  value={newItem.allergies}
                  onChange={(e) => setNewItem({ ...newItem, allergies: e.target.value })}
                  placeholder="e.g., peanuts, shellfish"
                />
                {renderTagBadges(allergyPreview, "Allergy: ", "destructive")}
              </div>
              <div>
                <Label htmlFor="exclusion-list">Preferences / Exclusions</Label>
                <Input
                  id="exclusion-list"
                  value={newItem.exclusions}
                  onChange={(e) => setNewItem({ ...newItem, exclusions: e.target.value })}
                  placeholder="e.g., vegetarian"
                />
                {renderTagBadges(exclusionPreview, "Exclude: ", "outline")}
              </div>
              <Button onClick={handleAddItem} disabled={addItemMutation.isPending}>
                {addItemMutation.isPending ? "Adding..." : "Add Item"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Shopping List
          </TabsTrigger>
          <TabsTrigger value="bill">
            <DollarSign className="h-4 w-4 mr-2" />
            Cost Split
          </TabsTrigger>
          <TabsTrigger value="receipts">
            <Receipt className="h-4 w-4 mr-2" />
            Receipts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {allergyOptions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">Filter allergies:</span>
              {allergyOptions.map((allergy) => (
                <Badge
                  key={allergy}
                  variant={activeAllergyFilters.includes(allergy) ? "destructive" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleAllergyFilter(allergy)}
                >
                  {allergy}
                </Badge>
              ))}
              {activeAllergyFilters.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7" onClick={clearAllergyFilters}>
                  Clear
                </Button>
              )}
            </div>
          )}
          {categories.map((category) => {
            const items = getItemsByCategory(category);
            if (items.length === 0) return null;

            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-lg capitalize">{category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={isUserParticipating(item)}
                            onCheckedChange={() => handleParticipate(item.id)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className={`font-medium ${item.isPurchased ? 'line-through text-gray-500' : ''}`}>
                                {item.item}
                              </span>
                              {Number(item.quantity ?? 1) > 1 && (
                                <Badge variant="secondary">x{item.quantity}</Badge>
                              )}
                              {item.isPurchased && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  Purchased
                                </Badge>
                              )}
                            </div>
                            {renderNotesSection(item.notes)}
                            <div className="flex items-center space-x-2 mt-1">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-sm font-normal"
                                  >
                                    <Users className="h-4 w-4 mr-1" />
                                    {item.participantCount} participant{item.participantCount === 1 ? "" : "s"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-0" align="start">
                                  <div className="max-h-64 overflow-y-auto divide-y">
                                    {members.length === 0 ? (
                                      <div className="p-4 text-sm text-gray-500">
                                        No trip members available yet.
                                      </div>
                                    ) : (
                                      members.map((member) => {
                                        const memberUser = member.user;
                                        const displayName = memberUser.firstName || memberUser.email || "Unknown";
                                        const isParticipating = item.participants.some(
                                          (participant) => participant.userId === member.userId,
                                        );

                                        return (
                                          <label
                                            key={member.userId}
                                            className="flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-100"
                                          >
                                            <div className="flex items-center space-x-2">
                                              <Avatar className="h-8 w-8">
                                                <AvatarFallback>
                                                  {(memberUser.firstName?.charAt(0) || memberUser.email?.charAt(0) || "U").toUpperCase()}
                                                </AvatarFallback>
                                              </Avatar>
                                              <div className="flex flex-col">
                                                <span className="font-medium leading-tight">{displayName}</span>
                                                {memberUser.email && (
                                                  <span className="text-xs text-gray-500 truncate max-w-[160px]">
                                                    {memberUser.email}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <Checkbox
                                              checked={isParticipating}
                                              onCheckedChange={() => handleParticipate(item.id, member.userId)}
                                            />
                                          </label>
                                        );
                                      })
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <span className="text-sm text-gray-500">•</span>
                              <span className="text-sm text-gray-500">
                                Added by {item.addedBy.firstName || item.addedBy.email}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {formatCurrency(item.actualCost ?? item.estimatedCost ?? 0)}
                            </div>
                            {item.participantCount > 0 && (
                              <div className="text-xs text-gray-500">
                                {formatCurrency(item.costPerPerson ?? 0)} per person
                              </div>
                            )}
                          </div>
                          {!item.isPurchased && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkPurchased(item.id)}
                            >
                              Mark Purchased
                            </Button>
                          )}
                          {item.addedBy.id === user?.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="bill" className="space-y-4">
          {groceryBill && (groceryBill as any) && (
            <Card>
              <CardHeader>
                <CardTitle>Grocery Bill Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Total Cost:</span>
                    <span className="text-lg font-bold">
                      {formatCurrency(normalizeAmount((groceryBill as any).totalCost) ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Cost Per Person:</span>
                    <span className="text-lg font-bold">
                      {formatCurrency(normalizeAmount((groceryBill as any).costPerPerson) ?? 0)}
                    </span>
                  </div>
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Items by Category:</h4>
                    <div className="space-y-2">
                      {categories.map((category) => {
                        const items = ((groceryBill as any).items || []).filter((item: GroceryItemWithDetails) => item.category === category);
                        if (items.length === 0) return null;
                        
                        const categoryTotal = items.reduce((sum: number, item: GroceryItemWithDetails) => {
                          const itemCost = item.actualCost ?? item.estimatedCost ?? 0;
                          return sum + itemCost;
                        }, 0);
                        
                        return (
                          <div key={category} className="flex justify-between">
                            <span className="capitalize">{category} ({items.length} items)</span>
                            <span>{formatCurrency(categoryTotal)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="receipts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Receipt Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Receipt className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">Receipt Parsing Coming Soon</h3>
                <p className="text-gray-600">
                  Upload receipts and let AI automatically extract grocery items and costs.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}