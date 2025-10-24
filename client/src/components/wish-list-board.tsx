import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Plus,
  ThumbsUp,
  MessageCircle,
  ArrowUpRight,
  Trash2,
  ExternalLink,
  Loader2,
  Search,
  Link as LinkIcon,
  Tag,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { TravelLoading } from "@/components/LoadingSpinners";
import { cn } from "@/lib/utils";
import type {
  User,
  WishListIdeaWithDetails,
  WishListCommentWithUser,
} from "@shared/schema";

const PRESET_TAGS = [
  "Food",
  "Drinks",
  "Coffee",
  "Activity",
  "Landmark",
  "Nightlife",
  "Shopping",
];

const SORT_LABELS: Record<"newest" | "oldest" | "most_saved", string> = {
  newest: "Newest",
  oldest: "Oldest",
  most_saved: "Most saved",
};

interface WishListBoardProps {
  tripId: number;
}

interface WishListIdeasResponse {
  ideas: WishListIdeaWithDetails[];
  meta: {
    availableTags: string[];
    submitters: { id: string; name: string }[];
    sort: "newest" | "oldest" | "most_saved";
    isAdmin: boolean;
  };
}

interface WishListQueryFilters {
  sort: "newest" | "oldest" | "most_saved";
  tag: string | null;
  submittedBy: string | null;
  search: string | null;
}

interface LinkPreviewMetadata {
  url?: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

const parseIdeaMetadata = (raw: unknown): LinkPreviewMetadata | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const metadata = raw as Record<string, unknown>;
  const result: LinkPreviewMetadata = {};

  if (typeof metadata.url === "string") {
    result.url = metadata.url;
  }
  if (typeof metadata.title === "string") {
    result.title = metadata.title;
  }
  if (typeof metadata.description === "string") {
    result.description = metadata.description;
  }
  if (typeof metadata.image === "string") {
    result.image = metadata.image;
  }
  if (typeof metadata.siteName === "string") {
    result.siteName = metadata.siteName;
  }

  if (Object.keys(result).length === 0) {
    return null;
  }

  return result;
};

const getDomainFromUrl = (url?: string | null, fallback?: string | null) => {
  if (url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./i, "");
    } catch {
      // Ignore parsing errors and fall back to the provided fallback
    }
  }

  return fallback ?? null;
};

const getUserDisplayName = (user: User) => {
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

const getUserInitials = (user: User) => {
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();

  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }

  if (first) {
    return first.slice(0, 2).toUpperCase();
  }

  if (user.username) {
    return user.username.slice(0, 2).toUpperCase();
  }

  if (user.email) {
    return user.email.slice(0, 2).toUpperCase();
  }

  return "TM";
};

const getRelativeTime = (input?: string | Date | null) => {
  if (!input) {
    return "";
  }

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return formatDistanceToNow(date, { addSuffix: true });
};

