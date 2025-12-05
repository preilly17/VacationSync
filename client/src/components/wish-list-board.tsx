import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Heart, Loader2, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ApiError, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { WishListIdeaWithDetails } from "@shared/schema";

interface WishListBoardProps {
  tripId: number;
  shareCode?: string | null;
}

interface WishListIdeasResponse {
  ideas: WishListIdeaWithDetails[];
  meta?: {
    availableTags?: string[];
    submitters?: { id: string; name: string }[];
    sort?: string;
    isAdmin?: boolean;
    isMember?: boolean;
    minLikes?: number | null;
  };
}

interface CreateIdeaPayload {
  tripId: number;
  title: string;
  link: string | null;
  notes: string | null;
  tags: string[];
}

type SortOption = "newest" | "oldest" | "most_saved";

const getCreatorDisplayName = (
  creator: WishListIdeaWithDetails["creator"] | null | undefined,
): string => {
  if (!creator) {
    return "Member";
  }

  const parts = [creator.firstName, creator.lastName]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);

  if (parts.length > 0) {
    return parts.join(" ");
  }

  if (typeof creator.username === "string" && creator.username.trim().length > 0) {
    return creator.username.trim();
  }

  if (typeof creator.email === "string" && creator.email.trim().length > 0) {
    return creator.email.trim();
  }

  return "Member";
};

const getCreatorInitials = (
  creator: WishListIdeaWithDetails["creator"] | null | undefined,
): string => {
  const displayName = getCreatorDisplayName(creator);
  const initials = displayName
    .split(/\s+/)
    .filter((segment) => segment.length > 0)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join("");

  if (initials.length > 0) {
    return initials;
  }

  return "M";
};

const getCreatedAtLabel = (
  createdAt: string | Date | null | undefined,
): string => {
  if (!createdAt) {
    return "Added just now";
  }

  try {
    const parsed = createdAt instanceof Date ? createdAt : new Date(createdAt);
    if (Number.isNaN(parsed.getTime())) {
      return "Added just now";
    }

    return `Added ${formatDistanceToNow(parsed, { addSuffix: true })}`;
  } catch {
    return "Added just now";
  }
};

type WishListQueryKey = [
  "wish-list",
  number,
  SortOption,
  string | null,
  string | null,
  string | null,
  string | null,
];

