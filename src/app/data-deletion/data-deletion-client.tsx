"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Trash2,
  Clock,
  CheckCircle,
  Mail,
  AlertCircle,
  Loader2,
} from "lucide-react";

type FormState = "idle" | "submitting" | "success" | "error";

export function DataDeletionClient() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [confirmationId, setConfirmationId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusEmail, setStatusEmail] = useState("");
  const [statusResult, setStatusResult] = useState<{
    status: string;
    confirmation_id: string;
  } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setFormState("submitting");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/data-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      setConfirmationId(data.confirmation_id);
      setFormState("success");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Something went wrong"
      );
      setFormState("error");
    }
  };

  const handleStatusCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusEmail.trim()) return;

    setCheckingStatus(true);
    setStatusResult(null);

    try {
      const res = await fetch("/api/data-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: statusEmail.trim() }),
      });
      const data = await res.json();
      if (data.confirmation_id) {
        setStatusResult({
          status: data.status || "pending",
          confirmation_id: data.confirmation_id,
        });
      } else {
        setStatusResult(null);
      }
    } catch {
      // Ignore
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-void)" }}>
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background: "var(--bg-void)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            href="/"
            className="p-2 -ml-2 transition-colors"
            style={{ color: "var(--text-tertiary)" }}
          >
            <ArrowLeft size={20} />
          </Link>
          <span
            className="text-sm font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Stow
            <span style={{ color: "var(--accent)" }}>Stack</span>
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1
          className="text-2xl font-semibold mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Data Deletion Request
        </h1>
        <p
          className="text-sm mb-8"
          style={{ color: "var(--text-tertiary)" }}
        >
          Last updated: March 1, 2026
        </p>

        {/* Request Form */}
        {formState !== "success" ? (
          <div
            className="rounded-xl border p-6 mb-8"
            style={{
              backgroundColor: "var(--bg-elevated)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Trash2
                size={18}
                style={{ color: "var(--accent)" }}
              />
              <h2
                className="text-base font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Request Data Deletion
              </h2>
            </div>
            <p
              className="text-sm mb-5"
              style={{ color: "var(--text-secondary)" }}
            >
              Submit this form to request deletion of all personal data
              associated with your email address from StorageAds systems,
              including any data obtained through Meta&apos;s platform.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-gold)]/50"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Full Name (optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-gold)]/50"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Tell us why you'd like your data deleted..."
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-gold)]/50 resize-none"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {formState === "error" && errorMsg && (
                <div
                  className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm"
                  style={{
                    backgroundColor: "rgba(239,68,68,0.1)",
                    borderColor: "rgba(239,68,68,0.2)",
                    color: "#EF4444",
                  }}
                >
                  <AlertCircle size={14} />
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={formState === "submitting" || !email.trim()}
                className="flex items-center justify-center gap-2 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: "#EF4444",
                  color: "#fff",
                }}
              >
                {formState === "submitting" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Submitting Request...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Submit Deletion Request
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div
            className="rounded-xl border p-6 mb-8"
            style={{
              backgroundColor: "var(--bg-elevated)",
              borderColor: "rgba(34,197,94,0.3)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={18} style={{ color: "#22C55E" }} />
              <h2
                className="text-base font-semibold"
                style={{ color: "#22C55E" }}
              >
                Request received
              </h2>
            </div>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--text-secondary)" }}
            >
              Your data deletion request has been received. A confirmation
              email has been sent to <strong style={{ color: "var(--text-primary)" }}>{email}</strong>.
            </p>
            {confirmationId && (
              <div
                className="rounded-lg p-3 mb-4"
                style={{ backgroundColor: "var(--bg-surface)" }}
              >
                <p
                  className="text-xs mb-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Confirmation ID
                </p>
                <p
                  className="text-sm font-mono"
                  style={{ color: "var(--accent)" }}
                >
                  {confirmationId}
                </p>
              </div>
            )}
            <div
              className="space-y-2 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              <p className="flex items-center gap-2">
                <Clock size={14} style={{ color: "var(--accent)" }} />
                Acknowledgment within 5 business days
              </p>
              <p className="flex items-center gap-2">
                <CheckCircle
                  size={14}
                  style={{ color: "var(--accent)" }}
                />
                Deletion completed within 30 days
              </p>
              <p className="flex items-center gap-2">
                <Mail size={14} style={{ color: "var(--accent)" }} />
                Confirmation email when complete
              </p>
            </div>
            <button
              onClick={() => {
                setFormState("idle");
                setEmail("");
                setName("");
                setReason("");
                setConfirmationId(null);
              }}
              className="mt-4 text-xs underline"
              style={{ color: "var(--text-tertiary)" }}
            >
              Submit another request
            </button>
          </div>
        )}

        {/* What Gets Deleted */}
        <div
          className="rounded-xl border p-6 mb-6"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} style={{ color: "var(--accent)" }} />
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              What Gets Deleted
            </h2>
          </div>
          <ul
            className="space-y-2 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {[
              "Account information (name, email, phone number)",
              "Facility information you provided (name, location, occupancy, unit count)",
              "Client portal login credentials and access codes",
              "Messages and notes submitted through our forms or portal",
              "Campaign performance data associated with your account",
              "Any data obtained through Meta platform APIs on your behalf",
              "Lead capture form submissions",
              "Tenant records and payment history",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span
                  className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: "var(--accent)" }}
                />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* What May Be Retained */}
        <div
          className="rounded-xl border p-6 mb-6"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle
              size={18}
              style={{ color: "var(--text-tertiary)" }}
            />
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              What May Be Retained
            </h2>
          </div>
          <ul
            className="space-y-2 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            <li className="flex items-start gap-2">
              <span
                className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: "var(--text-tertiary)" }}
              />
              Financial transaction records (invoices, payment history) as
              required by tax and accounting regulations
            </li>
            <li className="flex items-start gap-2">
              <span
                className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: "var(--text-tertiary)" }}
              />
              Data necessary to comply with legal obligations or resolve
              disputes
            </li>
          </ul>
        </div>

        {/* Processing Timeline */}
        <div
          className="rounded-xl border p-6 mb-6"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} style={{ color: "var(--accent)" }} />
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Processing Timeline
            </h2>
          </div>
          <div className="space-y-4">
            {[
              {
                step: "1",
                title: "Request Received",
                desc: "Confirmation email sent immediately",
              },
              {
                step: "2",
                title: "Acknowledged",
                desc: "Within 5 business days",
              },
              {
                step: "3",
                title: "Data Deleted",
                desc: "Within 30 days of request",
              },
              {
                step: "4",
                title: "Confirmation Sent",
                desc: "Email confirming deletion is complete",
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
                  style={{
                    backgroundColor: "rgba(68,99,134,0.15)",
                    color: "var(--accent)",
                  }}
                >
                  {item.step}
                </div>
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {item.title}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Facebook / Instagram Section */}
        <div
          className="rounded-xl border p-6 mb-6"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <h2
            className="text-base font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            Facebook / Instagram Data
          </h2>
          <p
            className="text-sm mb-3"
            style={{ color: "var(--text-secondary)" }}
          >
            If you used Facebook or Instagram to interact with our services,
            you can also manage your data through Facebook&apos;s settings:
          </p>
          <ol
            className="space-y-1.5 text-sm list-decimal list-inside"
            style={{ color: "var(--text-secondary)" }}
          >
            <li>
              Go to your Facebook Settings &amp; Privacy &gt; Settings
            </li>
            <li>Navigate to Apps and Websites</li>
            <li>Find StorageAds and select Remove</li>
            <li>
              This will revoke our access to your Facebook data going
              forward
            </li>
          </ol>
          <p
            className="text-sm mt-3"
            style={{ color: "var(--text-tertiary)" }}
          >
            To ensure complete deletion from our systems, please also submit
            a deletion request using the form above.
          </p>
        </div>

        {/* Check Status */}
        <div
          className="rounded-xl border p-6 mb-6"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <h2
            className="text-base font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            Check Request Status
          </h2>
          <form
            onSubmit={handleStatusCheck}
            className="flex gap-2"
          >
            <input
              type="email"
              value={statusEmail}
              onChange={(e) => setStatusEmail(e.target.value)}
              placeholder="Enter your email"
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-gold)]/50"
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            />
            <button
              type="submit"
              disabled={checkingStatus || !statusEmail.trim()}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: "var(--bg-surface)",
                color: "var(--text-primary)",
              }}
            >
              {checkingStatus ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                "Check"
              )}
            </button>
          </form>
          {statusResult && (
            <div
              className="mt-3 rounded-lg p-3 text-sm"
              style={{ backgroundColor: "var(--bg-surface)" }}
            >
              <p style={{ color: "var(--text-secondary)" }}>
                Status:{" "}
                <span
                  className="font-medium capitalize"
                  style={{
                    color:
                      statusResult.status === "completed"
                        ? "#22C55E"
                        : statusResult.status === "acknowledged"
                          ? "var(--accent)"
                          : "#AB5505",
                  }}
                >
                  {statusResult.status}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Contact */}
        <div
          className="text-sm text-center py-6"
          style={{ color: "var(--text-tertiary)" }}
        >
          <p>Questions about data deletion? Contact us at:</p>
          <p className="mt-1">
            <a
              href="mailto:blake@storageads.com"
              style={{ color: "var(--accent)" }}
            >
              blake@storageads.com
            </a>{" "}
            | (269) 929-8541
          </p>
        </div>
      </main>
    </div>
  );
}
