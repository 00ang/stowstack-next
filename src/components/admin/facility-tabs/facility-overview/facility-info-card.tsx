"use client"

import { useState } from "react"
import {
  Loader2,
  Edit3,
  Check,
  X,
  MapPin,
  ExternalLink,
  Globe,
  Phone,
  Mail,
  User,
  Building2,
} from "lucide-react"
import { StarRating } from "./shared-ui"
import { authHeaders } from "@/lib/facility-auth"
import {
  OCCUPANCY_OPTIONS,
  BIGGEST_ISSUE_OPTIONS,
  type FacilityProp,
} from "./types"

export function FacilityInfoCard({
  facility,
  adminKey,
  onUpdate,
}: {
  facility: FacilityProp
  adminKey: string
  onUpdate: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editFields, setEditFields] = useState({
    name: facility.name || "",
    contact_name: facility.contact_name || "",
    contact_email: facility.contact_email || "",
    contact_phone: facility.contact_phone || "",
    website: facility.website || "",
    google_address: facility.google_address || "",
    occupancy_range: facility.occupancy_range || "",
    total_units: facility.total_units || "",
    biggest_issue: facility.biggest_issue || "",
    notes: facility.notes || "",
  })

  async function saveFacilityEdits() {
    setSaving(true)
    try {
      // Owners (facility tools, empty adminKey) save through their own route,
      // which can't touch notes or pipeline status.
      const res = await fetch(adminKey ? "/api/admin-facilities" : "/api/manage/facility", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(adminKey),
        },
        body: JSON.stringify({
          id: facility.id,
          ...editFields,
          notes: adminKey ? editFields.notes : undefined,
        }),
      })
      const data = await res.json()
      if (data.facility) {
        onUpdate()
      }
      setEditing(false)
    } catch {
      // Keep editing mode open on failure
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-elevated)]">
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 size={14} className="text-[var(--color-gold)]" />
          <h4 className="text-sm font-semibold text-[var(--color-dark)]">
            {facility.name}
          </h4>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-[var(--color-body-text)] hover:text-[var(--color-dark)] transition-colors"
          >
            <Edit3 size={11} /> Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={saveFacilityEdits}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1 bg-[var(--color-gold)] text-[var(--color-light)] text-xs font-medium rounded-lg hover:bg-[var(--color-gold-hover)] disabled:opacity-40 transition-colors"
            >
              {saving ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Check size={11} />
              )}{" "}
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 px-3 py-1 text-xs text-[var(--color-body-text)] hover:text-[var(--color-dark)] transition-colors"
            >
              <X size={11} /> Cancel
            </button>
          </div>
        )}
      </div>

      <div className="px-5 pb-5 border-t border-[var(--border-subtle)]">
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm pt-4">
            {/* Contact column */}
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-mid-gray)]">
                Contact
              </p>
              <input
                value={editFields.name}
                onChange={(e) =>
                  setEditFields((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Facility name"
                className="w-full px-3 py-2 bg-[var(--color-light)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors"
              />
              <input
                value={editFields.contact_name}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    contact_name: e.target.value,
                  }))
                }
                placeholder="Contact name"
                className="w-full px-3 py-2 bg-[var(--color-light)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors"
              />
              <input
                value={editFields.contact_email}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    contact_email: e.target.value,
                  }))
                }
                placeholder="Email"
                type="email"
                className="w-full px-3 py-2 bg-[var(--color-light)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors"
              />
              <input
                value={editFields.contact_phone}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    contact_phone: e.target.value,
                  }))
                }
                placeholder="Phone"
                className="w-full px-3 py-2 bg-[var(--color-light)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors"
              />
            </div>

            {/* Facility info column */}
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-mid-gray)]">
                Facility Info
              </p>
              <input
                value={editFields.website}
                onChange={(e) =>
                  setEditFields((f) => ({ ...f, website: e.target.value }))
                }
                placeholder="Website URL"
                className="w-full px-3 py-2 bg-[var(--color-light)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors"
              />
              <input
                value={editFields.google_address}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    google_address: e.target.value,
                  }))
                }
                placeholder="Google address"
                className="w-full px-3 py-2 bg-[var(--color-light)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors"
              />
              <select
                value={editFields.occupancy_range}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    occupancy_range: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 bg-[var(--color-light)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--color-dark)] focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors"
              >
                {OCCUPANCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                value={editFields.total_units}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    total_units: e.target.value,
                  }))
                }
                placeholder="Total units"
                type="number"
                className="w-full px-3 py-2 bg-[var(--color-light)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors"
              />
            </div>

            {/* Challenge column */}
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-mid-gray)]">
                Challenge
              </p>
              <select
                value={editFields.biggest_issue}
                onChange={(e) =>
                  setEditFields((f) => ({
                    ...f,
                    biggest_issue: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 bg-[var(--color-light)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--color-dark)] focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors"
              >
                {BIGGEST_ISSUE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes — full width; staff-only (holds internal notes) */}
            {adminKey && (
            <div className="sm:col-span-3">
              <textarea
                value={editFields.notes}
                onChange={(e) =>
                  setEditFields((f) => ({ ...f, notes: e.target.value }))
                }
                rows={3}
                placeholder="Notes about this facility..."
                className="w-full px-3 py-2 bg-[var(--color-light)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors resize-none"
              />
            </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm pt-4">
            {/* Contact display */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-mid-gray)] mb-2">
                Contact
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <User size={12} className="text-[var(--color-mid-gray)]" />
                  <p className="text-[var(--color-dark)]">
                    {facility.contact_name || (
                      <span className="text-[var(--color-mid-gray)]">--</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={12} className="text-[var(--color-mid-gray)]" />
                  <p className="text-[var(--color-body-text)]">
                    {facility.contact_email || "--"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-[var(--color-mid-gray)]" />
                  <p className="text-[var(--color-body-text)]">
                    {facility.contact_phone || "--"}
                  </p>
                </div>
              </div>
            </div>

            {/* Facility info display */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-mid-gray)] mb-2">
                Facility Info
              </p>
              <div className="space-y-1.5">
                <p className="text-[var(--color-dark)]">
                  Occupancy: {facility.occupancy_range || "--"}
                </p>
                <p className="text-[var(--color-dark)]">
                  Units: {facility.total_units || "--"}
                </p>
                <p className="text-[var(--color-dark)]">
                  Issue:{" "}
                  {facility.biggest_issue
                    ? BIGGEST_ISSUE_OPTIONS.find(
                        (o) => o.value === facility.biggest_issue
                      )?.label || facility.biggest_issue
                    : "--"}
                </p>
              </div>
            </div>

            {/* Google data display */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-mid-gray)] mb-2">
                Google Data
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-[var(--color-mid-gray)]" />
                  <p className="text-[var(--color-body-text)] text-xs">
                    {facility.google_address || "--"}
                  </p>
                </div>
                {facility.google_rating && (
                  <StarRating rating={facility.google_rating} />
                )}
                {facility.review_count != null && (
                  <p className="text-xs text-[var(--color-body-text)]">
                    {facility.review_count} reviews
                  </p>
                )}
                {facility.google_phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="text-[var(--color-mid-gray)]" />
                    <p className="text-xs text-[var(--color-body-text)]">
                      {facility.google_phone}
                    </p>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  {facility.website && (
                    <a
                      href={facility.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-gold)] hover:text-[var(--color-blue)] transition-colors"
                    >
                      <Globe size={10} /> Website
                      <ExternalLink size={9} />
                    </a>
                  )}
                  {facility.google_maps_url && (
                    <a
                      href={facility.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-gold)] hover:text-[var(--color-blue)] transition-colors"
                    >
                      <MapPin size={10} /> Maps
                      <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Notes display */}
            {facility.notes && (
              <div className="sm:col-span-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-mid-gray)] mb-1">
                  Notes
                </p>
                <p className="text-sm text-[var(--color-dark)]">{facility.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
