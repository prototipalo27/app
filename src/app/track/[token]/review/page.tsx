import { Suspense } from "react";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ClientReviewCarousel, { type ReviewEntry } from "./client-review-carousel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("tracking_token", token)
    .single();

  return {
    title: project ? `${project.name} — Revisar fotos` : "Revisar fotos",
  };
}

type ChecklistEntry = {
  line1: string;
  line2?: string;
  photo_path?: string;
  client_status?: "pending" | "approved" | "issue";
  client_comment?: string;
  client_reviewed_at?: string;
};

type ChecklistData = {
  entries?: ChecklistEntry[];
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ReviewContent params={params} />
    </Suspense>
  );
}

async function ReviewContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, tracking_token, client_confirmed_at")
    .eq("tracking_token", token)
    .single();

  if (!project) notFound();

  const { data: items } = await supabase
    .from("project_checklist_items")
    .select("id, name, data")
    .eq("project_id", project.id)
    .eq("item_type", "name_list")
    .order("position");

  // Aplanar todas las entries con foto en un único carrusel
  const reviewEntries: ReviewEntry[] = [];
  for (const item of items ?? []) {
    const entries = (item.data as ChecklistData | null)?.entries ?? [];
    entries.forEach((entry, idx) => {
      if (!entry.photo_path) return;
      reviewEntries.push({
        itemId: item.id,
        itemName: item.name,
        entryIndex: idx,
        line1: entry.line1,
        line2: entry.line2,
        clientStatus: entry.client_status ?? "pending",
        clientComment: entry.client_comment,
      });
    });
  }

  if (reviewEntries.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
            <span className="text-lg font-bold text-zinc-900 dark:text-white">
              Prototipalo
            </span>
            <Link
              href={`/track/${token}/confirm`}
              className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              ← Volver
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-12 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay fotos para revisar. Vuelve más tarde.
          </p>
        </main>
      </div>
    );
  }

  return (
    <ClientReviewCarousel
      token={token}
      projectName={project.name}
      entries={reviewEntries}
      alreadyConfirmed={!!project.client_confirmed_at}
    />
  );
}
