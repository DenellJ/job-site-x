import { Link } from "react-router-dom";
import type { Notice } from "../hooks/useRealtimeNotifications";

export function NotificationBar({
  notices,
  onDismiss
}: {
  notices: Notice[];
  onDismiss: (id: string) => void;
}) {
  if (notices.length === 0) return null;
  return (
    <div className="fixed top-3 right-3 left-3 sm:left-auto sm:w-96 z-50 space-y-2">
      {notices.slice(0, 3).map((n) => (
        <div
          key={n.id}
          className="bg-ink text-concrete border-2 border-hi rounded-md shadow-chunky p-4 flex items-start gap-3"
        >
          <span className="inline-flex w-7 h-7 bg-hi text-ink font-black items-center justify-center rounded-sm shrink-0">
            !
          </span>
          <div className="flex-1 text-sm">
            {n.href ? (
              <Link to={n.href} onClick={() => onDismiss(n.id)} className="underline font-bold">
                {n.message}
              </Link>
            ) : (
              n.message
            )}
          </div>
          <button
            onClick={() => onDismiss(n.id)}
            className="text-concrete/80 hover:text-hi text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
