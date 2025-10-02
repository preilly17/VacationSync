import { FormEvent, useEffect, useMemo, useReducer, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { TripMember, User } from "@shared/schema";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Edit2,
  MessageCircle,
  Plus,
  Search,
  ThumbsUp,
  Trash2,
} from "lucide-react";

type TripMemberWithUser = TripMember & { user: User };

type GroceryItemRecord = {
  id: string;
  name: string;
  note?: string;
  purchased: boolean;
  createdAt: string;
  addedByUserId?: string;
  claimedByUserId?: string;
};

type MealCommentRecord = {
  id: string;
  authorUserId?: string;
  authorName: string;
  body: string;
  createdAt: string;
};

type GroupMealRecord = {
  id: string;
  name: string;
  ingredients: string[];
  status: "proposed" | "accepted" | "declined";
  upvotes: string[];
  createdAt: string;
  createdByUserId?: string;
  comments: MealCommentRecord[];
};

type GroceryState = {
  items: GroceryItemRecord[];
  meals: GroupMealRecord[];
};

type GroceryAction =
  | { type: "ADD_ITEM"; payload: GroceryItemRecord }
  | { type: "UPDATE_ITEM"; payload: { id: string; updates: Partial<GroceryItemRecord> } }
  | { type: "DELETE_ITEM"; payload: { id: string } }
  | { type: "TOGGLE_PURCHASED"; payload: { id: string; purchased: boolean } }
  | { type: "CLEAR_PURCHASED" }
  | { type: "ADD_MEAL"; payload: GroupMealRecord }
  | { type: "SET_MEAL_STATUS"; payload: { id: string; status: GroupMealRecord["status"] } }
  | { type: "TOGGLE_MEAL_UPVOTE"; payload: { id: string; userId?: string } }
  | { type: "ADD_MEAL_COMMENT"; payload: { id: string; comment: MealCommentRecord } }
  | { type: "MERGE_INGREDIENTS"; payload: { items: GroceryItemRecord[] } };

interface GroceryListProps {
  tripId: number;
  user?: User;
  members?: TripMemberWithUser[];
}

const STORAGE_KEY = "vacationsync:grocery-simple";

