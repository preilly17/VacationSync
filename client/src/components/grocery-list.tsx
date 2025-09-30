import { Fragment, useEffect, useMemo, useReducer, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { TripMember, User } from "@shared/schema";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CirclePlus,
  Edit2,
  EllipsisVertical,
  MinusCircle,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserRound,
  UtensilsCrossed,
  ShoppingCart,
} from "lucide-react";

interface GroceryListProps {
  tripId: number;
  user?: User;
  members?: TripMemberWithUser[];
}

type TripMemberWithUser = TripMember & { user: User };

type GroceryItemRecord = {
  id: string;
  name: string;
  quantityText: string;
  notes?: string;
  category?: string;
  assignedUserId?: string;
  purchased: boolean;
  mealId?: string;
};

type MealIngredientRecord = {
  id: string;
  name: string;
  quantityText: string;
  notes?: string;
};

type GroupMealProposalRecord = {
  id: string;
  name: string;
  ingredients: MealIngredientRecord[];
  votes: Record<string, "up" | "down">;
  status: "proposed" | "approved" | "deleted";
  createdBy?: string;
  createdAt: string;
};

type ApprovedMealRecord = {
  id: string;
  name: string;
  ingredientItemIds: string[];
  createdBy?: string;
  createdAt: string;
  leadUserId?: string;
};

type GroceryActivity = {
  id: string;
  message: string;
  timestamp: string;
};

type GroceryState = {
  items: GroceryItemRecord[];
  proposals: GroupMealProposalRecord[];
  meals: ApprovedMealRecord[];
  activity: GroceryActivity[];
  expandedMeals: Record<string, boolean>;
};

type GroceryAction =
  | { type: "ADD_ITEM"; payload: GroceryItemRecord }
  | { type: "UPDATE_ITEM"; payload: { id: string; updates: Partial<GroceryItemRecord> } }
  | { type: "DELETE_ITEM"; payload: { id: string } }
  | { type: "TOGGLE_PURCHASED"; payload: { id: string; purchased: boolean } }
  | { type: "ASSIGN_ITEM"; payload: { id: string; assignedUserId?: string } }
  | { type: "PROPOSE_MEAL"; payload: GroupMealProposalRecord }
  | {
      type: "UPDATE_PROPOSAL_VOTE";
      payload: { proposalId: string; userId: string; vote: "up" | "down" | null };
    }
  | {
      type: "APPROVE_MEAL";
      payload: {
        proposalId: string;
        meal: ApprovedMealRecord;
        ingredients: GroceryItemRecord[];
        activity: GroceryActivity;
      };
    }
  | { type: "DELETE_PROPOSAL"; payload: { proposalId: string } }
  | {
      type: "UPDATE_MEAL";
      payload: {
        mealId: string;
        name: string;
        leadUserId?: string;
        ingredients: MealIngredientRecord[];
      };
    }
  | { type: "CANCEL_MEAL"; payload: { mealId: string; mode: "remove" | "flatten" } }
  | { type: "TOGGLE_MEAL_EXPANDED"; payload: { mealId: string; expanded: boolean } }
  | { type: "MERGE_ITEMS"; payload: { keepId: string; removeId: string } }
  | { type: "ADD_ACTIVITY"; payload: GroceryActivity };

type OfflineActionEntry = {
  id: string;
  type: string;
  payload: unknown;
  status: "pending" | "synced";
  createdAt: string;
};

const STORAGE_KEY = "vacationsync:grocery-state";
const OUTBOX_KEY = "vacationsync:grocery-outbox";

