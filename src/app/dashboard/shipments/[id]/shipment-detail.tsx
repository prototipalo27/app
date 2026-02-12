"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Tables } from "@/lib/supabase/database.types";
import type { PacklinkTrackingEvent } from "@/lib/packlink/types";
import { linkShipmentToProject, unlinkShipmentFromProject, deleteShipment } from "../actions";

interface ShipmentDetailProps {
  shipment: Tables<"shipping_info">;
  linkedProject: { id: string; name: string } | null;
  availableProjects: { id: string; name: string }[];
  canDelete?: boolean;
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status?.toLowerCase() ?? "unknown";
  let classes = "rounded-full px-2 py-0.5 text-xs font-medium ";

  if (s === "delivered") {
    classes += "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  } else if (s.includes("transit") || s === "in_transit") {
    classes += "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400";
  } else {
    classes += "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }

  return <span className={classes}>{status ?? "unknown"}</span>;
}

export function ShipmentDetail({ shipment, linkedProject, availableProjects, canDelete }: ShipmentDetailProps) {
  const router = useRouter();
  const [tracking, setTracking] = useState<PacklinkTrackingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkProjectId, setLinkProjectId] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (shipment.packlink_shipment_ref) {
      fetchTracking(shipment.packlink_shipment_ref);
    }
  }, [shipment.packlink_shipment_ref]);

  async function fetchTracking(ref: string) {
    try {
      const res = await fetch(`/api/packlink/shipments/${ref}/tracking`);
      if (res.ok) {
        const data = await res.json();
        setTracking(data.history ?? []);
      }
    } catch {
      // Tracking may not be available yet
    }
  }

  async function downloadLabel() {
    if (!shipment.packlink_shipment_ref) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/packlink/shipments/${shipment.packlink_shipment_ref}/labels`);
      if (res.ok) {
        const labels = await res.json();
        if (labels.length > 0 && labels[0].url) {
          window.open(labels[0].url, "_blank");
        }
      }
    } catch {
      setError("Error fetching labels");
    } finally {
      setLoading(false);
    }
  }

  async function handleLink() {
    if (!linkProjectId) return;
    setLoading(true);
    setError(null);
    try {
      await linkShipmentToProject(shipment.id, linkProjectId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error linking project");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlink() {
    setLoading(true);
    setError(null);
    try {
      await unlinkShipmentFromProject(shipment.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error unlinking project");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      await deleteShipment(shipment.id);
      router.push("/dashboard/shipments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting shipment");
      setShowDeleteConfirm(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard/shipments"
          className="rounded-lg border border-zinc-300 p-1.5 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {shipment.title || linkedProject?.name || "Shipment"}
        </h1>
        <StatusBadge status={shipment.shipment_status} />
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Shipment details */}
      <div className="space-y-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Shipment details</h2>
          <div className="space-y-2">
            {shipment.packlink_shipment_ref && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Reference</span>
                <span className="font-mono font-medium text-zinc-900 dark:text-white">{shipment.packlink_shipment_ref}</span>
              </div>
            )}
            {shipment.carrier && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Carrier</span>
                <span className="font-medium text-zinc-900 dark:text-white">{shipment.carrier}</span>
              </div>
            )}
            {shipment.price != null && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Price</span>
                <span className="font-medium text-zinc-900 dark:text-white">{Number(shipment.price).toFixed(2)} EUR</span>
              </div>
            )}
            {shipment.tracking_number && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Tracking</span>
                <span className="font-mono font-medium text-zinc-900 dark:text-white">{shipment.tracking_number}</span>
              </div>
            )}
            {shipment.content_description && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Contents</span>
                <span className="font-medium text-zinc-900 dark:text-white">{shipment.content_description}</span>
              </div>
            )}
            {shipment.declared_value != null && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Declared value</span>
                <span className="font-medium text-zinc-900 dark:text-white">{Number(shipment.declared_value).toFixed(2)} EUR</span>
              </div>
            )}
          </div>
        </div>

        {/* Recipient & destination */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Recipient</h2>
          <div className="space-y-2">
            {shipment.recipient_name && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Name</span>
                <span className="font-medium text-zinc-900 dark:text-white">{shipment.recipient_name}</span>
              </div>
            )}
            {shipment.recipient_email && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Email</span>
                <span className="font-medium text-zinc-900 dark:text-white">{shipment.recipient_email}</span>
              </div>
            )}
            {shipment.recipient_phone && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Phone</span>
                <span className="font-medium text-zinc-900 dark:text-white">{shipment.recipient_phone}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">Destination</span>
              <span className="text-right font-medium text-zinc-900 dark:text-white">
                {[shipment.address_line, shipment.postal_code, shipment.city, shipment.country]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          </div>
        </div>

        {/* Package dimensions */}
        {(shipment.package_width || shipment.package_height || shipment.package_length || shipment.package_weight) && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Package</h2>
            <div className="grid grid-cols-4 gap-3 text-center">
              {shipment.package_width != null && (
                <div>
                  <p className="text-xs text-zinc-400">Width</p>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{shipment.package_width} cm</p>
                </div>
              )}
              {shipment.package_height != null && (
                <div>
                  <p className="text-xs text-zinc-400">Height</p>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{shipment.package_height} cm</p>
                </div>
              )}
              {shipment.package_length != null && (
                <div>
                  <p className="text-xs text-zinc-400">Length</p>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{shipment.package_length} cm</p>
                </div>
              )}
              {shipment.package_weight != null && (
                <div>
                  <p className="text-xs text-zinc-400">Weight</p>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{shipment.package_weight} kg</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Linked project */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Linked project</h2>
          {linkedProject ? (
            <div className="flex items-center justify-between">
              <Link
                href={`/dashboard/projects/${linkedProject.id}`}
                className="text-sm font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                {linkedProject.name}
              </Link>
              <button
                onClick={handleUnlink}
                disabled={loading}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Unlink
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={linkProjectId}
                onChange={(e) => setLinkProjectId(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Select a project…</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                onClick={handleLink}
                disabled={loading || !linkProjectId}
                className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
              >
                Link
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={downloadLabel}
            disabled={loading || !shipment.packlink_shipment_ref}
            className="rounded-lg border border-cyan-300 px-3 py-1.5 text-sm font-medium text-cyan-700 hover:bg-cyan-50 disabled:opacity-50 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-900/20"
          >
            {loading ? "Loading…" : "Download label"}
          </button>
          <button
            onClick={() => shipment.packlink_shipment_ref && fetchTracking(shipment.packlink_shipment_ref)}
            disabled={!shipment.packlink_shipment_ref}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Refresh tracking
          </button>
          {canDelete && !linkedProject && (
            <>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 dark:text-red-400">Confirm?</span>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
              )}
            </>
          )}
        </div>

        {/* Tracking timeline */}
        {tracking.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Tracking</h2>
            <div className="space-y-3">
              {tracking.map((event, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-cyan-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                    {i < tracking.length - 1 && <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-700" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{event.description}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {event.city && `${event.city} · `}
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
