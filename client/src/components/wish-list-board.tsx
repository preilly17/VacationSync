import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ApiError, apiRequest } from "@/lib/queryClient";
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
  title: string;
  url: string | null;
  notes: string | null;
  tags: string[];
  thumbnailUrl: null;
  imageUrl: null;
  metadata: null;
}

export function WishListBoard({ tripId, shareCode }: WishListBoardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const normalizedShareCode = useMemo(() => {
    if (!shareCode) {
      return null;
    }
    const trimmed = shareCode.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [shareCode]);

  const wishListQueryKey = useMemo(() => ["wish-list", tripId] as const, [tripId]);

  const getShareCodeHeaders = () =>
    normalizedShareCode ? { "X-Trip-Share-Code": normalizedShareCode } : undefined;

  const handleUnauthorized = () => {
    toast({
      title: "Unauthorized",
      description: "You have been signed out. Please log in again.",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/login";
    }, 300);
  };

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<WishListIdeasResponse>({
    queryKey: wishListQueryKey,
    enabled: Number.isFinite(tripId) && tripId > 0,
    queryFn: async () => {
      const headers = getShareCodeHeaders();
      const res = await apiRequest(`/api/trips/${tripId}/wish-list`, {
        method: "GET",
        ...(headers ? { headers } : {}),
      });
      return (await res.json()) as WishListIdeasResponse;
    },
    retry: (failureCount, requestError) => {
      if (isUnauthorizedError(requestError as Error)) {
        return false;
      }
      return failureCount < 2;
    },
    onError: (requestError) => {
      const err = requestError as Error;
      if (isUnauthorizedError(err)) {
        handleUnauthorized();
        return;
      }
      toast({
        title: "Unable to load wish list",
        description: err.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const ideas = data?.ideas ?? [];

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
        queryClient.setQueryData<WishListIdeasResponse | undefined>(
          wishListQueryKey,
          (previous) => {
            if (!previous) {
              return { ideas: [payload.idea] };
            }
            return { ...previous, ideas: [payload.idea, ...previous.ideas] };
          },
        );
      } else {
        queryClient.invalidateQueries({ queryKey: wishListQueryKey });
      }

      toast({
        title: "Idea added",
        description: "Your idea is now on the wish list.",
      });

      setTitle("");
      setUrl("");
      setNotes("");
      setTagsInput("");
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
      title: trimmedTitle,
      url: url.trim() ? url.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
      tags,
      thumbnailUrl: null,
      imageUrl: null,
      metadata: null,
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

      {isLoading ? (
        <Card className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-600">Loading wish list ideas...</p>
        </Card>
      ) : isError ? (
        <Card className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-600">
            {error instanceof Error
              ? error.message || "We couldn't load the wish list."
              : "We couldn't load the wish list."}
          </p>
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
          {ideas.map((idea) => (
            <Card key={idea.id} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
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
                  <p className="text-sm text-neutral-600 whitespace-pre-wrap">{idea.notes}</p>
                ) : null}

                {idea.tags && idea.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-2">
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

                <p className="text-xs text-neutral-400">
                  Added by {idea.creator ? idea.creator.firstName ?? idea.creator.username ?? "Member" : "Member"}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