export function WishListBoard({ tripId }: WishListBoardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [sort, setSort] = useState<"newest" | "oldest" | "most_saved">("newest");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedSubmitter, setSelectedSubmitter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState<string | null>(null);

  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [metadataPreview, setMetadataPreview] = useState<LinkPreviewMetadata | null>(null);
  const [hasManuallyEditedTitle, setHasManuallyEditedTitle] = useState(false);
  const [lastUnfurledUrl, setLastUnfurledUrl] = useState<string | null>(null);

  const handleUnauthorized = useCallback(() => {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/login";
    }, 500);
  }, [toast]);

  useEffect(() => {
    const trimmed = search.trim();
    const handler = window.setTimeout(() => {
      setDebouncedSearch(trimmed ? trimmed : null);
    }, 300);

    return () => window.clearTimeout(handler);
  }, [search]);

  const filters = useMemo<WishListQueryFilters>(
    () => ({
      sort,
      tag: selectedTag,
      submittedBy: selectedSubmitter,
      search: debouncedSearch,
    }),
    [sort, selectedTag, selectedSubmitter, debouncedSearch],
  );

  const wishListQueryKey = useMemo(
    () => ["wish-list", tripId, filters] as const,
    [tripId, filters],
  );

  const {
    data,
    isLoading,
    isFetching,
    error: ideasError,
  } = useQuery<WishListIdeasResponse>({
    queryKey: wishListQueryKey,
    enabled: Number.isFinite(tripId) && tripId > 0,
    queryFn: async ({ queryKey }) => {
      const [, tripIdValue, filterValues] = queryKey as [
        string,
        number,
        WishListQueryFilters,
      ];
      const params = new URLSearchParams();

      if (filterValues.sort && filterValues.sort !== "newest") {
        params.set("sort", filterValues.sort);
      }
      if (filterValues.tag) {
        params.set("tag", filterValues.tag);
      }
      if (filterValues.submittedBy) {
        params.set("submittedBy", filterValues.submittedBy);
      }
      if (filterValues.search) {
        params.set("search", filterValues.search);
      }

      const queryString = params.toString();
      const res = await apiRequest(
        `/api/trips/${tripIdValue}/wish-list${queryString ? `?${queryString}` : ""}`,
      );
      return (await res.json()) as WishListIdeasResponse;
    },
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error as Error)) {
        return false;
      }
      return failureCount < 2;
    },
  });

  useEffect(() => {
    if (!ideasError) {
      return;
    }
    const err = ideasError as Error;
    if (isUnauthorizedError(err)) {
      handleUnauthorized();
      return;
    }
    toast({
      title: "Failed to load wish list",
      description: err.message || "Please try again later.",
      variant: "destructive",
    });
  }, [ideasError, handleUnauthorized, toast]);

  const resetForm = () => {
    setLink("");
    setTitle("");
    setNotes("");
    setSelectedTags([]);
    setCustomTagInput("");
    setMetadataPreview(null);
    setHasManuallyEditedTitle(false);
    setLastUnfurledUrl(null);
  };

  useEffect(() => {
    if (!isAddModalOpen) {
      resetForm();
    }
  }, [isAddModalOpen]);

  useEffect(() => {
    if (!isAddModalOpen) {
      return;
    }

    const trimmedLink = link.trim();
    if (!trimmedLink) {
      setMetadataPreview(null);
      setLastUnfurledUrl(null);
      return;
    }

    if (!title.trim()) {
      setHasManuallyEditedTitle(false);
    }

    if (trimmedLink === lastUnfurledUrl) {
      return;
    }

    const handler = window.setTimeout(() => {
      setLastUnfurledUrl(trimmedLink);
      unfurlMutation.mutate(trimmedLink);
    }, 600);

    return () => window.clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link, isAddModalOpen]);

  const unfurlMutation = useMutation<LinkPreviewMetadata, Error, string>({
    mutationFn: async (url) => {
      const res = await apiRequest("/api/wish-list/unfurl", {
        method: "POST",
        body: { url },
      });
      return (await res.json()) as LinkPreviewMetadata;
    },
    onSuccess: (metadata) => {
      setMetadataPreview(metadata);
      if (!hasManuallyEditedTitle && metadata.title) {
        setTitle(metadata.title);
      }
    },
    onError: (error) => {
      const err = error as Error;
      if (isUnauthorizedError(err)) {
        handleUnauthorized();
        return;
      }
      console.warn("Failed to unfurl link", err);
      toast({
        title: "Couldn't fetch link preview",
        description: "We'll still save the idea without a preview.",
      });
    },
  });

  const updateIdeaInCache = (
    ideaId: number,
    updater: (idea: WishListIdeaWithDetails) => WishListIdeaWithDetails,
  ) => {
    const queries = queryClient.getQueriesData<WishListIdeasResponse>({
      queryKey: ["wish-list", tripId],
    });

    for (const [key, cached] of queries) {
      if (!cached) {
        continue;
      }
      queryClient.setQueryData(key, {
        ...cached,
        ideas: cached.ideas.map((idea) =>
          idea.id === ideaId ? updater(idea) : idea,
        ),
      });
    }
  };

  const ideaMatchesFilters = (
    idea: WishListIdeaWithDetails,
    filters?: WishListQueryFilters,
  ): boolean => {
    if (!filters) {
      return true;
    }

    if (filters.tag) {
      const normalizedTag = filters.tag.toLowerCase();
      const hasTag = (idea.tags ?? []).some(
        (tag) => tag && tag.toLowerCase() === normalizedTag,
      );
      if (!hasTag) {
        return false;
      }
    }

    if (filters.submittedBy && idea.creator.id !== filters.submittedBy) {
      return false;
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      const haystacks = [
        idea.title,
        idea.notes ?? "",
        idea.url ?? "",
        ...(idea.tags ?? []),
      ];

      const matchesSearch = haystacks.some((value) =>
        value?.toLowerCase().includes(search),
      );

      if (!matchesSearch) {
        return false;
      }
    }

    return true;
  };

  const getCreatedAtValue = (value: string | Date | null | undefined) => {
    if (!value) {
      return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    const timestamp = date.getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  };

  const sortIdeasWithNewEntry = (
    ideas: WishListIdeaWithDetails[],
    idea: WishListIdeaWithDetails,
    sort: "newest" | "oldest" | "most_saved",
  ): WishListIdeaWithDetails[] => {
    const newIdeas = [...ideas, idea];

    const compareNewest = (
      a: WishListIdeaWithDetails,
      b: WishListIdeaWithDetails,
    ) => {
      const aTime = getCreatedAtValue(a.createdAt);
      const bTime = getCreatedAtValue(b.createdAt);

      if (aTime !== null && bTime !== null && aTime !== bTime) {
        return bTime - aTime;
      }

      if (aTime === null && bTime !== null) {
        return 1;
      }

      if (aTime !== null && bTime === null) {
        return -1;
      }

      return b.id - a.id;
    };

    const compareOldest = (
      a: WishListIdeaWithDetails,
      b: WishListIdeaWithDetails,
    ) => {
      const aTime = getCreatedAtValue(a.createdAt);
      const bTime = getCreatedAtValue(b.createdAt);

      if (aTime !== null && bTime !== null && aTime !== bTime) {
        return aTime - bTime;
      }

      if (aTime === null && bTime !== null) {
        return 1;
      }

      if (aTime !== null && bTime === null) {
        return -1;
      }

      return a.id - b.id;
    };

    const compareMostSaved = (
      a: WishListIdeaWithDetails,
      b: WishListIdeaWithDetails,
    ) => {
      if (a.saveCount !== b.saveCount) {
        return b.saveCount - a.saveCount;
      }

      return compareNewest(a, b);
    };

    if (sort === "oldest") {
      return newIdeas.sort(compareOldest);
    }

    if (sort === "most_saved") {
      return newIdeas.sort(compareMostSaved);
    }

    return newIdeas.sort(compareNewest);
  };

  const addIdeaToCache = (idea: WishListIdeaWithDetails) => {
    const queries = queryClient.getQueriesData<WishListIdeasResponse>({
      queryKey: ["wish-list", tripId],
    });

    for (const [key, cached] of queries) {
      if (!cached) {
        continue;
      }

      const [, keyTripId, keyFilters] = key as [
        string,
        number,
        WishListQueryFilters | undefined,
      ];

      if (keyTripId !== tripId) {
        continue;
      }

      if (!ideaMatchesFilters(idea, keyFilters)) {
        continue;
      }

      if (cached.ideas.some((existing) => existing.id === idea.id)) {
        continue;
      }

      const sort = keyFilters?.sort ?? cached.meta.sort ?? "newest";
      const updatedIdeas = sortIdeasWithNewEntry(cached.ideas, idea, sort);

      const updatedTags = new Set(cached.meta.availableTags);
      for (const tag of idea.tags ?? []) {
        if (tag) {
          updatedTags.add(tag);
        }
      }

      let updatedSubmitters = cached.meta.submitters;
      if (!updatedSubmitters.some((submitter) => submitter.id === idea.creator.id)) {
        updatedSubmitters = [
          ...updatedSubmitters,
          { id: idea.creator.id, name: getUserDisplayName(idea.creator) },
        ].sort((a, b) => a.name.localeCompare(b.name));
      }

      queryClient.setQueryData(key, {
        ...cached,
        ideas: updatedIdeas,
        meta: {
          ...cached.meta,
          availableTags: Array.from(updatedTags).sort((a, b) =>
            a.localeCompare(b),
          ),
          submitters: updatedSubmitters,
        },
      });
    }
  };

  const removeIdeaFromCache = (ideaId: number) => {
    const queries = queryClient.getQueriesData<WishListIdeasResponse>({
      queryKey: ["wish-list", tripId],
    });

    for (const [key, cached] of queries) {
      if (!cached) {
        continue;
      }
      queryClient.setQueryData(key, {
        ...cached,
        ideas: cached.ideas.filter((idea) => idea.id !== ideaId),
      });
    }
  };

  const toggleSaveMutation = useMutation<
    { saved: boolean; saveCount: number },
    Error,
    { ideaId: number }
  >({
    mutationFn: async ({ ideaId }) => {
      const res = await apiRequest(`/api/wish-list/${ideaId}/save`, {
        method: "POST",
      });
      return (await res.json()) as { saved: boolean; saveCount: number };
    },
    onSuccess: (data, variables) => {
      updateIdeaInCache(variables.ideaId, (idea) => ({
        ...idea,
        currentUserSaved: data.saved,
        saveCount: data.saveCount,
      }));
    },
    onError: (error) => {
      const err = error as Error;
      if (isUnauthorizedError(err)) {
        handleUnauthorized();
        return;
      }
      toast({
        title: "Couldn't update save",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteIdeaMutation = useMutation<
    { success: boolean },
    Error,
    { ideaId: number; title: string }
  >({
    mutationFn: async ({ ideaId }) => {
      const res = await apiRequest(`/api/wish-list/${ideaId}`, {
        method: "DELETE",
      });
      if (res.status === 204) {
        return { success: true };
      }
      return (await res.json()) as { success: boolean };
    },
    onSuccess: (_, variables) => {
      removeIdeaFromCache(variables.ideaId);
      queryClient.invalidateQueries({ queryKey: ["wish-list", tripId] });
      toast({
        title: "Idea removed",
        description: `"${variables.title}" has been deleted.`,
      });
    },
    onError: (error) => {
      const err = error as Error;
      if (isUnauthorizedError(err)) {
        handleUnauthorized();
        return;
      }
      toast({
        title: "Failed to delete idea",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const promoteIdeaMutation = useMutation<
    { draft: unknown; idea?: WishListIdeaWithDetails },
    Error,
    { ideaId: number }
  >({
    mutationFn: async ({ ideaId }) => {
      const res = await apiRequest(`/api/wish-list/${ideaId}/promote`, {
        method: "POST",
      });
      return (await res.json()) as {
        draft: unknown;
        idea?: WishListIdeaWithDetails;
      };
    },
    onSuccess: (data, variables) => {
      if (data.idea) {
        updateIdeaInCache(variables.ideaId, () => data.idea as WishListIdeaWithDetails);
      }
      toast({
        title: "Draft created",
        description: "We saved this idea as a proposal draft.",
      });
      queryClient.invalidateQueries({ queryKey: ["wish-list", tripId] });
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/proposal-drafts`],
      });
    },
    onError: (error) => {
      const err = error as Error;
      if (isUnauthorizedError(err)) {
        handleUnauthorized();
        return;
      }
      toast({
        title: "Failed to promote idea",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const addCommentMutation = useMutation<
    { comment: WishListCommentWithUser; commentCount: number },
    Error,
    { ideaId: number; comment: string }
  >({
    mutationFn: async ({ ideaId, comment }) => {
      const res = await apiRequest(`/api/wish-list/${ideaId}/comments`, {
        method: "POST",
        body: { comment },
      });
      return (await res.json()) as {
        comment: WishListCommentWithUser;
        commentCount: number;
      };
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData<WishListCommentWithUser[] | undefined>(
        ["wish-list", variables.ideaId, "comments"],
        (existing) => (existing ? [...existing, data.comment] : [data.comment]),
      );
      updateIdeaInCache(variables.ideaId, (idea) => ({
        ...idea,
        commentCount: data.commentCount,
      }));
    },
    onError: (error) => {
      const err = error as Error;
      if (isUnauthorizedError(err)) {
        handleUnauthorized();
        return;
      }
      toast({
        title: "Failed to post comment",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const createIdeaMutation = useMutation<
    { idea: WishListIdeaWithDetails },
    Error,
    {
      title: string;
      url: string | null;
      notes: string | null;
      tags: string[];
      thumbnailUrl: string | null;
      imageUrl: string | null;
      metadata: LinkPreviewMetadata | null;
    }
  >({
    mutationFn: async (payload) => {
      const res = await apiRequest(`/api/trips/${tripId}/wish-list`, {
        method: "POST",
        body: payload,
      });
      return (await res.json()) as { idea: WishListIdeaWithDetails };
    },
    onSuccess: (data) => {
      if (data.idea) {
        addIdeaToCache(data.idea);
      }
      toast({
        title: "Idea added",
        description: "Your inspiration was added to the wish list.",
      });
      setIsAddModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["wish-list", tripId] });
    },
    onError: (error) => {
      const err = error as Error;
      if (isUnauthorizedError(err)) {
        handleUnauthorized();
        return;
      }
      toast({
        title: "Failed to add idea",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggleSave = async (ideaId: number) => {
    try {
      await toggleSaveMutation.mutateAsync({ ideaId });
    } catch {
      // Errors are handled in onError
    }
  };

  const handleDeleteIdea = async (idea: WishListIdeaWithDetails) => {
    try {
      await deleteIdeaMutation.mutateAsync({ ideaId: idea.id, title: idea.title });
    } catch {
      // Errors handled in onError
    }
  };

  const handlePromoteIdea = async (idea: WishListIdeaWithDetails) => {
    try {
      await promoteIdeaMutation.mutateAsync({ ideaId: idea.id });
    } catch {
      // Errors handled in onError
    }
  };

  const handleAddComment = async (ideaId: number, comment: string) => {
    try {
      await addCommentMutation.mutateAsync({ ideaId, comment });
    } catch {
      // Errors handled in onError
    }
  };

  const handleTagToggle = (tag: string) => {
    const normalized = tag.trim();
    if (!normalized) {
      return;
    }
    setSelectedTags((prev) => {
      if (prev.includes(normalized)) {
        return prev.filter((t) => t !== normalized);
      }
      return [...prev, normalized];
    });
  };

  const handleAddCustomTag = () => {
    const normalized = customTagInput.trim();
    if (!normalized) {
      return;
    }
    setSelectedTags((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setCustomTagInput("");
  };

  const handleSubmitIdea = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast({
        title: "Title is required",
        description: "Give your idea a name before saving it.",
        variant: "destructive",
      });
      return;
    }

    const normalizedTags = Array.from(
      new Set(
        selectedTags
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
      ),
    );

    const payload = {
      title: trimmedTitle,
      url: link.trim() ? link.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
      tags: normalizedTags,
      thumbnailUrl: metadataPreview?.image ?? null,
      imageUrl: metadataPreview?.image ?? null,
      metadata: metadataPreview,
    };

    createIdeaMutation.mutate(payload);
  };

  const toggleSavePendingId =
    toggleSaveMutation.isPending && toggleSaveMutation.variables
      ? toggleSaveMutation.variables.ideaId
      : null;
  const deletePendingId =
    deleteIdeaMutation.isPending && deleteIdeaMutation.variables
      ? deleteIdeaMutation.variables.ideaId
      : null;
  const promotePendingId =
    promoteIdeaMutation.isPending && promoteIdeaMutation.variables
      ? promoteIdeaMutation.variables.ideaId
      : null;
  const addCommentPendingId =
    addCommentMutation.isPending && addCommentMutation.variables
      ? addCommentMutation.variables.ideaId
      : null;

  const ideas = data?.ideas ?? [];
  const meta = data?.meta;

  const availableTagOptions = useMemo(() => {
    const options = new Set<string>(PRESET_TAGS);
    meta?.availableTags.forEach((tag) => {
      if (tag) {
        options.add(tag);
      }
    });
    if (selectedTag) {
      options.add(selectedTag);
    }
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [meta?.availableTags, selectedTag]);

  const submitterOptions = meta?.submitters ?? [];

  return (
    <div className="space-y-6">
      <Card className="border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-neutral-900">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-semibold">Wish List / Ideas</h2>
            </div>
            <p className="text-sm text-neutral-600">
              Drop inspiration links and notes here. Promote favorites into full proposals when the group is ready.
            </p>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add idea
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ideas, notes, tags, or links"
                className="pl-9"
              />
            </div>
            <Select
              value={selectedTag ?? "all"}
              onValueChange={(value) =>
                setSelectedTag(value === "all" ? null : value)
              }
            >
              <SelectTrigger className="md:w-44">
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {availableTagOptions.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedSubmitter ?? "all"}
              onValueChange={(value) =>
                setSelectedSubmitter(value === "all" ? null : value)
              }
            >
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder="All members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                {submitterOptions.map((submitter) => (
                  <SelectItem key={submitter.id} value={submitter.id}>
                    {submitter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              {selectedTag && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {selectedTag}
                </Badge>
              )}
              {selectedSubmitter && (
                <Badge variant="outline" className="flex items-center gap-1">
                  Submitted by {submitterOptions.find((s) => s.id === selectedSubmitter)?.name ?? "Member"}
                </Badge>
              )}
              {isFetching && (
                <span className="flex items-center gap-1 text-neutral-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> Refreshing
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-600">Sort by</span>
              <Select
                value={sort}
                onValueChange={(value: "newest" | "oldest" | "most_saved") =>
                  setSort(value)
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SORT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <TravelLoading
            variant="journey"
            size="md"
            text="Loading wish list ideas..."
          />
        </div>
      ) : ideas.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-4 border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
          <Sparkles className="h-10 w-10 text-primary" />
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">
              Start your wish list ✨
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              Drop links to restaurants, TikToks, blogs, maps, or jot quick notes. We'll keep it separate from the official plan.
            </p>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add your first idea
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {ideas.map((idea) => (
            <WishListIdeaCard
              key={idea.id}
              idea={idea}
              onToggleSave={handleToggleSave}
              onDelete={handleDeleteIdea}
              onPromote={handlePromoteIdea}
              onAddComment={handleAddComment}
              toggleSavePendingId={toggleSavePendingId}
              deletePendingId={deletePendingId}
              promotePendingId={promotePendingId}
              addCommentPendingId={addCommentPendingId}
              onUnauthorized={handleUnauthorized}
            />
          ))}
        </div>
      )}

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add a wish list idea</DialogTitle>
            <DialogDescription>
              Save links, notes, and tags so the group can discuss them later.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleSubmitIdea}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700" htmlFor="wish-list-link">
                Link <span className="text-neutral-400">(optional)</span>
              </label>
              <div className="relative">
                <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  id="wish-list-link"
                  value={link}
                  onChange={(event) => setLink(event.target.value)}
                  placeholder="https://example.com/great-restaurant"
                  className="pl-9"
                />
              </div>
              {unfurlMutation.isPending && (
                <p className="text-xs text-neutral-500">Fetching preview...</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700" htmlFor="wish-list-title">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                id="wish-list-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setHasManuallyEditedTitle(true);
                }}
                placeholder="Late-night ramen spot"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700" htmlFor="wish-list-notes">
                Notes
              </label>
              <Textarea
                id="wish-list-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                placeholder="Why this is cool / what to order"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-neutral-700">
                  Tags
                </label>
                <span className="text-xs text-neutral-500">Preset + custom</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableTagOptions.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagToggle(tag)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-neutral-200 text-neutral-600 hover:border-neutral-300",
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={customTagInput}
                  onChange={(event) => setCustomTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddCustomTag();
                    }
                  }}
                  placeholder="Add custom tag"
                />
                <Button type="button" variant="outline" onClick={handleAddCustomTag}>
                  Add tag
                </Button>
              </div>
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="flex items-center gap-1 bg-neutral-100 text-neutral-700"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTags((prev) => prev.filter((t) => t !== tag))
                        }
                        className="ml-1 rounded-full bg-neutral-200 px-1 text-[10px] font-semibold text-neutral-600"
                        aria-label={`Remove tag ${tag}`}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {metadataPreview && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  {metadataPreview.image && (
                    <div className="flex-shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-white">
                      <img
                        src={metadataPreview.image}
                        alt={metadataPreview.title ?? metadataPreview.url ?? "Link preview"}
                        className="h-24 w-32 object-cover"
                      />
                    </div>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-neutral-500">
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>
                        {getDomainFromUrl(
                          metadataPreview.url,
                          metadataPreview.siteName ?? null,
                        ) ?? "Link preview"}
                      </span>
                    </div>
                    {metadataPreview.title && (
                      <p className="font-medium text-neutral-900">
                        {metadataPreview.title}
                      </p>
                    )}
                    {metadataPreview.description && (
                      <p className="text-neutral-600">
                        {metadataPreview.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={createIdeaMutation.isPending}
              >
                {createIdeaMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save idea
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface WishListIdeaCardProps {
  idea: WishListIdeaWithDetails;
  onToggleSave: (ideaId: number) => Promise<void>;
  onDelete: (idea: WishListIdeaWithDetails) => Promise<void>;
  onPromote: (idea: WishListIdeaWithDetails) => Promise<void>;
  onAddComment: (ideaId: number, comment: string) => Promise<void>;
  toggleSavePendingId: number | null;
  deletePendingId: number | null;
  promotePendingId: number | null;
  addCommentPendingId: number | null;
  onUnauthorized: () => void;
}

function WishListIdeaCard({
  idea,
  onToggleSave,
  onDelete,
  onPromote,
  onAddComment,
  toggleSavePendingId,
  deletePendingId,
  promotePendingId,
  addCommentPendingId,
  onUnauthorized,
}: WishListIdeaCardProps) {
  const { toast } = useToast();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");

  const metadata = parseIdeaMetadata(idea.metadata);
  const previewImage = idea.thumbnailUrl || idea.imageUrl || metadata?.image || null;
  const linkHref = idea.url ?? metadata?.url ?? null;
  const linkDomain = getDomainFromUrl(linkHref, metadata?.siteName ?? null);

  const {
    data: comments = [],
    isLoading: commentsLoading,
    error: commentsError,
  } = useQuery<WishListCommentWithUser[]>({
    queryKey: ["wish-list", idea.id, "comments"],
    enabled: commentsOpen,
    queryFn: async () => {
      const res = await apiRequest(`/api/wish-list/${idea.id}/comments`);
      return (await res.json()) as WishListCommentWithUser[];
    },
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error as Error)) {
        return false;
      }
      return failureCount < 2;
    },
  });

  useEffect(() => {
    if (!commentsError) {
      return;
    }
    const err = commentsError as Error;
    if (isUnauthorizedError(err)) {
      onUnauthorized();
      return;
    }
    toast({
      title: "Failed to load comments",
      description: err.message || "Please try again.",
      variant: "destructive",
    });
  }, [commentsError, onUnauthorized, toast]);

  useEffect(() => {
    if (!commentsOpen) {
      setCommentDraft("");
    }
  }, [commentsOpen]);

  const handleSubmitComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = commentDraft.trim();
    if (!trimmed) {
      return;
    }
    try {
      await onAddComment(idea.id, trimmed);
      setCommentDraft("");
    } catch {
      // Errors handled upstream
    }
  };

  return (
    <Card className="overflow-hidden border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row">
        {previewImage && (
          <div className="md:w-44">
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
              <img
                src={previewImage}
                alt={idea.title}
                className="h-32 w-full object-cover"
              />
            </div>
          </div>
        )}
        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-neutral-900">
                    {idea.title}
                  </h3>
                  {idea.promotedDraftId && (
                    <Badge className="bg-emerald-100 text-emerald-700">
                      Draft ready
                    </Badge>
                  )}
                </div>
                {linkHref && linkDomain && (
                  <a
                    href={linkHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {linkDomain}
                  </a>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={idea.currentUserSaved ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => onToggleSave(idea.id)}
                  disabled={toggleSavePendingId === idea.id}
                >
                  {toggleSavePendingId === idea.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ThumbsUp className="mr-2 h-4 w-4" />
                  )}
                  {idea.saveCount}
                  <span className="ml-1 hidden sm:inline">Save{idea.saveCount === 1 ? "" : "s"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCommentsOpen((prev) => !prev)}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {idea.commentCount}
                  <span className="ml-1 hidden sm:inline">Comment{idea.commentCount === 1 ? "" : "s"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPromote(idea)}
                  disabled={promotePendingId === idea.id}
                >
                  {promotePendingId === idea.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                  )}
                  {idea.promotedDraftId ? "Update draft" : "Promote"}
                </Button>
                {idea.canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => onDelete(idea)}
                    disabled={deletePendingId === idea.id}
                  >
                    {deletePendingId === idea.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete
                  </Button>
                )}
              </div>
            </div>

            {idea.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {idea.tags.map((tag) => (
                  <Badge
                    key={`${idea.id}-${tag}`}
                    variant="secondary"
                    className="bg-neutral-100 text-neutral-700"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {idea.notes && (
              <p className="whitespace-pre-wrap text-sm text-neutral-700">
                {idea.notes}
              </p>
            )}

            {metadata?.description && !idea.notes && (
              <p className="text-sm text-neutral-600">
                {metadata.description}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage
                  src={idea.creator.profileImageUrl || undefined}
                  alt={idea.creator.firstName || "Member"}
                />
                <AvatarFallback className="text-xs font-semibold">
                  {getUserInitials(idea.creator)}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm text-neutral-600">
                <div className="font-medium text-neutral-900">
                  {getUserDisplayName(idea.creator)}
                </div>
                <div>{getRelativeTime(idea.createdAt)}</div>
              </div>
            </div>
            {linkHref && (
              <a
                href={linkHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Open link
              </a>
            )}
          </div>

          {commentsOpen && (
            <div className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <form onSubmit={handleSubmitComment} className="space-y-3">
                <Textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Add a comment for the group"
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={commentDraft.trim().length === 0 || addCommentPendingId === idea.id}
                  >
                    {addCommentPendingId === idea.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Comment
                  </Button>
                </div>
              </form>

              {commentsLoading ? (
                <div className="flex justify-center py-2 text-sm text-neutral-500">
                  Loading comments...
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No comments yet. Be the first to share your thoughts!
                </p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-lg border border-neutral-200 bg-white p-3"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={comment.user.profileImageUrl || undefined}
                            alt={comment.user.firstName || "Member"}
                          />
                          <AvatarFallback className="text-xs font-semibold">
                            {getUserInitials(comment.user)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-neutral-900">
                              {getUserDisplayName(comment.user)}
                            </span>
                            <span className="text-xs text-neutral-500">
                              {getRelativeTime(comment.createdAt)}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-neutral-700">
                            {comment.comment}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