export function WishListBoard({ tripId, shareCode }: WishListBoardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [submittedBy, setSubmittedBy] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [minLikes, setMinLikes] = useState("");

  const hasUserAdjustedSort = useRef(false);

  const normalizedShareCode = useMemo(() => {
    if (!shareCode) {
      return null;
    }
    const trimmed = shareCode.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [shareCode]);

  const normalizedMinLikes = useMemo(() => {
    const trimmed = minLikes.trim();
    if (!trimmed) {
      return "";
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return "";
    }

    return String(parsed);
  }, [minLikes]);

  const hasActiveFilters =
    selectedTag !== "" ||
    submittedBy !== "" ||
    searchTerm.trim() !== "" ||
    normalizedMinLikes !== "";

  const wishListQueryKey = useMemo<WishListQueryKey>(
    () => [
      "wish-list",
      tripId,
      sort,
      selectedTag || null,
      submittedBy || null,
      searchTerm.trim() || null,
      normalizedMinLikes || null,
    ],
    [normalizedMinLikes, searchTerm, selectedTag, sort, submittedBy, tripId],
  );

  const getShareCodeHeaders = () =>
    normalizedShareCode ? { "X-Trip-Share-Code": normalizedShareCode } : undefined;

  const handleUnauthorized = useCallback(() => {
    toast({
      title: "Unauthorized",
      description: "You have been signed out. Please log in again.",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/login";
    }, 300);
  }, [toast]);

  const wishListQueryOptions: UseQueryOptions<
    WishListIdeasResponse,
    Error,
    WishListIdeasResponse,
    WishListQueryKey
  > = {
    queryKey: wishListQueryKey,
    enabled: Number.isFinite(tripId) && tripId > 0,
    queryFn: async () => {
      const headers = getShareCodeHeaders();
      const params = new URLSearchParams();
      params.set("sort", sort);

      if (selectedTag) {
        params.set("tag", selectedTag);
      }

      if (submittedBy) {
        params.set("submittedBy", submittedBy);
      }

      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
      }

      if (normalizedMinLikes) {
        params.set("minLikes", normalizedMinLikes);
      }

      const queryString = params.toString();
      return await apiRequest<WishListIdeasResponse>(
        `/api/trips/${tripId}/wish-list${queryString ? `?${queryString}` : ""}`,
        {
          method: "GET",
          ...(headers ? { headers } : {}),
        },
      );
    },
    retry: (failureCount, requestError) => {
      if (isUnauthorizedError(requestError)) {
        return false;
      }
      return failureCount < 2;
    },
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery(
    wishListQueryOptions,
  );

  useEffect(() => {
    if (data?.meta?.sort && !hasUserAdjustedSort.current) {
      setSort(data.meta.sort as SortOption);
    }
  }, [data?.meta?.sort]);

  useEffect(() => {
    if (!isError || !error) {
      return;
    }

    if (isUnauthorizedError(error)) {
      handleUnauthorized();
      return;
    }

    toast({
      title: "Unable to load wish list",
      description: error.message || "Please try again later.",
      variant: "destructive",
    });
  }, [error, handleUnauthorized, isError, toast]);

  const ideas: WishListIdeaWithDetails[] = data?.ideas ?? [];
  const availableTags = data?.meta?.availableTags ?? [];
  const submitters = data?.meta?.submitters ?? [];

  const matchesFilters = useCallback(
    (idea: WishListIdeaWithDetails) => {
      if (selectedTag && !(idea.tags ?? []).includes(selectedTag)) {
        return false;
      }

      if (submittedBy && idea.creator?.id !== submittedBy) {
        return false;
      }

      const normalizedSearch = searchTerm.trim().toLowerCase();
      if (normalizedSearch) {
        const haystack = `${idea.title ?? ""} ${idea.notes ?? ""}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      if (normalizedMinLikes) {
        const min = Number.parseInt(normalizedMinLikes, 10);
        if (Number.isFinite(min) && idea.saveCount < min) {
          return false;
        }
      }

      return true;
    },
    [normalizedMinLikes, searchTerm, selectedTag, submittedBy],
  );

  const createIdeaMutation = useMutation<
    { idea: WishListIdeaWithDetails },
    Error,
    CreateIdeaPayload
  >({
    mutationFn: async (payload) => {
      const headers = getShareCodeHeaders();
      const res = await apiRequest(`/api/trips/${tripId}/wish-list`, {
        method: "POST",
        body: payload,
        ...(headers ? { headers } : {}),
      });
      return (await res.json()) as { idea: WishListIdeaWithDetails };
    },
    onSuccess: (payload) => {
      if (payload.idea) {
        const includeIdea = matchesFilters(payload.idea);
        const shouldUpdateMeta = !hasActiveFilters || includeIdea;

        queryClient.setQueryData<WishListIdeasResponse | undefined>(
          wishListQueryKey,
          (previous) => {
            const computeMeta = () => {
              if (!shouldUpdateMeta) {
                return previous?.meta ?? data?.meta;
              }

              const baseMeta = previous?.meta ?? {
                availableTags: [],
                submitters: [],
                sort: sort,
                isAdmin: data?.meta?.isAdmin,
                isMember: data?.meta?.isMember,
                minLikes: data?.meta?.minLikes ?? null,
              };

              const existingTags = new Set(baseMeta.availableTags ?? []);
              for (const tag of payload.idea.tags ?? []) {
                if (tag) {
                  existingTags.add(tag);
                }
              }

              const submitterList = [...(baseMeta.submitters ?? [])];
              const hasSubmitter = submitterList.some(
                (submitter) => submitter.id === payload.idea.creator.id,
              );
              if (!hasSubmitter) {
                submitterList.push({
                  id: payload.idea.creator.id,
                  name: getCreatorDisplayName(payload.idea.creator),
                });
              }

              submitterList.sort((a, b) => a.name.localeCompare(b.name));

              return {
                ...baseMeta,
                availableTags: Array.from(existingTags).sort((a, b) => a.localeCompare(b)),
                submitters: submitterList,
              };
            };

            const nextMeta = computeMeta();

            if (!previous) {
              return { ideas: includeIdea ? [payload.idea] : [], meta: nextMeta };
            }

            return {
              ...previous,
              ideas: includeIdea ? [payload.idea, ...previous.ideas] : previous.ideas,
              meta: nextMeta,
            };
          },
        );

        toast({
          title: "Idea added",
          description: "Your idea is now on the wish list.",
        });

        setTitle("");
        setUrl("");
        setNotes("");
        setTagsInput("");

        queryClient.invalidateQueries({ queryKey: ["wish-list", tripId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["wish-list", tripId] });
        toast({
          title: "Idea added",
          description: "Your idea is now on the wish list.",
        });
      }
    },
    onError: (requestError) => {
      if (isUnauthorizedError(requestError)) {
        handleUnauthorized();
        return;
      }

      if (requestError instanceof ApiError) {
        toast({
          title: "Failed to add idea",
          description: requestError.message || "Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Failed to add idea",
        description:
          requestError instanceof Error ? requestError.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleSaveMutation = useMutation<
    { saved: boolean; saveCount: number },
    Error,
    number,
    { previousData?: WishListIdeasResponse | undefined }
  >({
    mutationFn: async (ideaId) => {
      const headers = getShareCodeHeaders();
      const res = await apiRequest(`/api/wish-list/${ideaId}/save`, {
        method: "POST",
        ...(headers ? { headers } : {}),
      });
      return (await res.json()) as { saved: boolean; saveCount: number };
    },
    onMutate: async (ideaId) => {
      await queryClient.cancelQueries({ queryKey: wishListQueryKey });
      const previousData = queryClient.getQueryData<WishListIdeasResponse | undefined>(
        wishListQueryKey,
      );

      queryClient.setQueryData<WishListIdeasResponse | undefined>(
        wishListQueryKey,
        (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            ideas: current.ideas.map((idea) => {
              if (idea.id !== ideaId) {
                return idea;
              }

              const nextSaved = !idea.currentUserSaved;
              const delta = nextSaved ? 1 : -1;
              const nextCount = Math.max(0, (idea.saveCount ?? 0) + delta);

              return {
                ...idea,
                currentUserSaved: nextSaved,
                saveCount: nextCount,
              };
            }),
          };
        },
      );

      return { previousData };
    },
    onError: (requestError, _ideaId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(wishListQueryKey, context.previousData);
      }

      if (isUnauthorizedError(requestError)) {
        handleUnauthorized();
        return;
      }

      if (requestError instanceof ApiError) {
        toast({
          title: "Unable to update interest",
          description: requestError.message || "Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Unable to update interest",
        description:
          requestError instanceof Error ? requestError.message : "Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (result, ideaId) => {
      queryClient.setQueryData<WishListIdeasResponse | undefined>(
        wishListQueryKey,
        (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            ideas: current.ideas.map((idea) =>
              idea.id === ideaId
                ? {
                    ...idea,
                    currentUserSaved: result.saved,
                    saveCount: result.saveCount,
                  }
                : idea,
            ),
          };
        },
      );
    },
  });

  const deleteIdeaMutation = useMutation<
    { success: boolean },
    Error,
    number,
    { previousData?: WishListIdeasResponse | undefined }
  >({
    mutationFn: async (ideaId) => {
      const headers = getShareCodeHeaders();
      const res = await apiRequest(`/api/wish-list/${ideaId}`, {
        method: "DELETE",
        ...(headers ? { headers } : {}),
      });
      return (await res.json()) as { success: boolean };
    },
    onMutate: async (ideaId) => {
      await queryClient.cancelQueries({ queryKey: wishListQueryKey });
      const previousData = queryClient.getQueryData<WishListIdeasResponse | undefined>(
        wishListQueryKey,
      );

      queryClient.setQueryData<WishListIdeasResponse | undefined>(
        wishListQueryKey,
        (current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            ideas: current.ideas.filter((idea) => idea.id !== ideaId),
          };
        },
      );

      return { previousData };
    },
    onError: (requestError, _ideaId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(wishListQueryKey, context.previousData);
      }

      if (isUnauthorizedError(requestError)) {
        handleUnauthorized();
        return;
      }

      if (requestError instanceof ApiError) {
        toast({
          title: "Unable to remove idea",
          description: requestError.message || "Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Unable to remove idea",
        description:
          requestError instanceof Error ? requestError.message : "Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Idea removed",
        description: "The idea was removed from the wish list.",
      });
      queryClient.invalidateQueries({ queryKey: wishListQueryKey });
    },
  });

  const handleSortChange = (value: SortOption) => {
    hasUserAdjustedSort.current = true;
    setSort(value);
  };

  const handleClearFilters = () => {
    setSelectedTag("");
    setSubmittedBy("");
    setSearchTerm("");
    setMinLikes("");
    hasUserAdjustedSort.current = true;
    setSort("newest");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast({
        title: "Title required",
        description: "Give your idea a quick title before saving it.",
        variant: "destructive",
      });
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const payload: CreateIdeaPayload = {
      tripId,
      title: trimmedTitle,
      link: url.trim() ? url.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
      tags,
    };

    try {
      await createIdeaMutation.mutateAsync(payload);
    } catch (mutationError) {
      if (mutationError instanceof ApiError) {
        if (mutationError.status === 401) {
          handleUnauthorized();
          return;
        }
        toast({
          title: "Failed to add idea",
          description: mutationError.message || "Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Failed to add idea",
        description:
          mutationError instanceof Error
            ? mutationError.message
            : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleToggleSave = (ideaId: number) => {
    toggleSaveMutation.mutate(ideaId);
  };

  const handleDeleteIdea = (ideaId: number) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Remove this idea from the wish list?");
      if (!confirmed) {
        return;
      }
    }

    deleteIdeaMutation.mutate(ideaId);
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-neutral-900">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-semibold">Wish List</h2>
          </div>
          <p className="text-sm text-neutral-600">
            Collect restaurants, experiences, and random ideas so the group can react later.
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="wish-title">
              Title
            </label>
            <Input
              id="wish-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Late-night ramen run"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="wish-url">
              Link <span className="text-neutral-400">(optional)</span>
            </label>
            <Input
              id="wish-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/must-try"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="wish-notes">
              Notes
            </label>
            <Textarea
              id="wish-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What makes this worth visiting?"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="wish-tags">
              Tags <span className="text-neutral-400">(comma separated)</span>
            </label>
            <Input
              id="wish-tags"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="food, drinks"
            />
          </div>

        <div className="flex items-center justify-end gap-3">
          <Button type="submit" disabled={createIdeaMutation.isPending}>
            {createIdeaMutation.isPending ? "Saving..." : "Add idea"}
          </Button>
        </div>
      </form>
    </Card>

      <Card className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-neutral-900">Filter & sort ideas</h3>
            <p className="text-sm text-neutral-600">
              Narrow down ideas by tags, submitters, interest, or keywords.
            </p>
          </div>
          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="wish-search">Search</Label>
            <Input
              id="wish-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Ramen, karaoke, hidden bar..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wish-sort">Sort by</Label>
            <Select value={sort} onValueChange={(value) => handleSortChange(value as SortOption)}>
              <SelectTrigger id="wish-sort">
                <SelectValue placeholder="Sort ideas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="most_saved">Most interested</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wish-tag">Tag</Label>
            <Select
              value={selectedTag}
              onValueChange={(value) => setSelectedTag(value)}
              disabled={availableTags.length === 0}
            >
              <SelectTrigger id="wish-tag">
                <SelectValue
                  placeholder={availableTags.length === 0 ? "No tags yet" : "All tags"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All tags</SelectItem>
                {availableTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wish-submitter">Submitted by</Label>
            <Select
              value={submittedBy}
              onValueChange={(value) => setSubmittedBy(value)}
              disabled={submitters.length === 0}
            >
              <SelectTrigger id="wish-submitter">
                <SelectValue
                  placeholder={submitters.length === 0 ? "No submissions yet" : "Anyone"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Anyone</SelectItem>
                {submitters.map((submitter) => (
                  <SelectItem key={submitter.id} value={submitter.id}>
                    {submitter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wish-min-likes">Minimum interests</Label>
            <Input
              id="wish-min-likes"
              type="number"
              min={1}
              inputMode="numeric"
              value={minLikes}
              onChange={(event) => setMinLikes(event.target.value)}
              placeholder="e.g. 3"
            />
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {searchTerm.trim() ? <Badge variant="secondary">Search: {searchTerm.trim()}</Badge> : null}
            {selectedTag ? <Badge variant="secondary">Tag: {selectedTag}</Badge> : null}
            {submittedBy
              ? submitters
                  .filter((submitter) => submitter.id === submittedBy)
                  .map((submitter) => (
                    <Badge key={submitter.id} variant="secondary">
                      Submitted by: {submitter.name}
                    </Badge>
                  ))
              : null}
            {normalizedMinLikes ? (
              <Badge variant="secondary">At least {normalizedMinLikes} interested</Badge>
            ) : null}
          </div>
        ) : null}
      </Card>

      {isLoading ? (
        <Card className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-600">Loading wish list ideas...</p>
        </Card>
      ) : isError ? (
        <Card className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-900">Wish list unavailable</p>
              <p className="text-sm text-neutral-600">
                {error instanceof Error
                  ? error.message || "We couldn't load the wish list."
                  : "We couldn't load the wish list."}
              </p>
            </div>
            <Button onClick={() => refetch()} variant="outline" disabled={isFetching}>
              {isFetching ? "Retrying..." : "Retry"}
            </Button>
          </div>
        </Card>
      ) : ideas.length === 0 ? (
        <Card className="rounded-3xl border border-dashed border-neutral-300 bg-white p-10 text-center shadow-sm">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-4 text-sm text-neutral-600">
            Nothing saved yet. Add your first idea above and start planning.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {ideas.map((idea) => {
            const displayName = getCreatorDisplayName(idea.creator);
            const createdAtLabel = getCreatedAtLabel(idea.createdAt);
            const isToggling = toggleSaveMutation.isPending && toggleSaveMutation.variables === idea.id;
            const isDeleting = deleteIdeaMutation.isPending && deleteIdeaMutation.variables === idea.id;

            return (
              <Card
                key={idea.id}
                className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-neutral-900">{idea.title}</h3>
                      {idea.url ? (
                        <a
                          href={idea.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Open link
                        </a>
                      ) : null}
                    </div>

                    {idea.notes ? (
                      <p className="whitespace-pre-wrap text-sm text-neutral-600">{idea.notes}</p>
                    ) : null}

                    {idea.tags && idea.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {idea.tags.map((tag) => (
                          <span
                            key={`${idea.id}-${tag}`}
                            className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage
                          src={idea.creator?.profileImageUrl ?? undefined}
                          alt={displayName}
                        />
                        <AvatarFallback className="bg-neutral-100 text-sm font-semibold text-neutral-600">
                          {getCreatorInitials(idea.creator)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col leading-tight">
                        <span className="text-sm font-medium text-neutral-700">{displayName}</span>
                        <span className="text-xs text-neutral-500">{createdAtLabel}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleSave(idea.id)}
                        disabled={isToggling}
                        aria-pressed={idea.currentUserSaved}
                        className={cn(
                          "rounded-full border-neutral-200 bg-white px-3 py-1 text-neutral-600 hover:bg-neutral-100",
                          idea.currentUserSaved &&
                            "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
                        )}
                      >
                        {isToggling ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Heart
                            className={cn(
                              "h-4 w-4",
                              idea.currentUserSaved ? "fill-current" : undefined,
                            )}
                          />
                        )}
                        <span className="text-sm font-medium">Interested</span>
                        <span className="text-sm font-semibold">{idea.saveCount}</span>
                      </Button>
                      {idea.canDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteIdea(idea.id)}
                          disabled={isDeleting}
                          className="text-neutral-500 hover:text-destructive"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="sr-only sm:not-sr-only sm:ml-2 sm:text-sm">Remove</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