const defaultState: GroceryState = {
  items: [],
  proposals: [],
  meals: [],
  activity: [],
  expandedMeals: {},
};

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Math.random().toString(36).slice(2, 11)}`;
};

const loadStateFromStorage = (): GroceryState => {
  if (typeof window === "undefined") {
    return defaultState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultState;
    }

    const parsed = JSON.parse(raw) as GroceryState;
    if (!parsed || typeof parsed !== "object") {
      return defaultState;
    }

    return {
      ...defaultState,
      ...parsed,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      proposals: Array.isArray(parsed.proposals) ? parsed.proposals : [],
      meals: Array.isArray(parsed.meals) ? parsed.meals : [],
      activity: Array.isArray(parsed.activity) ? parsed.activity : [],
      expandedMeals:
        parsed.expandedMeals && typeof parsed.expandedMeals === "object"
          ? parsed.expandedMeals
          : {},
    } satisfies GroceryState;
  } catch (error) {
    console.error("Failed to read grocery state", error);
    return defaultState;
  }
};

const loadOutboxFromStorage = (): OfflineActionEntry[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as OfflineActionEntry[];
  } catch (error) {
    console.error("Failed to parse grocery outbox", error);
    return [];
  }
};

const reducer = (state: GroceryState, action: GroceryAction): GroceryState => {
  switch (action.type) {
    case "ADD_ITEM": {
      return { ...state, items: [...state.items, action.payload] };
    }
    case "UPDATE_ITEM": {
      const { id, updates } = action.payload;
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === id
            ? {
                ...item,
                ...updates,
              }
            : item,
        ),
      };
    }
    case "DELETE_ITEM": {
      const { id } = action.payload;
      const filteredItems = state.items.filter((item) => item.id !== id);
      const meals = state.meals.map((meal) => ({
        ...meal,
        ingredientItemIds: meal.ingredientItemIds.filter((itemId) => itemId !== id),
      }));

      return { ...state, items: filteredItems, meals };
    }
    case "TOGGLE_PURCHASED": {
      const { id, purchased } = action.payload;
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === id
            ? {
                ...item,
                purchased,
              }
            : item,
        ),
      };
    }
    case "ASSIGN_ITEM": {
      const { id, assignedUserId } = action.payload;
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === id
            ? {
                ...item,
                assignedUserId,
              }
            : item,
        ),
      };
    }
    case "PROPOSE_MEAL": {
      return {
        ...state,
        proposals: [...state.proposals, action.payload],
      };
    }
    case "UPDATE_PROPOSAL_VOTE": {
      const { proposalId, userId, vote } = action.payload;
      return {
        ...state,
        proposals: state.proposals.map((proposal) => {
          if (proposal.id !== proposalId || !userId) {
            return proposal;
          }

          const votes = { ...proposal.votes };
          if (vote === null) {
            delete votes[userId];
          } else {
            votes[userId] = vote;
          }

          return { ...proposal, votes };
        }),
      };
    }
    case "APPROVE_MEAL": {
      const { proposalId, meal, ingredients, activity } = action.payload;
      const proposals = state.proposals.filter((proposal) => proposal.id !== proposalId);
      const expandedMeals = { ...state.expandedMeals, [meal.id]: true };
      return {
        ...state,
        proposals,
        meals: [...state.meals, meal],
        items: [...state.items, ...ingredients],
        activity: [activity, ...state.activity].slice(0, 20),
        expandedMeals,
      };
    }
    case "DELETE_PROPOSAL": {
      const { proposalId } = action.payload;
      return {
        ...state,
        proposals: state.proposals.filter((proposal) => proposal.id !== proposalId),
      };
    }

    case "UPDATE_MEAL": {
      const { mealId, name, leadUserId, ingredients } = action.payload;
      const meal = state.meals.find((entry) => entry.id === mealId);
      if (!meal) {
        return state;
      }

      const incoming = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
      const nextItems: GroceryItemRecord[] = [];

      for (const item of state.items) {
        if (item.mealId === mealId) {
          const match = incoming.get(item.id);
          if (match) {
            nextItems.push({
              ...item,
              name: match.name,
              quantityText: match.quantityText,
              notes: match.notes,
            });
            incoming.delete(item.id);
          }
        } else {
          nextItems.push(item);
        }
      }

      for (const ingredient of Array.from(incoming.values())) {
        nextItems.push({
          id: ingredient.id,
          name: ingredient.name,
          quantityText: ingredient.quantityText,
          notes: ingredient.notes,
          purchased: false,
          mealId,
        });
      }

      return {
        ...state,
        items: nextItems,
        meals: state.meals.map((entry) =>
          entry.id === mealId
            ? {
                ...entry,
                name,
                leadUserId,
                ingredientItemIds: ingredients.map((ingredient) => ingredient.id),
              }
            : entry,
        ),
      };
    }
    case "CANCEL_MEAL": {
      const { mealId, mode } = action.payload;
      const meal = state.meals.find((entry) => entry.id === mealId);
      if (!meal) {
        return state;
      }

      if (mode === "remove") {
        return {
          ...state,
          meals: state.meals.filter((entry) => entry.id !== mealId),
          items: state.items.filter((item) => item.mealId !== mealId),
        };
      }

      return {
        ...state,
        meals: state.meals.filter((entry) => entry.id !== mealId),
        items: state.items.map((item) =>
          item.mealId === mealId
            ? {
                ...item,
                mealId: undefined,
              }
            : item,
        ),
      };
    }
    case "TOGGLE_MEAL_EXPANDED": {
      const { mealId, expanded } = action.payload;
      return {
        ...state,
        expandedMeals: {
          ...state.expandedMeals,
          [mealId]: expanded,
        },
      };
    }
    case "MERGE_ITEMS": {
      const { keepId, removeId } = action.payload;
      const updatedMeals = state.meals.map((meal) => ({
        ...meal,
        ingredientItemIds: meal.ingredientItemIds
          .filter((itemId) => itemId !== removeId)
          .map((itemId) => (itemId === keepId ? keepId : itemId)),
      }));

      return {
        ...state,
        meals: updatedMeals,
        items: state.items.filter((item) => item.id !== removeId),
      };
    }
    case "ADD_ACTIVITY": {
      return {
        ...state,
        activity: [action.payload, ...state.activity].slice(0, 20),
      };
    }
    default:
      return state;
  }
};

const getMemberName = (member?: TripMemberWithUser | null) => {
  if (!member) {
    return "Unassigned";
  }

  const { user } = member;
  if (user.firstName || user.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  }

  return user.username || user.email;
};

const getUserInitials = (user?: User) => {
  if (!user) {
    return "?";
  }

  const first = user.firstName?.[0];
  const last = user.lastName?.[0];
  if (first || last) {
    return `${first ?? ""}${last ?? ""}` || "?";
  }

  if (user.username) {
    return user.username.slice(0, 2).toUpperCase();
  }

  return user.email.slice(0, 2).toUpperCase();
};

const getAssignmentLabel = (
  assignedUserId: string | undefined,
  members: TripMemberWithUser[],
  user?: User,
) => {
  if (!assignedUserId) {
    return "Assign";
  }

  if (assignedUserId === user?.id) {
    return "Assigned to me";
  }

  const member = members.find((entry) => entry.userId === assignedUserId);
  return member ? getMemberName(member) : "Assign";
};

const filterItems = (
  items: GroceryItemRecord[],
  {
    category,
    assignedFilter,
    status,
  }: {
    category: string;
    assignedFilter: string;
    status: "all" | "needed" | "purchased";
  },
): GroceryItemRecord[] => {
  return items.filter((item) => {
    const matchesCategory =
      category === "all" ||
      (category === "uncategorized" && !item.category) ||
      item.category === category ||
      (category === "meals" && Boolean(item.mealId));

    if (!matchesCategory) {
      return false;
    }

    if (status === "needed" && item.purchased) {
      return false;
    }

    if (status === "purchased" && !item.purchased) {
      return false;
    }

    if (assignedFilter === "unassigned" && item.assignedUserId) {
      return false;
    }

    if (assignedFilter === "assigned" && !item.assignedUserId) {
      return false;
    }

    if (assignedFilter.startsWith("user:")) {
      const [, targetId] = assignedFilter.split(":");
      if (item.assignedUserId !== targetId) {
        return false;
      }
    }

    return true;
  });
};

const getCategoryLabel = (category: string) => {
  if (category === "uncategorized") {
    return "Uncategorized";
  }

  if (category === "meals") {
    return "Meals";
  }

  if (category === "all") {
    return "All items";
  }

  return category.charAt(0).toUpperCase() + category.slice(1);
};

const useDuplicateMap = (items: GroceryItemRecord[]) =>
  useMemo(() => {
    const lookup = new Map<string, GroceryItemRecord[]>();
    for (const item of items) {
      const key = item.name.trim().toLowerCase();
      if (!key) {
        continue;
      }

      const existing = lookup.get(key) ?? [];
      lookup.set(key, [...existing, item]);
    }

    const duplicates = new Map<string, GroceryItemRecord[]>();
    lookup.forEach((group) => {
    if (group.length > 1) {
      for (const item of group) {
        duplicates.set(
          item.id,
          group.filter((candidate: GroceryItemRecord) => candidate.id !== item.id),
        );
      }
    }
  });

    return duplicates;
  }, [items]);

const formatUserName = (user?: User) => {
  if (!user) {
    return "Guest";
  }

  if (user.firstName || user.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  }

  return user.username || user.email;
};

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem: (item: {
    name: string;
    quantityText: string;
    notes?: string;
    category?: string;
  }) => void;
  onProposeMeal: (proposal: {
    name: string;
    ingredients: MealIngredientRecord[];
  }) => void;
}

const AddItemDialog = ({
  open,
  onOpenChange,
  onAddItem,
  onProposeMeal,
}: AddItemDialogProps) => {
  const [mode, setMode] = useState<"item" | "meal">("item");
  const [itemName, setItemName] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [itemNotes, setItemNotes] = useState("");
  const [itemCategory, setItemCategory] = useState<string | undefined>(undefined);
  const [mealName, setMealName] = useState("");
  const [ingredients, setIngredients] = useState<MealIngredientRecord[]>([
    {
      id: generateId(),
      name: "",
      quantityText: "",
    },
  ]);

  useEffect(() => {
    if (open) {
      setMode("item");
      setItemName("");
      setItemQuantity("1");
      setItemNotes("");
      setItemCategory(undefined);
      setMealName("");
      setIngredients([
        {
          id: generateId(),
          name: "",
          quantityText: "",
        },
      ]);
    }
  }, [open]);

  const handleSubmit = () => {
    if (mode === "item") {
      if (!itemName.trim()) {
        return;
      }

      onAddItem({
        name: itemName.trim(),
        quantityText: itemQuantity.trim() || "1",
        notes: itemNotes.trim() || undefined,
        category: itemCategory,
      });
      onOpenChange(false);
      return;
    }

    if (!mealName.trim()) {
      return;
    }

    const filteredIngredients = ingredients
      .map((ingredient) => ({
        ...ingredient,
        name: ingredient.name.trim(),
        quantityText: ingredient.quantityText.trim(),
        notes: ingredient.notes?.trim() || undefined,
      }))
      .filter((ingredient) => ingredient.name.length > 0);

    if (filteredIngredients.length === 0) {
      return;
    }

    onProposeMeal({
      name: mealName.trim(),
      ingredients: filteredIngredients,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add to Grocery List</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(value) => value && setMode(value as "item" | "meal")}
            className="self-start"
          >
            <ToggleGroupItem value="item">Item</ToggleGroupItem>
            <ToggleGroupItem value="meal">Group Meal</ToggleGroupItem>
          </ToggleGroup>

          {mode === "item" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="item-name">Item name</Label>
                <Input
                  id="item-name"
                  value={itemName}
                  onChange={(event) => setItemName(event.target.value)}
                  placeholder="Milk"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-quantity">Quantity</Label>
                <Input
                  id="item-quantity"
                  value={itemQuantity}
                  onChange={(event) => setItemQuantity(event.target.value)}
                  placeholder="2 cartons"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-category">Category (optional)</Label>
                <Input
                  id="item-category"
                  value={itemCategory ?? ""}
                  onChange={(event) =>
                    setItemCategory(event.target.value.trim() ? event.target.value : undefined)
                  }
                  placeholder="dairy"
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="item-notes">Notes (optional)</Label>
                <Textarea
                  id="item-notes"
                  value={itemNotes}
                  onChange={(event) => setItemNotes(event.target.value)}
                  placeholder="Organic if available"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="meal-name">Meal name</Label>
                <Input
                  id="meal-name"
                  value={mealName}
                  onChange={(event) => setMealName(event.target.value)}
                  placeholder="Taco Night"
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Ingredients</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setIngredients((prev) => [
                        ...prev,
                        { id: generateId(), name: "", quantityText: "" },
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add ingredient
                  </Button>
                </div>
                <div className="grid gap-4">
                  {ingredients.map((ingredient, index) => (
                    <Card key={ingredient.id} className="border-dashed">
                      <CardContent className="grid gap-3 pt-4">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`ingredient-name-${ingredient.id}`}>
                              Ingredient {index + 1}
                            </Label>
                            <Input
                              id={`ingredient-name-${ingredient.id}`}
                              value={ingredient.name}
                              onChange={(event) =>
                                setIngredients((prev) =>
                                  prev.map((entry) =>
                                    entry.id === ingredient.id
                                      ? { ...entry, name: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              placeholder="Ground beef"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`ingredient-qty-${ingredient.id}`}>
                              Quantity
                            </Label>
                            <Input
                              id={`ingredient-qty-${ingredient.id}`}
                              value={ingredient.quantityText}
                              onChange={(event) =>
                                setIngredients((prev) =>
                                  prev.map((entry) =>
                                    entry.id === ingredient.id
                                      ? { ...entry, quantityText: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                              placeholder="2 lbs"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`ingredient-notes-${ingredient.id}`}>
                            Notes (optional)
                          </Label>
                          <Textarea
                            id={`ingredient-notes-${ingredient.id}`}
                            value={ingredient.notes ?? ""}
                            onChange={(event) =>
                              setIngredients((prev) =>
                                prev.map((entry) =>
                                  entry.id === ingredient.id
                                    ? { ...entry, notes: event.target.value }
                                    : entry,
                                ),
                              )
                            }
                            placeholder="Any brand works"
                          />
                        </div>
                        {ingredients.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="justify-start text-destructive"
                            onClick={() =>
                              setIngredients((prev) =>
                                prev.filter((entry) => entry.id !== ingredient.id),
                              )
                            }
                          >
                            <MinusCircle className="mr-2 h-4 w-4" /> Remove ingredient
                          </Button>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit}>
            {mode === "item" ? "Add item" : "Propose meal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface AssignMenuProps {
  trigger: React.ReactNode;
  item: GroceryItemRecord;
  members: TripMemberWithUser[];
  currentUser?: User;
  onAssign: (userId?: string) => void;
}

const AssignMenu = ({ trigger, item, members, currentUser, onAssign }: AssignMenuProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-56">
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => onAssign(undefined)}
          >
            <UserRound className="mr-2 h-4 w-4" /> Unassigned
          </Button>
          {currentUser ? (
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => onAssign(currentUser.id)}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  item.assignedUserId === currentUser.id ? "opacity-100" : "opacity-0",
                )}
              />
              Assign to me
            </Button>
          ) : null}
          <Separator />
          {members.map((member) => (
            <Button
              key={member.id}
              variant="ghost"
              className="w-full justify-start"
              onClick={() => onAssign(member.userId)}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  item.assignedUserId === member.userId ? "opacity-100" : "opacity-0",
                )}
              />
              {getMemberName(member)}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface EditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: GroceryItemRecord | null;
  onSave: (updates: { name: string; quantityText: string; notes?: string }) => void;
}

const EditItemDialog = ({ open, onOpenChange, item, onSave }: EditItemDialogProps) => {
  const [name, setName] = useState(item?.name ?? "");
  const [quantity, setQuantity] = useState(item?.quantityText ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");

  useEffect(() => {
    setName(item?.name ?? "");
    setQuantity(item?.quantityText ?? "");
    setNotes(item?.notes ?? "");
  }, [item]);

  if (!item) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-item-name">Name</Label>
            <Input
              id="edit-item-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-item-quantity">Quantity</Label>
            <Input
              id="edit-item-quantity"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-item-notes">Notes</Label>
            <Textarea
              id="edit-item-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              if (!name.trim()) {
                return;
              }

              onSave({
                name: name.trim(),
                quantityText: quantity.trim(),
                notes: notes.trim() || undefined,
              });
            }}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type MealWithItems = ApprovedMealRecord & { items: GroceryItemRecord[] };

interface EditMealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: MealWithItems | null;
  members: TripMemberWithUser[];
  onSave: (data: {
    name: string;
    leadUserId?: string;
    ingredients: MealIngredientRecord[];
  }) => void;
}

const EditMealDialog = ({ open, onOpenChange, meal, members, onSave }: EditMealDialogProps) => {
  const [name, setName] = useState(meal?.name ?? "");
  const [leadUserId, setLeadUserId] = useState<string | undefined>(meal?.leadUserId);
  const [ingredients, setIngredients] = useState<MealIngredientRecord[]>(
    meal?.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantityText: item.quantityText,
      notes: item.notes,
    })) ?? [],
  );

  useEffect(() => {
    if (meal) {
      setName(meal.name);
      setLeadUserId(meal.leadUserId);
      setIngredients(
        meal.items.map((item) => ({
          id: item.id,
          name: item.name,
          quantityText: item.quantityText,
          notes: item.notes,
        })),
      );
    }
  }, [meal]);

  if (!meal) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit meal</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-meal-name">Meal name</Label>
              <Input
                id="edit-meal-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-meal-lead">Meal lead (optional)</Label>
              <Select
                value={leadUserId ?? ""}
                onValueChange={(value) =>
                  setLeadUserId(value === "" ? undefined : value)
                }
              >
                <SelectTrigger id="edit-meal-lead">
                  <SelectValue placeholder="Select lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No lead</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.userId}>
                      {getMemberName(member)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Ingredients</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setIngredients((prev) => [
                    ...prev,
                    {
                      id: generateId(),
                      name: "",
                      quantityText: "",
                    },
                  ])
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Add ingredient
              </Button>
            </div>
            <div className="grid gap-4">
              {ingredients.map((ingredient, index) => (
                <Card key={ingredient.id} className="border-dashed">
                  <CardContent className="grid gap-3 pt-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`edit-meal-ingredient-${ingredient.id}`}>
                          Ingredient {index + 1}
                        </Label>
                        <Input
                          id={`edit-meal-ingredient-${ingredient.id}`}
                          value={ingredient.name}
                          onChange={(event) =>
                            setIngredients((prev) =>
                              prev.map((entry) =>
                                entry.id === ingredient.id
                                  ? { ...entry, name: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-meal-qty-${ingredient.id}`}>
                          Quantity
                        </Label>
                        <Input
                          id={`edit-meal-qty-${ingredient.id}`}
                          value={ingredient.quantityText}
                          onChange={(event) =>
                            setIngredients((prev) =>
                              prev.map((entry) =>
                                entry.id === ingredient.id
                                  ? { ...entry, quantityText: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`edit-meal-notes-${ingredient.id}`}>
                        Notes
                      </Label>
                      <Textarea
                        id={`edit-meal-notes-${ingredient.id}`}
                        value={ingredient.notes ?? ""}
                        onChange={(event) =>
                          setIngredients((prev) =>
                            prev.map((entry) =>
                              entry.id === ingredient.id
                                ? { ...entry, notes: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                    </div>
                    {ingredients.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="justify-start text-destructive"
                        onClick={() =>
                          setIngredients((prev) =>
                            prev.filter((entry) => entry.id !== ingredient.id),
                          )
                        }
                      >
                        <MinusCircle className="mr-2 h-4 w-4" /> Remove ingredient
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              const filteredIngredients = ingredients
                .map((ingredient) => ({
                  ...ingredient,
                  name: ingredient.name.trim(),
                  quantityText: ingredient.quantityText.trim(),
                  notes: ingredient.notes?.trim() || undefined,
                }))
                .filter((ingredient) => ingredient.name.length > 0);

              if (!name.trim() || filteredIngredients.length === 0) {
                return;
              }

              onSave({
                name: name.trim(),
                leadUserId,
                ingredients: filteredIngredients,
              });
            }}
          >
            Save meal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface PendingProposalCardProps {
  proposal: GroupMealProposalRecord;
  expanded: boolean;
  onToggle: (open: boolean) => void;
  onVote: (vote: "up" | "down") => void;
  onClearVote: () => void;
  onApprove: () => void;
  onDelete: () => void;
  currentUser?: User;
  members: TripMemberWithUser[];
}

const PendingProposalCard = ({
  proposal,
  expanded,
  onToggle,
  onVote,
  onClearVote,
  onApprove,
  onDelete,
  currentUser,
  members,
}: PendingProposalCardProps) => {
  const userId = currentUser?.id ?? "guest";
  const userVote = proposal.votes[userId];
  const upVotes = Object.values(proposal.votes).filter((vote) => vote === "up");
  const downVotes = Object.values(proposal.votes).filter((vote) => vote === "down");

  const canModerate = !proposal.createdBy || proposal.createdBy === currentUser?.id;

  const participantUsers = Object.entries(proposal.votes)
    .map(([participantId, vote]) => ({
      participantId,
      vote,
      user:
        members.find((member) => member.userId === participantId)?.user ??
        (currentUser && participantId === currentUser.id ? currentUser : undefined),
    }))
    .filter((entry) => entry.user);

  return (
    <Card className="border-muted">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Proposed</Badge>
            <span className="text-lg font-semibold">{proposal.name}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {proposal.ingredients.slice(0, 3).map((ingredient) => ingredient.name).join(", ")}
            {proposal.ingredients.length > 3 ? ", …" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={userVote === "up" ? "default" : "outline"}
            size="sm"
            onClick={() => (userVote === "up" ? onClearVote() : onVote("up"))}
          >
            <ThumbsUp className="mr-1 h-4 w-4" /> {upVotes.length}
          </Button>
          <Button
            variant={userVote === "down" ? "destructive" : "outline"}
            size="sm"
            onClick={() => (userVote === "down" ? onClearVote() : onVote("down"))}
          >
            <ThumbsDown className="mr-1 h-4 w-4" /> {downVotes.length}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onToggle(!expanded)}>
            {expanded ? (
              <>
                Hide details <ChevronUp className="ml-1 h-4 w-4" />
              </>
            ) : (
              <>
                Details <ChevronDown className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onApprove}
            disabled={!canModerate}
          >
            Approve
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={!canModerate}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>
      </CardHeader>
      {expanded ? (
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h4 className="font-semibold">Ingredients</h4>
            <ul className="grid gap-3">
              {proposal.ingredients.map((ingredient) => (
                <li
                  key={ingredient.id}
                  className="rounded-lg border border-dashed p-3"
                >
                  <p className="font-medium">{ingredient.name}</p>
                  {ingredient.quantityText ? (
                    <p className="text-sm text-muted-foreground">
                      Quantity: {ingredient.quantityText}
                    </p>
                  ) : null}
                  {ingredient.notes ? (
                    <p className="text-sm text-muted-foreground">{ingredient.notes}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          {participantUsers.length > 0 ? (
            <div className="space-y-2">
              <h4 className="font-semibold">Interest</h4>
              <div className="flex flex-wrap gap-2">
                {participantUsers.map((entry) => (
                  <Badge
                    key={entry.participantId}
                    variant={entry.vote === "up" ? "default" : "outline"}
                    className="flex items-center gap-1"
                  >
                    <Avatar className="h-6 w-6 border">
                      <AvatarFallback>{getUserInitials(entry.user)}</AvatarFallback>
                    </Avatar>
                    {formatUserName(entry.user)}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
};

export function GroceryList({ tripId: _tripId, user, members = [] }: GroceryListProps) {
  const { toast } = useToast();
  void _tripId;
  const [state, dispatch] = useReducer(reducer, undefined, loadStateFromStorage);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editMealId, setEditMealId] = useState<string | null>(null);
  const [expandedProposals, setExpandedProposals] = useState<Record<string, boolean>>({});
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "needed" | "purchased">("needed");
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [outbox, setOutbox] = useState<OfflineActionEntry[]>(loadOutboxFromStorage);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  }, [outbox]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOnline = () => {
      setIsOnline(true);
      setOutbox((prev) =>
        prev.map((entry) =>
          entry.status === "pending" ? { ...entry, status: "synced" } : entry,
        ),
      );
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const enqueueAction = (type: string, payload: unknown) => {
    setOutbox((prev) => [
      {
        id: generateId(),
        type,
        payload,
        status: isOnline ? "synced" : "pending",
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const duplicateMap = useDuplicateMap(state.items);

  const memberLookup = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );

  const mealsWithItems: MealWithItems[] = useMemo(() => {
    return state.meals.map((meal) => ({
      ...meal,
      items: meal.ingredientItemIds
        .map((id) => state.items.find((item) => item.id === id))
        .filter((item): item is GroceryItemRecord => Boolean(item)),
    }));
  }, [state.meals, state.items]);

  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    for (const item of state.items) {
      if (item.category) {
        categorySet.add(item.category);
      }
    }

    const hasCategories = categorySet.size > 0;
    const base = ["all"];
    if (hasCategories) {
      for (const category of Array.from(categorySet).sort()) {
        base.push(category);
      }
      if (state.items.some((item) => !item.category)) {
        base.push("uncategorized");
      }
    }
    base.push("meals");
    return base;
  }, [state.items]);

  const filteredMeals = useMemo(() => {
    return mealsWithItems
      .map((meal) => {
        const filteredItems = filterItems(meal.items, {
          category: categoryFilter,
          assignedFilter,
          status: statusFilter,
        });

        return { ...meal, items: filteredItems };
      })
      .filter((meal) => meal.items.length > 0 || categoryFilter === "meals");
  }, [mealsWithItems, categoryFilter, assignedFilter, statusFilter]);

  const standaloneItems = useMemo(() => {
    return filterItems(
      state.items.filter((item) => !item.mealId),
      {
        category: categoryFilter,
        assignedFilter,
        status: statusFilter,
      },
    );
  }, [state.items, categoryFilter, assignedFilter, statusFilter]);

  const hasListContent = standaloneItems.length > 0 || filteredMeals.length > 0;

  const currentUserId = user?.id;

  const handleAddItem = ({
    name,
    quantityText,
    notes,
    category,
  }: {
    name: string;
    quantityText: string;
    notes?: string;
    category?: string;
  }) => {
    const item: GroceryItemRecord = {
      id: generateId(),
      name,
      quantityText,
      notes,
      category,
      purchased: false,
    };
    dispatch({ type: "ADD_ITEM", payload: item });
    enqueueAction("add-item", item);
    toast({
      title: "Item added",
      description: `${name} added to the grocery list`,
    });
  };

  const handleProposeMeal = ({
    name,
    ingredients,
  }: {
    name: string;
    ingredients: MealIngredientRecord[];
  }) => {
    const proposal: GroupMealProposalRecord = {
      id: generateId(),
      name,
      ingredients,
      votes: {},
      status: "proposed",
      createdBy: currentUserId,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "PROPOSE_MEAL", payload: proposal });
    enqueueAction("propose-meal", proposal);
    toast({
      title: "Meal proposed",
      description: `${name} sent for group feedback`,
    });
  };

  const handleApproveMeal = (proposal: GroupMealProposalRecord) => {
    const mealId = generateId();
    const ingredientItems = proposal.ingredients.map((ingredient) => ({
      id: ingredient.id || generateId(),
      name: ingredient.name,
      quantityText: ingredient.quantityText,
      notes: ingredient.notes,
      purchased: false,
      mealId,
    }));
    const meal: ApprovedMealRecord = {
      id: mealId,
      name: proposal.name,
      ingredientItemIds: ingredientItems.map((item) => item.id),
      createdBy: proposal.createdBy,
      createdAt: new Date().toISOString(),
    };
    const activity: GroceryActivity = {
      id: generateId(),
      message: `${proposal.name} approved. Ingredients added.`,
      timestamp: new Date().toISOString(),
    };

    dispatch({
      type: "APPROVE_MEAL",
      payload: {
        proposalId: proposal.id,
        meal,
        ingredients: ingredientItems,
        activity,
      },
    });
    enqueueAction("approve-meal", { proposalId: proposal.id, mealId });
    toast({
      title: "Meal approved",
      description: `${proposal.name} is now on the grocery list`,
    });
  };

  const handleDeleteProposal = (proposal: GroupMealProposalRecord) => {
    dispatch({ type: "DELETE_PROPOSAL", payload: { proposalId: proposal.id } });
    enqueueAction("delete-proposal", { proposalId: proposal.id });
    toast({
      title: "Proposal removed",
      description: `${proposal.name} deleted`,
    });
  };

  const pendingProposals = state.proposals.filter((proposal) => proposal.status === "proposed");

  const editItem = state.items.find((item) => item.id === editItemId) ?? null;
  const editMeal = mealsWithItems.find((meal) => meal.id === editMealId) ?? null;

  return (
    <Fragment>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              Grocery List
              {!isOnline ? <Badge variant="destructive">Offline</Badge> : null}
            </h2>
            <p className="text-sm text-muted-foreground">
              One shared surface for grocery items and group meals.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add item
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {getCategoryLabel(category)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Assigned</Label>
            <Select value={assignedFilter} onValueChange={(value) => setAssignedFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Everyone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="assigned">Assigned only</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {user ? <SelectItem value={`user:${user.id}`}>Assigned to me</SelectItem> : null}
                {members.map((member) => (
                  <SelectItem key={member.id} value={`user:${member.userId}`}>
                    {getMemberName(member)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <ToggleGroup
              type="single"
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter((value as typeof statusFilter | "") || "all")
              }
              className="justify-start"
            >
              <ToggleGroupItem value="all">All</ToggleGroupItem>
              <ToggleGroupItem value="needed">Needed</ToggleGroupItem>
              <ToggleGroupItem value="purchased">Purchased</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {pendingProposals.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Pending group meals</h3>
            </div>
            <div className="grid gap-3">
              {pendingProposals.map((proposal) => (
                <PendingProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  expanded={Boolean(expandedProposals[proposal.id])}
                  onToggle={(open) =>
                    setExpandedProposals((prev) => ({ ...prev, [proposal.id]: open }))
                  }
                  onVote={(vote) => {
                    dispatch({
                      type: "UPDATE_PROPOSAL_VOTE",
                      payload: {
                        proposalId: proposal.id,
                        userId: currentUserId ?? "guest",
                        vote,
                      },
                    });
                    enqueueAction("vote-proposal", {
                      proposalId: proposal.id,
                      vote,
                    });
                  }}
                  onClearVote={() => {
                    dispatch({
                      type: "UPDATE_PROPOSAL_VOTE",
                      payload: {
                        proposalId: proposal.id,
                        userId: currentUserId ?? "guest",
                        vote: null,
                      },
                    });
                    enqueueAction("clear-proposal-vote", {
                      proposalId: proposal.id,
                    });
                  }}
                  onApprove={() => handleApproveMeal(proposal)}
                  onDelete={() => handleDeleteProposal(proposal)}
                  currentUser={user}
                  members={members}
                />
              ))}
            </div>
          </section>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-between gap-3 py-6">
              <div>
                <p className="font-medium">No meal ideas yet.</p>
                <p className="text-sm text-muted-foreground">
                  Propose your first group dinner to get everyone excited.
                </p>
              </div>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
                Propose meal
              </Button>
            </CardContent>
          </Card>
        )}

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Items</h3>
          </div>
          {hasListContent ? (
            <div className="space-y-6">
              {filteredMeals.map((meal) => {
                const expanded = state.expandedMeals[meal.id] ?? true;
                const leadMember = meal.leadUserId ? memberLookup.get(meal.leadUserId) : undefined;
                return (
                  <Card key={meal.id} className="border-muted">
                    <CardHeader className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            dispatch({
                              type: "TOGGLE_MEAL_EXPANDED",
                              payload: { mealId: meal.id, expanded: !expanded },
                            })
                          }
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <span className="text-lg font-semibold flex items-center gap-2">
                          🍽️ {meal.name}
                          <Badge variant="secondary">Approved</Badge>
                        </span>
                        {leadMember ? (
                          <Badge variant="outline">Lead: {getMemberName(leadMember)}</Badge>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditMealId(meal.id)}
                        >
                          <Edit2 className="mr-1 h-4 w-4" /> Edit meal
                        </Button>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <EllipsisVertical className="mr-1 h-4 w-4" /> Actions
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 space-y-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" className="w-full justify-start">
                                  Cancel meal (remove)
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove meal</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will delete the meal and all of its ingredient rows.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogAction
                                    onClick={() => {
                                      dispatch({
                                        type: "CANCEL_MEAL",
                                        payload: { mealId: meal.id, mode: "remove" },
                                      });
                                      enqueueAction("cancel-meal", {
                                        mealId: meal.id,
                                        mode: "remove",
                                      });
                                    }}
                                  >
                                    Confirm
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" className="w-full justify-start">
                                  Flatten ingredients
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Flatten meal</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Ingredients will remain on the list as standalone items.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogAction
                                    onClick={() => {
                                      dispatch({
                                        type: "CANCEL_MEAL",
                                        payload: { mealId: meal.id, mode: "flatten" },
                                      });
                                      enqueueAction("cancel-meal", {
                                        mealId: meal.id,
                                        mode: "flatten",
                                      });
                                    }}
                                  >
                                    Flatten meal
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </CardHeader>
                    {expanded ? (
                      <CardContent className="space-y-4">
                        {meal.items.map((item) => {
                          const duplicates = duplicateMap.get(item.id) ?? [];
                          return (
                            <div
                              key={item.id}
                              className="rounded-lg border border-muted bg-card p-4"
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={item.purchased}
                                      onCheckedChange={(checked) => {
                                        const purchased = Boolean(checked);
                                        dispatch({
                                          type: "TOGGLE_PURCHASED",
                                          payload: { id: item.id, purchased },
                                        });
                                        enqueueAction("toggle-purchased", {
                                          itemId: item.id,
                                          purchased,
                                        });
                                      }}
                                    />
                                    <span className="font-medium">{item.name}</span>
                                    {item.quantityText ? (
                                      <span className="text-sm text-muted-foreground">
                                        {item.quantityText}
                                      </span>
                                    ) : null}
                                  </div>
                                  {item.notes ? (
                                    <p className="ml-6 text-sm text-muted-foreground">{item.notes}</p>
                                  ) : null}
                                  {duplicates.length > 0 ? (
                                    <div className="ml-6 mt-2 flex flex-wrap items-center gap-2">
                                      <Badge variant="outline">Possible duplicate</Badge>
                                      {duplicates.map((dup) => (
                                        <Button
                                          key={dup.id}
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            if (
                                              typeof window === "undefined" ||
                                              window.confirm(
                                                `Merge ${item.name} with ${dup.name}? This will keep one entry and remove the other.`,
                                              )
                                            ) {
                                              dispatch({
                                                type: "MERGE_ITEMS",
                                                payload: { keepId: item.id, removeId: dup.id },
                                              });
                                              enqueueAction("merge-items", {
                                                keepId: item.id,
                                                removeId: dup.id,
                                              });
                                            }
                                          }}
                                        >
                                          Merge with {dup.name}
                                        </Button>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <AssignMenu
                                    trigger={
                                      <Button variant="outline" size="sm">
                                        {getAssignmentLabel(item.assignedUserId, members, user)}
                                      </Button>
                                    }
                                    item={item}
                                    members={members}
                                    currentUser={user}
                                    onAssign={(assignedUserId) => {
                                      dispatch({
                                        type: "ASSIGN_ITEM",
                                        payload: { id: item.id, assignedUserId },
                                      });
                                      enqueueAction("assign-item", {
                                        itemId: item.id,
                                        assignedUserId,
                                      });
                                    }}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditItemId(item.id)}
                                  >
                                    <Edit2 className="mr-1 h-4 w-4" /> Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      if (
                                        typeof window === "undefined" ||
                                        window.confirm("Delete this ingredient?")
                                      ) {
                                        dispatch({ type: "DELETE_ITEM", payload: { id: item.id } });
                                        enqueueAction("delete-item", { itemId: item.id });
                                      }
                                    }}
                                  >
                                    <Trash2 className="mr-1 h-4 w-4" /> Delete
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    ) : null}
                  </Card>
                );
              })}

              {standaloneItems.map((item) => {
                const duplicates = duplicateMap.get(item.id) ?? [];
                return (
                  <div key={item.id} className="rounded-lg border border-muted bg-card p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={item.purchased}
                            onCheckedChange={(checked) => {
                              const purchased = Boolean(checked);
                              dispatch({
                                type: "TOGGLE_PURCHASED",
                                payload: { id: item.id, purchased },
                              });
                              enqueueAction("toggle-purchased", {
                                itemId: item.id,
                                purchased,
                              });
                            }}
                          />
                          <span className="font-medium">{item.name}</span>
                          {item.quantityText ? (
                            <span className="text-sm text-muted-foreground">{item.quantityText}</span>
                          ) : null}
                          {item.category ? (
                            <Badge variant="outline" className="ml-1">
                              {item.category}
                            </Badge>
                          ) : null}
                        </div>
                        {item.notes ? (
                          <p className="ml-6 text-sm text-muted-foreground">{item.notes}</p>
                        ) : null}
                        {duplicates.length > 0 ? (
                          <div className="ml-6 mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline">Possible duplicate</Badge>
                            {duplicates.map((dup) => (
                              <Button
                                key={dup.id}
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (
                                    typeof window === "undefined" ||
                                    window.confirm(
                                      `Merge ${item.name} with ${dup.name}? This will keep one entry and remove the other.`,
                                    )
                                  ) {
                                    dispatch({
                                      type: "MERGE_ITEMS",
                                      payload: { keepId: item.id, removeId: dup.id },
                                    });
                                    enqueueAction("merge-items", {
                                      keepId: item.id,
                                      removeId: dup.id,
                                    });
                                  }
                                }}
                              >
                                Merge with {dup.name}
                              </Button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <AssignMenu
                          trigger={
                            <Button variant="outline" size="sm">
                              {getAssignmentLabel(item.assignedUserId, members, user)}
                            </Button>
                          }
                          item={item}
                          members={members}
                          currentUser={user}
                          onAssign={(assignedUserId) => {
                            dispatch({
                              type: "ASSIGN_ITEM",
                              payload: { id: item.id, assignedUserId },
                            });
                            enqueueAction("assign-item", {
                              itemId: item.id,
                              assignedUserId,
                            });
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditItemId(item.id)}
                        >
                          <Edit2 className="mr-1 h-4 w-4" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (
                              typeof window === "undefined" ||
                              window.confirm("Delete this item?")
                            ) {
                              dispatch({ type: "DELETE_ITEM", payload: { id: item.id } });
                              enqueueAction("delete-item", { itemId: item.id });
                            }
                          }}
                        >
                          <Trash2 className="mr-1 h-4 w-4" /> Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                Nothing needed yet. Add items or propose a group meal.
              </CardContent>
            </Card>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h4 className="font-semibold">Recent activity</h4>
            </CardHeader>
            <CardContent className="space-y-3">
              {state.activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No updates yet.</p>
              ) : (
                state.activity.map((entry) => (
                  <div key={entry.id} className="rounded-md border border-muted p-3">
                    <p className="text-sm font-medium">{entry.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h4 className="font-semibold">Offline outbox</h4>
            </CardHeader>
            <CardContent className="space-y-3">
              {outbox.length === 0 ? (
                <p className="text-sm text-muted-foreground">All caught up.</p>
              ) : (
                outbox.slice(0, 10).map((entry) => (
                  <div key={entry.id} className="rounded-md border border-muted p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{entry.type}</p>
                      <Badge variant={entry.status === "pending" ? "destructive" : "secondary"}>
                        {entry.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <Button
        className="fixed bottom-6 right-6 z-40 shadow-lg md:hidden"
        size="lg"
        onClick={() => setIsAddDialogOpen(true)}
      >
        <CirclePlus className="mr-2 h-5 w-5" /> Add
      </Button>

      <AddItemDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddItem={handleAddItem}
        onProposeMeal={handleProposeMeal}
      />
      <EditItemDialog
        open={Boolean(editItemId)}
        onOpenChange={() => setEditItemId(null)}
        item={editItem}
        onSave={(updates) => {
          if (!editItem) return;
          dispatch({
            type: "UPDATE_ITEM",
            payload: { id: editItem.id, updates },
          });
          enqueueAction("update-item", { itemId: editItem.id, updates });
          setEditItemId(null);
        }}
      />
      <EditMealDialog
        open={Boolean(editMealId)}
        onOpenChange={() => setEditMealId(null)}
        meal={editMeal}
        members={members}
        onSave={({ name, leadUserId, ingredients }) => {
          if (!editMeal) return;
          dispatch({
            type: "UPDATE_MEAL",
            payload: { mealId: editMeal.id, name, leadUserId, ingredients },
          });
          enqueueAction("update-meal", {
            mealId: editMeal.id,
            name,
            leadUserId,
            ingredients,
          });
          setEditMealId(null);
        }}
      />
    </Fragment>
  );
}
