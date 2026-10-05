"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bell,
  CheckCheck,
  Clock,
  Trophy,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { usePartnerAuth } from "@/components/partner/use-partner-auth";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string | null;
}

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Bell; color: string; bg: string }
> = {
  payment_failed: {
    icon: AlertCircle,
    color: "var(--color-red)",
    bg: "rgba(176, 74, 58, 0.1)",
  },
  ab_test_winner: {
    icon: Trophy,
    color: "var(--color-gold)",
    bg: "rgba(68, 99, 134, 0.1)",
  },
  campaign_alert: {
    icon: TrendingUp,
    color: "var(--color-gold)",
    bg: "rgba(68, 99, 134, 0.1)",
  },
  team_invite: {
    icon: UserPlus,
    color: "var(--color-gold)",
    bg: "rgba(68, 99, 134, 0.1)",
  },
  trial_ending: {
    icon: Clock,
    color: "var(--color-gold)",
    bg: "rgba(68, 99, 134, 0.1)",
  },
};

const DEFAULT_CONFIG = {
  icon: Bell,
  color: "var(--color-body-text)",
  bg: "rgba(106, 101, 96, 0.1)",
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

const POLL_INTERVAL = 60_000;

export function NotificationBell() {
  const { session, authFetch } = usePartnerAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!session) return;
    try {
      const res = await authFetch("/api/partner/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications: Notification[];
        unreadCount: number;
      };
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Silently fail on poll errors
    }
  }, [session, authFetch]);

  // Initial fetch + polling
  useEffect(() => {
    if (!session) return;

    fetchNotifications();

    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await authFetch("/api/partner/notifications", {
          method: "PATCH",
          body: JSON.stringify({ id }),
        });
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, read_at: new Date().toISOString() } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Silently fail
      }
    },
    [authFetch]
  );

  const markAllRead = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await authFetch("/api/partner/notifications", {
        method: "PATCH",
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [authFetch, loading]);

  const handleNotificationClick = useCallback(
    async (notification: Notification) => {
      if (!notification.read_at) {
        await markAsRead(notification.id);
      }
      setOpen(false);
      if (notification.link) {
        router.push(notification.link);
      }
    },
    [markAsRead, router]
  );

  if (!session) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center justify-center rounded-lg p-2 text-[var(--color-body-text)] transition-colors hover:bg-[var(--color-light-gray)] hover:text-[var(--color-dark)]"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-gold)] px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-x-0 top-16 z-50 mx-auto max-h-[calc(100dvh-5rem)] w-full overflow-hidden rounded-b-xl border border-[var(--color-light-gray)] bg-[var(--color-light)] shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-96 md:rounded-xl"
          style={{
            animation: "notificationFadeIn 150ms ease-out",
          }}
        >
          <div className="flex items-center justify-between border-b border-[var(--color-light-gray)] px-4 py-3">
            <h3
              className="text-sm font-semibold text-[var(--color-dark)]"
              style={{ fontFamily: "var(--font-primary)" }}
            >
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-gold)] transition-colors hover:text-[var(--color-gold-hover)] disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto overscroll-contain md:max-h-[480px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <Bell className="mb-3 h-8 w-8 text-[var(--color-mid-gray)]" />
                <p className="text-sm text-[var(--color-mid-gray)]">
                  No notifications yet
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-light-gray)]">
                {notifications.map((notification) => {
                  const config =
                    TYPE_CONFIG[notification.type] ?? DEFAULT_CONFIG;
                  const Icon = config.icon;
                  const isUnread = !notification.read_at;

                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(notification)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-light-gray)]/50"
                        style={{
                          backgroundColor: isUnread
                            ? "rgba(68, 99, 134, 0.03)"
                            : undefined,
                        }}
                      >
                        <div
                          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: config.bg }}
                        >
                          <Icon
                            className="h-4 w-4"
                            style={{ color: config.color }}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`text-sm leading-snug ${
                                isUnread
                                  ? "font-semibold text-[var(--color-dark)]"
                                  : "font-medium text-[var(--color-body-text)]"
                              }`}
                            >
                              {notification.title}
                            </p>
                            {isUnread && (
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-gold)]" />
                            )}
                          </div>
                          {notification.body && (
                            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--color-mid-gray)]">
                              {notification.body}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-[var(--color-mid-gray)]">
                            {timeAgo(notification.created_at)}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
