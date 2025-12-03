import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { buildWebSocketUrl } from "@/lib/api";
import {
  scheduledActivitiesQueryKey,
  proposalActivitiesQueryKey,
} from "@/lib/activities/queryKeys";

type TripRealtimeOptions = {
  enabled?: boolean;
  userId?: string | null;
};

type ActivityEventType =
  | "activity_created"
  | "activity_invite_updated"
  | "activity_canceled"
  | "activity_converted";

const ACTIVITY_EVENT_TYPES: Set<ActivityEventType> = new Set([
  "activity_created",
  "activity_invite_updated",
  "activity_canceled",
  "activity_converted",
]);

export function useTripRealtime(
  tripId: number | null | undefined,
  { enabled = true, userId }: TripRealtimeOptions = {},
) {
  const queryClient = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!tripId || tripId <= 0) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const socket = new WebSocket(buildWebSocketUrl("/ws"));
    socketRef.current = socket;

    const joinPayload = JSON.stringify({
      type: "join_trip",
      tripId,
      userId: userId ?? undefined,
    });

    const handleOpen = () => {
      try {
        socket.send(joinPayload);
      } catch {
        // ignore send failures – the connection may close immediately after opening
      }
    };

    const invalidateActivityQueries = () => {
      const scheduledKey = scheduledActivitiesQueryKey(tripId);
      const proposalsKey = proposalActivitiesQueryKey(tripId);
      queryClient.invalidateQueries({ queryKey: scheduledKey });
      queryClient.invalidateQueries({ queryKey: proposalsKey });
    };

    const invalidateHotelProposals = () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotel-proposals`] });
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/hotel-proposals?mineOnly=true`],
      });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/hotels`] });
    };

    const invalidateFlightProposals = () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/proposals/flights`] });
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/proposals/flights?mineOnly=true`],
      });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/flights`] });
    };

    const invalidateRestaurantProposals = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "restaurant-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "restaurants"] });
    };

    const invalidateWishList = () => {
      queryClient.invalidateQueries({ queryKey: ["wish-list", tripId] });
    };

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        if (!data || typeof data.type !== "string") {
          return;
        }

        if (ACTIVITY_EVENT_TYPES.has(data.type as ActivityEventType)) {
          invalidateActivityQueries();
          return;
        }

        const triggeredBy = typeof data.triggeredBy === "string" ? data.triggeredBy : undefined;
        const isSelfEvent = triggeredBy && triggeredBy === userId;

        switch (data.type) {
          case "hotel_proposal_created":
          case "hotel_proposal_updated":
          case "hotel_proposal_canceled":
          case "hotel_proposal_ranked":
            if (!isSelfEvent) {
              invalidateHotelProposals();
            }
            break;
          case "flight_proposal_created":
          case "flight_proposal_updated":
          case "flight_proposal_canceled":
          case "flight_proposal_ranked":
            if (!isSelfEvent) {
              invalidateFlightProposals();
            }
            break;
          case "restaurant_proposal_created":
          case "restaurant_proposal_updated":
          case "restaurant_proposal_canceled":
          case "restaurant_proposal_ranked":
            if (!isSelfEvent) {
              invalidateRestaurantProposals();
            }
            break;
          case "wish_list_idea_created":
          case "wish_list_idea_updated":
          case "wish_list_idea_deleted":
            if (!isSelfEvent) {
              invalidateWishList();
            }
            break;
          default:
            break;
        }
      } catch {
        // ignore malformed payloads
      }
    };

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("message", handleMessage);

    const handleCloseOrError = () => {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("message", handleMessage);
    };

    socket.addEventListener("close", handleCloseOrError);
    socket.addEventListener("error", handleCloseOrError);

    return () => {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("close", handleCloseOrError);
      socket.removeEventListener("error", handleCloseOrError);
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [enabled, queryClient, tripId, userId]);
}

