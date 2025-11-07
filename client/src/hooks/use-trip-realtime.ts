import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { buildWebSocketUrl } from "@/lib/api";

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
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/activities`] });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/proposals/activities`] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "activities"] });
    };

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        if (!data || typeof data.type !== "string") {
          return;
        }

        if (ACTIVITY_EVENT_TYPES.has(data.type as ActivityEventType)) {
          invalidateActivityQueries();
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

