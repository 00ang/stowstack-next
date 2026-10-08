import type { ObjectAction } from "./types";

/* ─── where an action goes ─── */

/** Addresses are [a-z0-9-/] by construction, so they travel unencoded and stay readable. */
function q(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2F/g, "/")}`)
    .join("&");
}

export function actionHref(action: ObjectAction, address: string | null, toolsBase = "/portal/tools"): string {
  if (action.href) return action.href;
  const params: Record<string, string> = { tool: action.tool ?? "overview" };
  if (address && address.includes("/")) params.focus = address;
  Object.assign(params, action.params ?? {});
  return `${toolsBase}?${q(params)}`;
}

export function indexHref(address?: string | null, type?: string | null): string {
  if (address) return `/portal/index?${q({ o: address })}`;
  if (type) return `/portal/index?${q({ t: type })}`;
  return "/portal/index";
}
