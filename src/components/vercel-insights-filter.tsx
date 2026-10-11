"use client";

import { useLayoutEffect } from "react";
import { allowVercelInsight } from "@/lib/vercel-insights";

type InsightEvent = { url?: string };

/**
 * Drops /admin and /portal before Vercel records them.
 *
 * The root layout is a Server Component, so it cannot pass a beforeSend
 * function into the client Analytics / SpeedInsights components. This
 * installs the same filter on the script queue before those components
 * inject their scripts (useLayoutEffect runs first).
 */
export function VercelInsightsFilter() {
  useLayoutEffect(() => {
    installBeforeSend("va", "vaq");
    installBeforeSend("si", "siq");
  }, []);
  return null;
}

function installBeforeSend(fnName: "va" | "si", queueName: "vaq" | "siq") {
  const w = window as Window & {
    va?: (event: string, data?: unknown) => void;
    si?: (event: string, data?: unknown) => void;
    vaq?: unknown[];
    siq?: unknown[];
  };
  if (typeof w[fnName] !== "function") {
    w[fnName] = (event, data) => {
      const queue = (w[queueName] ??= []);
      queue.push([event, data]);
    };
  }
  w[fnName]!("beforeSend", (event: InsightEvent) => {
    if (!event?.url || allowVercelInsight(event.url)) return event;
    return null;
  });
}
