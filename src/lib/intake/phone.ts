import { normalisePhone } from "@/lib/messaging/types";

/**
 * Homepage and audit intake. A bare 10-digit number is US. Anything with
 * a leading + (or the 00 international prefix) is kept as E.164.
 * We do not guess a country code.
 */
export function intakePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("00")) {
    const digits = trimmed.replace(/[^\d]/g, "");
    if (digits.length < 10) return null;
    return normalisePhone(`+${digits.slice(2)}`);
  }
  return normalisePhone(trimmed);
}

export const PHONE_CLIENT_ERROR =
  "Enter a number we can reach you on. Add your country code if you're outside the US.";

export const PHONE_SERVER_ERROR =
  "Enter a number we can reach you on, with country code if outside the US";

export const PHONE_HINT = "Add your country code if you're outside the US.";

export const PHONE_PLACEHOLDER = "Phone (with country code outside the US)";
