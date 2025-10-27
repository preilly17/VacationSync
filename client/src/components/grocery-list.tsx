import { FormEvent, useEffect, useMemo, useReducer, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type {
  GroceryItemParticipant,
  GroceryItemWithDetails,
  GroceryNotes,
  TripMember,
  User,
} from "@shared/schema";
import {
  Check,
  Edit2,
  MessageCircle,
  Plus,
  Search,
  ThumbsUp,
  Trash2,
} from "lucide-react";

type TripMemberWithUser = TripMember & { user: User };

type GroceryItemRecord = {
  id: number;
  name: string;
  note?: string;
  purchased: boolean;
  createdAt: string | Date | null;
  addedByUserId?: string;
  addedByUser?: User;
  participants: (GroceryItemParticipant & { user: User })[];
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

type MealAction =
  | { type: "ADD_MEAL"; payload: GroupMealRecord }
  | { type: "SET_MEAL_STATUS"; payload: { id: string; status: GroupMealRecord["status"] } }
  | { type: "TOGGLE_MEAL_UPVOTE"; payload: { id: string; userId?: string } }
  | { type: "ADD_MEAL_COMMENT"; payload: { id: string; comment: MealCommentRecord } };

interface GroceryListProps {
  tripId: number;
  user?: User;
  members?: TripMemberWithUser[];
}

const defaultMeals: GroupMealRecord[] = [];

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Math.random().toString(36).slice(2, 11)}`;
};

const normalizeName = (value: string) => value.trim().toLowerCase();

const INGREDIENT_DELIMITER_REGEX = /[\r\n,;]+/;
const BULLET_PREFIX_REGEX = /^[\s]*[-–—*•·\u2022]\s*/;
const NUMBERED_PREFIX_REGEX = /^[\s]*\d+[.)]\s*/;

const sanitizeIngredientValue = (value: string): string => {
  let result = value.trim();
  if (!result) {
    return "";
  }

  result = result.replace(BULLET_PREFIX_REGEX, "").trim();
  result = result.replace(NUMBERED_PREFIX_REGEX, "").trim();

  return result;
};

const normalizeMealIngredients = (values: string[]): string[] => {
  return values
    .flatMap((value) =>
      value
        .split(INGREDIENT_DELIMITER_REGEX)
        .map((part) => sanitizeIngredientValue(part))
        .filter(Boolean),
    )
    .filter(Boolean);
};

const extractNoteText = (notes: GroceryNotes | null | undefined): string | undefined => {
  if (!notes) {
    return undefined;
  }

  if (typeof notes === "string") {
    return notes.trim() || undefined;
  }

  if (typeof notes === "object" && "text" in notes && typeof notes.text === "string") {
    return notes.text.trim() || undefined;
  }

  return undefined;
};

const mapGroceryItemToRecord = (item: GroceryItemWithDetails): GroceryItemRecord => {
  const baseAddedBy = (item as unknown as { addedBy?: unknown }).addedBy;
  let addedByUser: User | undefined;
  let addedByUserId: string | undefined;

  if (baseAddedBy && typeof baseAddedBy === "object") {
    addedByUser = baseAddedBy as User;
    addedByUserId = addedByUser.id;
  } else if (typeof baseAddedBy === "string") {
    addedByUserId = baseAddedBy;
  }

  return {
    id: item.id,
    name: item.item,
    note: extractNoteText(item.notes),
    purchased: item.isPurchased,
    createdAt: item.createdAt ?? null,
    addedByUserId,
    addedByUser,
    participants: item.participants,
  } satisfies GroceryItemRecord;
};

const reducer = (state: GroupMealRecord[], action: MealAction): GroupMealRecord[] => {
  switch (action.type) {
    case "ADD_MEAL": {
      return [...state, action.payload];
    }
    case "SET_MEAL_STATUS": {
      const { id, status } = action.payload;
      return state.map((meal) => (meal.id === id ? { ...meal, status } : meal));
    }
    case "TOGGLE_MEAL_UPVOTE": {
      const { id, userId } = action.payload;
      if (!userId) {
        return state;
      }

      return state.map((meal) => {
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
      });
    }
    case "ADD_MEAL_COMMENT": {
      const { id, comment } = action.payload;
      return state.map((meal) =>
        meal.id === id ? { ...meal, comments: [...meal.comments, comment] } : meal,
      );
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

export function GroceryList({ tripId, user, members = [] }: GroceryListProps) {
  const [meals, dispatch] = useReducer(reducer, defaultMeals);
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addMode, setAddMode] = useState<"item" | "meal">("item");
  const [editingItem, setEditingItem] = useState<GroceryItemRecord | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isClearingPurchased, setIsClearingPurchased] = useState(false);
  const { toast } = useToast();

  const groceryQueryKey = [`/api/trips/${tripId}/groceries`] as const;

  const {
    data: groceryItemsData = [],
    isLoading: isLoadingGroceries,
    isError: isGroceriesError,
    error: groceriesError,
  } = useQuery<GroceryItemWithDetails[]>({
    queryKey: groceryQueryKey,
  });

  const groceryItems = useMemo(
    () => groceryItemsData.map((item) => mapGroceryItemToRecord(item)),
    [groceryItemsData],
  );

  const handleUnauthorized = () => {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/login";
    }, 500);
  };

  const handleMutationError = (error: unknown, fallbackMessage: string) => {
    if (isUnauthorizedError(error as Error)) {
      handleUnauthorized();
      return;
    }

    toast({
      title: "Something went wrong",
      description: fallbackMessage,
      variant: "destructive",
    });
  };

  const invalidateGroceries = () => {
    void queryClient.invalidateQueries({ queryKey: groceryQueryKey });
  };

  useEffect(() => {
    if (isGroceriesError && isUnauthorizedError(groceriesError as Error)) {
      handleUnauthorized();
    }
  }, [isGroceriesError, groceriesError]);

  type CreateItemInput = {
    name: string;
    note?: string;
    claimItem: boolean;
    showSuccessToast?: boolean;
  };

  const createItemMutation = useMutation({
    mutationFn: async ({ name, note, claimItem }: CreateItemInput) => {
      const trimmedName = name.trim();
      const trimmedNote = note?.trim();

      const response = await apiRequest(`/api/trips/${tripId}/groceries`, {
        method: "POST",
        body: {
          item: trimmedName,
          category: "general",
          notes: trimmedNote && trimmedNote.length > 0 ? trimmedNote : null,
        },
      });

      const created = (await response.json()) as { id?: number };

      if (claimItem && created?.id) {
        await apiRequest(`/api/groceries/${created.id}/participate`, {
          method: "POST",
        });
      }

      return created;
    },
    onSuccess: (_data, variables) => {
      invalidateGroceries();
      if (variables?.showSuccessToast !== false) {
        toast({
          title: "Item added!",
          description: "The grocery item has been added to the list.",
        });
      }
      if (isAddDialogOpen) {
        setIsAddDialogOpen(false);
        setAddMode("item");
      }
    },
    onError: (error) => {
      handleMutationError(error, "Failed to add grocery item. Please try again.");
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      name,
      note,
    }: {
      itemId: number;
      name?: string;
      note?: string | null;
    }) => {
      const payload: Record<string, unknown> = {};

      if (name !== undefined) {
        payload.item = name.trim();
      }

      if (note !== undefined) {
        const trimmed = note?.trim();
        payload.notes = trimmed && trimmed.length > 0 ? trimmed : null;
      }

      if (Object.keys(payload).length === 0) {
        return;
      }

      await apiRequest(`/api/groceries/${itemId}`, {
        method: "PATCH",
        body: payload,
      });
    },
    onSuccess: () => {
      invalidateGroceries();
    },
    onError: (error) => {
      handleMutationError(error, "Failed to update grocery item. Please try again.");
    },
  });

  const togglePurchasedMutation = useMutation({
    mutationFn: async ({ itemId, purchased }: { itemId: number; purchased: boolean }) => {
      await apiRequest(`/api/groceries/${itemId}/purchase`, {
        method: "PATCH",
        body: { isPurchased: purchased },
      });
    },
    onSuccess: () => {
      invalidateGroceries();
    },
    onError: (error) => {
      handleMutationError(error, "Failed to update item status. Please try again.");
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest(`/api/groceries/${itemId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      invalidateGroceries();
      toast({
        title: "Item removed",
        description: "The grocery item has been deleted.",
      });
    },
    onError: (error) => {
      handleMutationError(error, "Failed to delete grocery item. Please try again.");
    },
  });

  const toggleParticipationMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest(`/api/groceries/${itemId}/participate`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      invalidateGroceries();
    },
    onError: (error) => {
      handleMutationError(error, "Failed to update participation. Please try again.");
    },
  });

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
      return groceryItems;
    }

    const query = searchTerm.trim().toLowerCase();
    return groceryItems.filter((item) =>
      [item.name, item.note]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [searchTerm, groceryItems]);

  const purchasedItems = useMemo(
    () => filteredItems.filter((item) => item.purchased),
    [filteredItems],
  );
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((itemA, itemB) => {
      if (itemA.purchased === itemB.purchased) {
        return 0;
      }

      return itemA.purchased ? 1 : -1;
    });
  }, [filteredItems]);

  const sortedMeals = useMemo(() => {
    return [...meals].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [meals]);

  const activeMeals = sortedMeals.filter((meal) => meal.status !== "declined");
  const declinedMeals = sortedMeals.filter((meal) => meal.status === "declined");

  const existingItemNames = useMemo(() => {
    const set = new Set<string>();
    for (const item of groceryItems) {
      set.add(normalizeName(item.name));
    }
    return set;
  }, [groceryItems]);

  const handleAddItem = (data: { name: string; note?: string; claimItem: boolean }) => {
    if (!data.name.trim()) {
      return;
    }

    createItemMutation.mutate({ ...data, showSuccessToast: true });
  };

  const handleUpdateItem = async (
    item: GroceryItemRecord,
    data: { name: string; note?: string; claimItem: boolean },
  ) => {
    const trimmedName = data.name.trim();
    const trimmedNote = data.note?.trim();
    const nameChanged = trimmedName !== item.name;
    const previousNote = item.note ?? "";
    const nextNote = trimmedNote ?? "";
    const noteChanged = previousNote !== nextNote;
    const shouldClaim = Boolean(data.claimItem);
    const currentUserId = user?.id;
    const isCurrentlyClaimedByUser = currentUserId
      ? item.participants.some((participant) => participant.userId === currentUserId)
      : false;

    try {
      if (nameChanged || noteChanged) {
        await updateItemMutation.mutateAsync({
          itemId: item.id,
          name: nameChanged ? trimmedName : undefined,
          note: noteChanged ? trimmedNote ?? null : undefined,
        });
      }

      if (currentUserId && shouldClaim !== isCurrentlyClaimedByUser) {
        await toggleParticipationMutation.mutateAsync(item.id);
      }

      if (nameChanged || noteChanged || (currentUserId && shouldClaim !== isCurrentlyClaimedByUser)) {
        toast({
          title: "Item updated",
          description: "The grocery item was updated successfully.",
        });
      }

      setIsEditDialogOpen(false);
      setEditingItem(null);
    } catch {
      // Errors are handled by the individual mutations.
    }
  };

  const handleDeleteItem = (id: number) => {
    deleteItemMutation.mutate(id);
  };

  const handleTogglePurchased = (item: GroceryItemRecord, purchased: boolean) => {
    togglePurchasedMutation.mutate({ itemId: item.id, purchased });
  };

  const handleClearPurchased = async () => {
    const purchasedItemsToClear = groceryItems.filter((item) => item.purchased);
    if (purchasedItemsToClear.length === 0) {
      toast({
        title: "No purchased items",
        description: "There are no purchased items to clear.",
      });
      return;
    }

    setIsClearingPurchased(true);
    try {
      await Promise.all(
        purchasedItemsToClear.map((item) =>
          apiRequest(`/api/groceries/${item.id}`, {
            method: "DELETE",
          }),
        ),
      );

      invalidateGroceries();
      toast({ title: "Purchased items cleared" });
    } catch (error) {
      handleMutationError(error, "Failed to clear purchased items. Please try again.");
    } finally {
      setIsClearingPurchased(false);
    }
  };

  const handleAddMeal = (data: { name: string; ingredients: string[] }) => {
    const normalizedIngredients = normalizeMealIngredients(data.ingredients);
    if (normalizedIngredients.length === 0) {
      return;
    }

    const meal: GroupMealRecord = {
      id: generateId(),
      name: data.name.trim(),
      ingredients: normalizedIngredients,
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

  const handleMergeIngredients = async (meal: GroupMealRecord) => {
    const additions: string[] = [];
    const mealIngredients = normalizeMealIngredients(meal.ingredients);
    const seen = new Set(existingItemNames);

    for (const ingredient of mealIngredients) {
      const normalized = normalizeName(ingredient);
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      additions.push(ingredient);
    }

    if (additions.length > 0) {
      try {
        for (const ingredient of additions) {
          await createItemMutation.mutateAsync({
            name: ingredient,
            note: undefined,
            claimItem: false,
            showSuccessToast: false,
          });
        }

        toast({
          title: "Ingredients added to Items",
          description: `${additions.length} new item${additions.length === 1 ? "" : "s"} added.`,
        });
      } catch (error) {
        handleMutationError(error, "Failed to add ingredients to the list. Please try again.");
      }
    } else {
      toast({
        title: "All ingredients already on the list",
        description: "Nothing new to add.",
      });
    }
  };

  const handleToggleMealUpvote = (mealId: string) => {
    dispatch({ type: "TOGGLE_MEAL_UPVOTE", payload: { id: mealId, userId: user?.id } });
  };

  const handleSetMealStatus = (mealId: string, status: GroupMealRecord["status"]) => {
    const meal = meals.find((entry) => entry.id === mealId);
    dispatch({ type: "SET_MEAL_STATUS", payload: { id: mealId, status } });

    if (status === "accepted" && meal && meal.status !== "accepted") {
      void handleMergeIngredients(meal);
    }
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

  const renderItemRow = (item: GroceryItemRecord) => {
    const addedByName = (() => {
      if (item.addedByUser) {
        return getUserDisplayName(item.addedByUser);
      }

      if (item.addedByUserId) {
        const fallbackUser =
          memberLookup.get(item.addedByUserId) ??
          (user?.id === item.addedByUserId ? user ?? null : null);
        return getUserDisplayName(fallbackUser ?? null);
      }

      return undefined;
    })();

    const participantNames = item.participants.map((participant) => {
      const participantUser =
        participant.user ??
        memberLookup.get(participant.userId) ??
        (user?.id === participant.userId ? user ?? null : null);

      return getUserDisplayName(participantUser ?? null);
    });

    const currentUserIsParticipant = user
      ? item.participants.some((participant) => participant.userId === user.id)
      : false;

    const otherParticipantNames = user
      ? item.participants
          .filter((participant) => participant.userId !== user.id)
          .map((participant) => {
            const participantUser =
              participant.user ??
              memberLookup.get(participant.userId) ??
              (user?.id === participant.userId ? user ?? null : null);

            return getUserDisplayName(participantUser ?? null);
          })
      : participantNames;

    const participantLabel = participantNames.length > 0
      ? currentUserIsParticipant
        ? otherParticipantNames.length > 0
          ? `You're buying this with ${otherParticipantNames.join(", ")}`
          : "You're buying this"
        : `${participantNames.join(", ")} ${participantNames.length === 1 ? "will buy this" : "will buy these"}`
      : undefined;

    return (
      <div
        key={item.id}
        className={cn(
          "group flex items-start gap-3 rounded-xl border border-border/60 bg-white px-4 py-3 shadow-sm transition-all duration-200 dark:border-white/10 dark:bg-slate-950",
          "hover:border-sky-500/40 hover:bg-sky-50 hover:shadow-md dark:hover:border-sky-500/40 dark:hover:bg-sky-900/40",
          "focus-within:border-sky-500/50 focus-within:bg-sky-50 focus-within:shadow-md dark:focus-within:border-sky-500/50 dark:focus-within:bg-sky-900/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-sky-500 focus-within:ring-offset-2 focus-within:ring-offset-background",
          item.purchased
            ? "border-sky-500/50 bg-sky-50 dark:border-sky-500/50 dark:bg-sky-900/50"
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
            {participantLabel && (
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-500/25 dark:text-emerald-100"
              >
                {participantLabel}
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
        className="relative overflow-hidden rounded-[2.75rem] border border-border/70 bg-gradient-to-br from-indigo-500/25 via-sky-500/15 to-transparent p-[1.5px] shadow-[0_24px_48px_-32px_rgba(15,23,42,0.5)] sm:p-[2px] dark:border-white/10 dark:from-indigo-500/30 dark:via-sky-500/20"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_55%)]"
        />
        <div className="relative rounded-[1.75rem] bg-white p-6 shadow-sm sm:p-8 dark:bg-slate-950">
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

          <div className="space-y-8">
            <section className="rounded-2xl border border-border/60 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
              <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold leading-[1.22]">Items</h2>
              </header>
              <div className="relative mt-4 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search items…"
                  className="pl-9"
                />
              </div>

              <div className="mt-4 space-y-4">
                {isLoadingGroceries ? (
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-900/60">
                    Loading groceries…
                  </div>
                ) : isGroceriesError ? (
                  <div className="space-y-3 rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-900/60">
                    <p>We couldn't load the grocery list.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => invalidateGroceries()}
                    >
                      Try again
                    </Button>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-900/60">
                    Nothing needed yet. Add an item or propose a group meal.
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {sortedItems.map((item) => renderItemRow(item))}
                    </div>
                    {purchasedItems.length > 0 && (
                      <div className="flex justify-end pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearPurchased}
                          disabled={isClearingPurchased}
                        >
                          {isClearingPurchased ? "Clearing…" : "Clear purchased"}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            <Separator />

            <section className="rounded-2xl border border-border/60 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
              <header>
                <h2 className="text-xl font-semibold leading-[1.22]">Group Meals</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-[1.5]">Propose dinners and vote together.</p>
              </header>

              {activeMeals.length === 0 && declinedMeals.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground dark:border-white/10 dark:bg-slate-900/60">
                  No meal ideas yet. Propose your first group dinner.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
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
                <div className="mt-4 overflow-hidden rounded-xl border border-border/60 bg-muted/20 dark:border-white/10 dark:bg-slate-900/60">
                  <details className="group">
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
            </section>
          </div>

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
            currentUserId={user?.id}
            onSubmit={(values) => editingItem && handleUpdateItem(editingItem, values)}
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

      const ingredients = normalizeMealIngredients([ingredientsText]);
      if (ingredients.length === 0) {
        return;
      }

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
  currentUserId?: string;
}

const EditItemDialog = ({ item, open, onOpenChange, onSubmit, currentUserId }: EditItemDialogProps) => {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [claimItem, setClaimItem] = useState(false);

  useEffect(() => {
    if (item && open) {
      setName(item.name);
      setNote(item.note ?? "");
      if (currentUserId) {
        const isClaimedByCurrentUser = item.participants.some(
          (participant) => participant.userId === currentUserId,
        );
        setClaimItem(isClaimedByCurrentUser);
      } else {
        setClaimItem(false);
      }
    } else if (!open) {
      setName("");
      setNote("");
      setClaimItem(false);
    }
  }, [item, open, currentUserId]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item) {
      return;
    }

    if (!name.trim()) {
      return;
    }

    onSubmit({ name: name.trim(), note: note.trim(), claimItem });
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
  const normalizedIngredients = useMemo(
    () => normalizeMealIngredients(meal.ingredients),
    [meal.ingredients],
  );

  const allIngredientsAdded = normalizedIngredients.every((ingredient) =>
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
            {normalizedIngredients.map((ingredient, index) => {
              const normalized = normalizeName(ingredient);
              const alreadyAdded = existingItemNames.has(normalized);
              return (
                <Badge
                  key={`${ingredient}-${index}`}
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

