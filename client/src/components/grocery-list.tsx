import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, ShoppingCart, Receipt, DollarSign, Trash2 } from "lucide-react";
import type { GroceryItemWithDetails, User } from "@shared/schema";

interface GroceryListProps {
  tripId: number;
  user?: User;
}

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

export function GroceryList({ tripId, user }: GroceryListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "other",
    estimatedCost: "",
    notes: "",
    quantity: 1,
  });

  const { data: groceryItems = [], isLoading } = useQuery({
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
      setNewItem({ name: "", category: "other", estimatedCost: "", notes: "", quantity: 1 });
    },
  });

  const participateMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return await apiRequest(`/api/groceries/${itemId}/participate`, {
        method: "POST",
      });
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
    if (!newItem.name.trim()) return;
    
    addItemMutation.mutate({
      ...newItem,
      estimatedCost: newItem.estimatedCost || "0",
    });
  };

  const handleParticipate = (itemId: number) => {
    participateMutation.mutate(itemId);
  };

  const handleDeleteItem = (itemId: number) => {
    deleteItemMutation.mutate(itemId);
  };

  const handleMarkPurchased = (itemId: number, actualCost?: string) => {
    markPurchasedMutation.mutate({ itemId, actualCost });
  };

  const getItemsByCategory = (category: string) => {
    return (groceryItems as GroceryItemWithDetails[]).filter((item: GroceryItemWithDetails) => item.category === category);
  };

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
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
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
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
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
                    {items.map((item: GroceryItemWithDetails) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={isUserParticipating(item)}
                            onCheckedChange={() => handleParticipate(item.id)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className={`font-medium ${item.isPurchased ? 'line-through text-gray-500' : ''}`}>
                                {(item as any).name}
                              </span>
                              {(item.quantity ?? 1) > 1 && (
                                <Badge variant="secondary">x{item.quantity}</Badge>
                              )}
                              {item.isPurchased && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  Purchased
                                </Badge>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                            )}
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-sm text-gray-500">
                                {item.participantCount} participant(s)
                              </span>
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
                              ${parseFloat(item.actualCost || item.estimatedCost || "0").toFixed(2)}
                            </div>
                            {item.participantCount > 0 && (
                              <div className="text-xs text-gray-500">
                                ${item.costPerPerson.toFixed(2)} per person
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
                    <span className="text-lg font-bold">${(groceryBill as any).totalCost?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Cost Per Person:</span>
                    <span className="text-lg font-bold">${(groceryBill as any).costPerPerson?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Items by Category:</h4>
                    <div className="space-y-2">
                      {categories.map((category) => {
                        const items = ((groceryBill as any).items || []).filter((item: GroceryItemWithDetails) => item.category === category);
                        if (items.length === 0) return null;
                        
                        const categoryTotal = items.reduce((sum: number, item: GroceryItemWithDetails) => {
                          return sum + parseFloat(item.actualCost || item.estimatedCost || "0");
                        }, 0);
                        
                        return (
                          <div key={category} className="flex justify-between">
                            <span className="capitalize">{category} ({items.length} items)</span>
                            <span>${categoryTotal.toFixed(2)}</span>
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