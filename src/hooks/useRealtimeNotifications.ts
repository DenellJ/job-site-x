import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export interface Notice {
  id: string;
  message: string;
  href: string | null;
  at: number;
}

/**
 * Live unread notifications for the signed-in user. Backed by a reactive Convex
 * query (replaces the Firestore `onSnapshot` subscription).
 */
export function useRealtimeNotifications() {
  const notices = useQuery(api.notifications.listMine) ?? [];
  const dismissMutation = useMutation(api.notifications.dismiss);

  const dismiss = (id: string) => {
    void dismissMutation({ notificationId: id as Id<"notifications"> });
  };

  return { notices, dismiss };
}