const defaultState: GroceryState = {
  items: [],
  meals: [],
};

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Math.random().toString(36).slice(2, 11)}`;
};

const normalizeName = (value: string) => value.trim().toLowerCase();

const getInitialState = (): GroceryState => {
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
      items: Array.isArray(parsed.items) ? parsed.items : [],
      meals: Array.isArray(parsed.meals) ? parsed.meals : [],
    } satisfies GroceryState;
  } catch (error) {
    console.error("Failed to load grocery list state", error);
    return defaultState;
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
        items: state.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      };
    }
    case "DELETE_ITEM": {
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.payload.id),
      };
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
    case "CLEAR_PURCHASED": {
      return { ...state, items: state.items.filter((item) => !item.purchased) };
    }
    case "ADD_MEAL": {
      return { ...state, meals: [...state.meals, action.payload] };
    }
    case "SET_MEAL_STATUS": {
      const { id, status } = action.payload;
      return {
        ...state,
        meals: state.meals.map((meal) => (meal.id === id ? { ...meal, status } : meal)),
      };
    }
    case "TOGGLE_MEAL_UPVOTE": {
      const { id, userId } = action.payload;
      if (!userId) {
        return state;
      }

      return {
        ...state,
        meals: state.meals.map((meal) => {
          if (meal.id !== id) {
            return meal;
          }

          const hasUpvoted = meal.upvotes.includes(userId);
          return {
            ...meal,
            upvotes: hasUpvoted
              ? meal.upvotes.filter((entry) => entry !== userId)
              : [...meal.upvotes, userId],
          };
        }),
      };
    }
    case "ADD_MEAL_COMMENT": {
      const { id, comment } = action.payload;
      return {
        ...state,
        meals: state.meals.map((meal) =>
          meal.id === id ? { ...meal, comments: [...meal.comments, comment] } : meal,
        ),
      };
    }
    case "MERGE_INGREDIENTS": {
      return { ...state, items: [...state.items, ...action.payload.items] };
    }
    default:
      return state;
  }
};

const getUserDisplayName = (user?: User | null) => {
  if (!user) {
    return "Trip member";
  }

  const first = user.firstName?.trim();
  const last = user.lastName?.trim();

  if (first && last) {
    return `${first} ${last}`;
  }

  if (first) {
    return first;
  }

  if (user.username) {
    return user.username;
  }

  return user.email || "Trip member";
};

export function GroceryList({ user, members = [] }: GroceryListProps) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addMode, setAddMode] = useState<"item" | "meal">("item");
  const [editingItem, setEditingItem] = useState<GroceryItemRecord | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showPurchased, setShowPurchased] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const memberLookup = useMemo(() => {
    const map = new Map<string, User>();
    for (const member of members) {
      map.set(member.userId, member.user);
    }
    return map;
  }, [members]);

  const currentUserName = useMemo(() => getUserDisplayName(user ?? null), [user]);

  const canDecideMeals = useMemo(() => {
    if (!user) {
      return false;
    }

    const membership = members.find((member) => member.userId === user.id);
    if (!membership) {
      return false;
    }

    return membership.role === "owner" || membership.role === "organizer";
  }, [members, user]);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) {
      return state.items;
    }

    const query = searchTerm.trim().toLowerCase();
    return state.items.filter((item) =>
      [item.name, item.note]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [searchTerm, state.items]);

  const activeItems = filteredItems.filter((item) => !item.purchased);
  const purchasedItems = filteredItems.filter((item) => item.purchased);

  const sortedMeals = useMemo(() => {
    return [...state.meals].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [state.meals]);

  const activeMeals = sortedMeals.filter((meal) => meal.status !== "declined");
  const declinedMeals = sortedMeals.filter((meal) => meal.status === "declined");

  const existingItemNames = useMemo(() => {
    const set = new Set<string>();
    for (const item of state.items) {
      set.add(normalizeName(item.name));
    }
    return set;
  }, [state.items]);

  const handleAddItem = (data: { name: string; note?: string; claimItem: boolean }) => {
    const newItem: GroceryItemRecord = {
      id: generateId(),
      name: data.name.trim(),
      note: data.note?.trim() || undefined,
      purchased: false,
      createdAt: new Date().toISOString(),
      addedByUserId: user?.id,
      claimedByUserId: data.claimItem && user ? user.id : undefined,
    };

    dispatch({ type: "ADD_ITEM", payload: newItem });
    setIsAddDialogOpen(false);
  };

  const handleUpdateItem = (id: string, data: { name: string; note?: string; claimItem: boolean }) => {
    dispatch({
      type: "UPDATE_ITEM",
      payload: {
        id,
        updates: {
          name: data.name.trim(),
          note: data.note?.trim() || undefined,
          claimedByUserId: data.claimItem && user ? user.id : undefined,
        },
      },
    });

    setIsEditDialogOpen(false);
    setEditingItem(null);
  };

  const handleDeleteItem = (id: string) => {
    dispatch({ type: "DELETE_ITEM", payload: { id } });
  };

  const handleTogglePurchased = (item: GroceryItemRecord, purchased: boolean) => {
    dispatch({ type: "TOGGLE_PURCHASED", payload: { id: item.id, purchased } });
  };

  const handleClearPurchased = () => {
    dispatch({ type: "CLEAR_PURCHASED" });
    toast({ title: "Purchased items cleared" });
  };

  const handleAddMeal = (data: { name: string; ingredients: string[] }) => {
    const meal: GroupMealRecord = {
      id: generateId(),
      name: data.name.trim(),
      ingredients: data.ingredients.map((ingredient) => ingredient.trim()).filter(Boolean),
      status: "proposed",
      upvotes: [],
      createdAt: new Date().toISOString(),
      createdByUserId: user?.id,
      comments: [],
    };

    dispatch({ type: "ADD_MEAL", payload: meal });
    setIsAddDialogOpen(false);
    setAddMode("item");
  };

  const handleToggleMealUpvote = (mealId: string) => {
    dispatch({ type: "TOGGLE_MEAL_UPVOTE", payload: { id: mealId, userId: user?.id } });
  };

  const handleSetMealStatus = (mealId: string, status: GroupMealRecord["status"]) => {
    dispatch({ type: "SET_MEAL_STATUS", payload: { id: mealId, status } });
  };

  const handleAddMealComment = (mealId: string, body: string) => {
    const comment: MealCommentRecord = {
      id: generateId(),
      body,
      authorUserId: user?.id,
      authorName: currentUserName,
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: "ADD_MEAL_COMMENT", payload: { id: mealId, comment } });
  };

  const handleMergeIngredients = (meal: GroupMealRecord) => {
    const additions: GroceryItemRecord[] = [];
    const seen = new Set(existingItemNames);

    for (const ingredient of meal.ingredients) {
      const normalized = normalizeName(ingredient);
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      additions.push({
        id: generateId(),
        name: ingredient,
        purchased: false,
        createdAt: new Date().toISOString(),
        addedByUserId: meal.createdByUserId,
      });
    }

    if (additions.length > 0) {
      dispatch({ type: "MERGE_INGREDIENTS", payload: { items: additions } });
      toast({ title: "Ingredients added to Items", description: `${additions.length} new item${additions.length === 1 ? "" : "s"} added.` });
    } else {
      toast({
        title: "All ingredients already on the list",
        description: "Nothing new to add.",
      });
    }
  };

  const renderItemRow = (item: GroceryItemRecord) => {
    const addedByName = item.addedByUserId
      ? getUserDisplayName(memberLookup.get(item.addedByUserId) ?? (user?.id === item.addedByUserId ? user ?? null : null))
      : undefined;

    const claimedByName = item.claimedByUserId
      ? getUserDisplayName(memberLookup.get(item.claimedByUserId) ?? (user?.id === item.claimedByUserId ? user ?? null : null))
      : undefined;

    return (
      <div
        key={item.id}
        className={cn(
          "group flex items-start gap-3 rounded-md border border-transparent bg-transparent px-3 py-2 transition-all duration-200",
          "hover:border-sky-500/30 hover:bg-sky-500/5 dark:hover:border-sky-500/30 dark:hover:bg-sky-500/10",
          "focus-within:border-sky-500/30 focus-within:bg-sky-500/5 dark:focus-within:border-sky-500/30 dark:focus-within:bg-sky-500/10",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-sky-500",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-background focus-within:ring-sky-500",
          item.purchased
            ? "border-sky-500/40 bg-sky-500/10 dark:border-sky-500/40 dark:bg-sky-500/20"
            : undefined,
        )}
      >
        <Checkbox
          checked={item.purchased}
          onCheckedChange={(checked) => handleTogglePurchased(item, Boolean(checked))}
          aria-label={`Mark ${item.name} as ${item.purchased ? "not purchased" : "purchased"}`}
          className="mt-1"
        />
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "font-medium",
                item.purchased && "text-muted-foreground line-through",
              )}
            >
              {item.name}
            </span>
            {item.note && (
              <span className="text-sm text-muted-foreground">{item.note}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {addedByName && (
              <Badge
                variant="outline"
                className="border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-700 shadow-sm dark:border-sky-500/40 dark:bg-sky-500/20 dark:text-sky-100"
              >
                Added by {addedByName}
              </Badge>
            )}
            {claimedByName && (
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-500/25 dark:text-emerald-100"
              >
                {claimedByName === currentUserName ? "You're buying this" : `${claimedByName} will buy this`}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => {
              setEditingItem(item);
              setIsEditDialogOpen(true);
            }}
          >
            <Edit2 className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-destructive">
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove item</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove “{item.name}” from the grocery list?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDeleteItem(item.id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className="relative overflow-hidden rounded-3xl border border-border/70 bg-indigo-500/5 p-4 shadow-[0_24px_48px_-32px_rgba(15,23,42,0.5)] backdrop-blur-sm sm:p-6 dark:border-white/10 dark:bg-indigo-500/15 dark:shadow-[0_32px_56px_-30px_rgba(0,0,0,0.7)]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[6px] bg-gradient-to-r from-[#f97316] via-[#f472b6] to-[#6366f1] opacity-80"
        />
        <div className="space-y-10">
          <div className="flex flex-col gap-2 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div>
              <h1 className="mb-4 text-3xl font-semibold leading-[1.1]">Grocery List</h1>
              <p className="text-muted-foreground leading-[1.5]">One shared list for personal items and group meals.</p>
            </div>
            <Button
              onClick={() => {
                setAddMode("item");
                setIsAddDialogOpen(true);
              }}
              className="w-full gap-2 sm:ml-auto sm:w-auto"
            >
              <Plus className="h-4 w-4" /> Add an item
            </Button>
          </div>

          <section
            className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-[0_24px_48px_-34px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_26px_52px_-30px_rgba(15,23,42,0.55)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/60"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[6px] bg-gradient-to-r from-[#f97316] via-[#f472b6] to-[#6366f1] opacity-80 transition-opacity duration-300 group-hover:opacity-100"
            />
            <div className="px-4 pb-4 pt-[calc(1rem+6px)]">
              <header>
                <h2 className="mb-3 text-xl font-semibold leading-[1.22]">Items</h2>
              </header>
              <div className="relative mb-3 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search items…"
                  className="pl-9"
                />
              </div>

              {activeItems.length === 0 && purchasedItems.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/60 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
                  Nothing needed yet. Add an item or propose a group meal.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeItems.map((item) => renderItemRow(item))}
                </div>
              )}

              {purchasedItems.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-muted/40">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/60"
                    onClick={() => setShowPurchased((previous) => !previous)}
                  >
                    <span>
                      Purchased <span className="text-muted-foreground">({purchasedItems.length})</span>
                    </span>
                    {showPurchased ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {showPurchased && (
                    <div className="space-y-3 border-t border-border/50 bg-background/40 px-4 py-3">
                      {purchasedItems.map((item) => renderItemRow(item))}
                    </div>
                  )}
                  <div className="border-t border-border/50 bg-muted/50 px-4 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={handleClearPurchased}>
                      Clear all
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <Separator />

          <section
            className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-[0_24px_48px_-34px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_26px_52px_-30px_rgba(15,23,42,0.55)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/60"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[6px] bg-gradient-to-r from-[#f97316] via-[#f472b6] to-[#6366f1] opacity-80 transition-opacity duration-300 group-hover:opacity-100"
            />
            <div className="px-4 pb-4 pt-[calc(1rem+6px)]">
              <header>
                <h2 className="text-xl font-semibold leading-[1.22]">Group Meals</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-[1.5]">Propose dinners and vote together.</p>
              </header>

              {activeMeals.length === 0 && declinedMeals.length === 0 ? (
                <div className="mt-3 rounded-md border border-dashed border-border/60 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
                  No meal ideas yet. Propose your first group dinner.
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {activeMeals.map((meal) => (
                    <GroupMealCard
                      key={meal.id}
                      meal={meal}
                      currentUserId={user?.id}
                      currentUserName={currentUserName}
                      onToggleUpvote={() => handleToggleMealUpvote(meal.id)}
                      onSetStatus={(status) => handleSetMealStatus(meal.id, status)}
                      onAddComment={(comment) => handleAddMealComment(meal.id, comment)}
                      onMergeIngredients={() => handleMergeIngredients(meal)}
                      canDecide={canDecideMeals}
                      getUserName={(userId) => {
                        if (!userId) {
                          return "Trip member";
                        }
                        return userId === user?.id
                          ? currentUserName
                          : getUserDisplayName(memberLookup.get(userId) ?? null);
                      }}
                      existingItemNames={existingItemNames}
                    />
                  ))}
                </div>
              )}

              {declinedMeals.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-muted/40">
                  <details>
                    <summary className="flex cursor-pointer items-baseline justify-between gap-3 px-4 py-3 text-sm font-medium leading-[1.22]">
                      Declined <span className="text-muted-foreground">({declinedMeals.length})</span>
                    </summary>
                    <div className="space-y-3 border-t border-border/50 bg-background/40 px-4 py-3">
                      {declinedMeals.map((meal) => (
                        <GroupMealCard
                          key={meal.id}
                          meal={meal}
                          currentUserId={user?.id}
                          currentUserName={currentUserName}
                          onToggleUpvote={() => handleToggleMealUpvote(meal.id)}
                          onSetStatus={(status) => handleSetMealStatus(meal.id, status)}
                          onAddComment={(comment) => handleAddMealComment(meal.id, comment)}
                          onMergeIngredients={() => handleMergeIngredients(meal)}
                          canDecide={canDecideMeals}
                          getUserName={(userId) => {
                            if (!userId) {
                              return "Trip member";
                            }
                            return userId === user?.id
                              ? currentUserName
                              : getUserDisplayName(memberLookup.get(userId) ?? null);
                          }}
                          existingItemNames={existingItemNames}
                        />
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          </section>

          <AddItemDialog
            mode={addMode}
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            onModeChange={setAddMode}
            onAddItem={handleAddItem}
            onAddMeal={handleAddMeal}
          />

          <EditItemDialog
            item={editingItem}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onSubmit={(values) => editingItem && handleUpdateItem(editingItem.id, values)}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "item" | "meal";
  onModeChange: (mode: "item" | "meal") => void;
  onAddItem: (data: { name: string; note?: string; claimItem: boolean }) => void;
  onAddMeal: (data: { name: string; ingredients: string[] }) => void;
}

const AddItemDialog = ({
  open,
  onOpenChange,
  mode,
  onModeChange,
  onAddItem,
  onAddMeal,
}: AddItemDialogProps) => {
  const [itemName, setItemName] = useState("");
  const [itemNote, setItemNote] = useState("");
  const [claimItem, setClaimItem] = useState(false);
  const [mealName, setMealName] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");

  useEffect(() => {
    if (!open) {
      setItemName("");
      setItemNote("");
      setClaimItem(false);
      setMealName("");
      setIngredientsText("");
      onModeChange("item");
    }
  }, [open, onModeChange]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (mode === "item") {
      if (!itemName.trim()) {
        return;
      }

      onAddItem({ name: itemName, note: itemNote, claimItem });
    } else {
      if (!mealName.trim()) {
        return;
      }

      const ingredients = ingredientsText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      onAddMeal({ name: mealName, ingredients });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-[520px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add an item</DialogTitle>
            <DialogDescription>
              Add a single item or propose a group meal for everyone to review.
            </DialogDescription>
          </DialogHeader>

          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(value) => {
              if (value === "item" || value === "meal") {
                onModeChange(value);
              }
            }}
            className="grid grid-cols-2 gap-2"
            aria-label="Choose what to add"
          >
            <ToggleGroupItem value="item" aria-label="Add individual item" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Individual item
            </ToggleGroupItem>
            <ToggleGroupItem value="meal" aria-label="Propose group meal" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              Group meal
            </ToggleGroupItem>
          </ToggleGroup>

          {mode === "item" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="item-name">Item name</Label>
                <Input
                  id="item-name"
                  value={itemName}
                  onChange={(event) => setItemName(event.target.value)}
                  placeholder="Milk"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-note">Note (optional)</Label>
                <Input
                  id="item-note"
                  value={itemNote}
                  onChange={(event) => setItemNote(event.target.value)}
                  placeholder="2% preferred"
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="space-y-1">
                  <Label htmlFor="claim-item" className="text-sm font-medium">
                    I\'ll buy this
                  </Label>
                  <p className="text-xs text-muted-foreground">Let everyone know you\'re grabbing it.</p>
                </div>
                <Switch id="claim-item" checked={claimItem} onCheckedChange={(checked) => setClaimItem(Boolean(checked))} />
              </div>
              <DialogFooter>
                <Button type="submit">Add item</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meal-name">Meal name</Label>
                <Input
                  id="meal-name"
                  value={mealName}
                  onChange={(event) => setMealName(event.target.value)}
                  placeholder="BBQ Night"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meal-ingredients">Ingredients</Label>
                <Textarea
                  id="meal-ingredients"
                  value={ingredientsText}
                  onChange={(event) => setIngredientsText(event.target.value)}
                  placeholder="Ground beef\nBuns\nCheddar…"
                  rows={6}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit">Propose meal</Button>
              </DialogFooter>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface EditItemDialogProps {
  item: GroceryItemRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; note?: string; claimItem: boolean }) => void;
}

const EditItemDialog = ({ item, open, onOpenChange, onSubmit }: EditItemDialogProps) => {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [claimItem, setClaimItem] = useState(false);

  useEffect(() => {
    if (item && open) {
      setName(item.name);
      setNote(item.note ?? "");
      setClaimItem(Boolean(item.claimedByUserId));
    }
  }, [item, open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item) {
      return;
    }

    if (!name.trim()) {
      return;
    }

    onSubmit({ name, note, claimItem });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit item</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-item-name">Item name</Label>
            <Input
              id="edit-item-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-item-note">Note</Label>
            <Input
              id="edit-item-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="edit-claim-item" className="text-sm font-medium">
                I\'ll buy this
              </Label>
              <p className="text-xs text-muted-foreground">Toggle to claim responsibility.</p>
            </div>
            <Switch
              id="edit-claim-item"
              checked={claimItem}
              onCheckedChange={(checked) => setClaimItem(Boolean(checked))}
            />
          </div>
          <DialogFooter>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface GroupMealCardProps {
  meal: GroupMealRecord;
  currentUserId?: string;
  currentUserName: string;
  canDecide: boolean;
  onToggleUpvote: () => void;
  onSetStatus: (status: GroupMealRecord["status"]) => void;
  onAddComment: (comment: string) => void;
  onMergeIngredients: () => void;
  getUserName: (userId?: string) => string;
  existingItemNames: Set<string>;
}

const GroupMealCard = ({
  meal,
  currentUserId,
  currentUserName,
  canDecide,
  onToggleUpvote,
  onSetStatus,
  onAddComment,
  onMergeIngredients,
  getUserName,
  existingItemNames,
}: GroupMealCardProps) => {
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState("");

  const hasUpvoted = currentUserId ? meal.upvotes.includes(currentUserId) : false;
  const upvoteNames = meal.upvotes.map((userId) => getUserName(userId));
  const allIngredientsAdded = meal.ingredients.every((ingredient) =>
    existingItemNames.has(normalizeName(ingredient)),
  );

  const handleSubmitComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!commentText.trim()) {
      return;
    }

    onAddComment(commentText.trim());
    setCommentText("");
    setIsCommentOpen(true);
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-[0_24px_48px_-34px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_26px_52px_-30px_rgba(15,23,42,0.55)] focus-within:-translate-y-[3px] focus-within:shadow-[0_26px_52px_-30px_rgba(15,23,42,0.55)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/50",
        meal.status === "accepted" && "border-emerald-300 bg-emerald-50/40",
        meal.status === "declined" && "border-destructive/40 bg-destructive/5",
      )}
    >
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{meal.name}</h3>
            {meal.status !== "proposed" && (
              <Badge variant={meal.status === "accepted" ? "default" : "outline"} className="uppercase tracking-wide">
                {meal.status === "accepted" ? "Accepted" : "Declined"}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {meal.ingredients.map((ingredient) => {
              const normalized = normalizeName(ingredient);
              const alreadyAdded = existingItemNames.has(normalized);
              return (
                <Badge
                  key={ingredient}
                  variant="outline"
                  className={cn(
                    "flex items-center gap-1",
                    alreadyAdded && "border-emerald-300 bg-emerald-100/60 text-emerald-900",
                  )}
                >
                  {ingredient}
                  {alreadyAdded && <Check className="h-3 w-3" aria-hidden />}
                </Badge>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={hasUpvoted ? "secondary" : "outline"}
                size="sm"
                onClick={onToggleUpvote}
                className="gap-1"
              >
                <ThumbsUp className="h-4 w-4" /> {meal.upvotes.length}
              </Button>
            </TooltipTrigger>
            {meal.upvotes.length > 0 && (
              <TooltipContent>
                <p className="max-w-[220px] text-xs">
                  {upvoteNames.join(", ")}
                </p>
              </TooltipContent>
            )}
          </Tooltip>
          <Button
            variant={isCommentOpen ? "secondary" : "outline"}
            size="sm"
            onClick={() => setIsCommentOpen((previous) => !previous)}
            className="gap-1"
          >
            <MessageCircle className="h-4 w-4" />
            Comment
            {meal.comments.length > 0 && <span className="text-xs text-muted-foreground">({meal.comments.length})</span>}
          </Button>
          {canDecide && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  Decide
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onSetStatus("accepted")}>Accept</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetStatus("proposed")}>Mark as proposed</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetStatus("declined")} className="text-destructive">
                  Decline
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {meal.status === "accepted" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onMergeIngredients}
              disabled={allIngredientsAdded}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              {allIngredientsAdded ? "All ingredients added" : "Add ingredients to list"}
            </Button>
            {allIngredientsAdded && (
              <span className="text-xs text-muted-foreground">Everything from this meal is already in Items.</span>
            )}
          </div>
        )}

        {isCommentOpen && (
          <div className="space-y-4">
            <div className="space-y-3">
              {meal.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
              ) : (
                meal.comments.map((comment) => (
                  <div key={comment.id} className="rounded-md border border-border/60 bg-background px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{comment.authorName}</span>
                    </div>
                    <p className="mt-1 text-sm">{comment.body}</p>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleSubmitComment} className="space-y-2">
              <Label htmlFor={`comment-${meal.id}`} className="text-sm font-medium">
                Add a comment
              </Label>
              <Textarea
                id={`comment-${meal.id}`}
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Share thoughts or questions"
                rows={3}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  Post comment
                </Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
      {meal.createdByUserId && (
        <CardFooter className="text-xs text-muted-foreground">
          Proposed by {meal.createdByUserId === currentUserId ? currentUserName : getUserName(meal.createdByUserId)}
        </CardFooter>
      )}
    </Card>
  );
};

