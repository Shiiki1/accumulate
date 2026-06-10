"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { itemCategories, type ItemCategory } from "@/lib/categories";
import {
  deleteMediaItem,
  findMediaItem,
  updateMediaItem,
} from "@/lib/localArchive";
import { RelationshipMemory } from "@/components/RelationshipMemory";
import {
  IndicatorMultiSelect,
  selectedIndicatorsFor,
  useIndicators,
} from "@/components/ArchiveActions";
import { pageReveal } from "@/lib/motion";
import { getSourceRelationships } from "@/lib/relationships";
import { deleteStoredMediaFile, uploadMediaFile } from "@/lib/storage";
import type { DisplayItem, ImageType } from "@/lib/types";

type ItemDetailProps = {
  itemId: string;
};

export function ItemDetail({ itemId }: ItemDetailProps) {
  const router = useRouter();
  const [currentItem, setCurrentItem] = useState<DisplayItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const indicators = useIndicators();
  const relationships = useMemo(
    () => (currentItem ? getSourceRelationships("media", currentItem.id) : null),
    [currentItem],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCurrentItem(findMediaItem(itemId));
      if (window.sessionStorage.getItem("accumulate.editMediaId") === itemId) {
        window.sessionStorage.removeItem("accumulate.editMediaId");
        setIsEditing(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [itemId]);

  async function handleDelete() {
    if (!currentItem) return;

    const confirmed = window.confirm("Delete this item?");
    if (!confirmed) return;

    const imageUrlToDelete =
      currentItem.image_type === "upload" ? currentItem.image_url : null;
    deleteMediaItem(currentItem.id);
    void deleteStoredMediaFile(imageUrlToDelete).catch(() => undefined);
    router.replace("/app/media");
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentItem) return;

    setIsSaving(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      const title = String(formData.get("title") || "").trim();
      const sourceUrl = String(formData.get("source_url") || "").trim();
      const remoteImageUrl = String(formData.get("remote_image_url") || "").trim();
      const category = String(
        formData.get("category") || "Other",
      ) as ItemCategory;
      const tags = String(formData.get("tags") || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const notes = String(formData.get("notes") || "").trim();
      const file = formData.get("image");

      if (!title) {
        throw new Error("Title is required.");
      }

      let imageUrl = currentItem.image_url;
      let displayUrl = currentItem.display_url;
      let imageType: ImageType = currentItem.image_type;
      const imageUrlToDelete =
        currentItem.image_type === "upload" ? currentItem.image_url : null;

      if (file instanceof File && file.size > 0) {
        const uploaded = await uploadMediaFile(file);
        imageUrl = uploaded.publicUrl;
        displayUrl = uploaded.publicUrl;
        imageType = "upload";
      } else if (remoteImageUrl && remoteImageUrl !== currentItem.image_url) {
        imageUrl = remoteImageUrl;
        displayUrl = remoteImageUrl;
        imageType = "remote";
      }

      const updated = updateMediaItem({
        ...currentItem,
        title,
        image_url: imageUrl,
        image_type: imageType,
        source_url: sourceUrl || null,
        category,
        tags,
        notes: notes || null,
        display_url: displayUrl,
      });

      setCurrentItem(updated);
      setIsEditing(false);
      if (imageUrlToDelete && imageUrlToDelete !== imageUrl) {
        void deleteStoredMediaFile(imageUrlToDelete).catch(() => undefined);
      }
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update item.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!currentItem) {
    return (
      <>
        <div className="px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Link
              href="/app/media"
              className="inline-flex items-center gap-2 text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              <ArrowLeft size={15} strokeWidth={1.8} />
              Media
            </Link>
            <div className="grid min-h-[60vh] place-items-center text-sm text-[var(--muted)]">
              Item not found.
            </div>
          </div>
        </div>
      </>
    );
  }

  const isLocalImage =
    currentItem.display_url.startsWith("data:") ||
    currentItem.display_url.startsWith("blob:");
  const indicator =
    selectedIndicatorsFor(indicators, currentItem);

  return (
    <motion.main
      variants={pageReveal}
      initial="hidden"
      animate="visible"
      className="min-h-screen px-4 py-5 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center justify-between sm:mb-8">
          <Link
            href="/app/media"
            className="inline-flex items-center gap-2 text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            <ArrowLeft size={15} strokeWidth={1.8} />
            Media
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing((value) => !value)}
              className="archive-icon-button size-9 rounded-full border-[var(--line)] bg-[var(--surface-glass)]"
              aria-label={isEditing ? "Cancel edit" : "Edit item"}
              title={isEditing ? "Cancel edit" : "Edit item"}
            >
              {isEditing ? <X size={15} /> : <Pencil size={15} />}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="archive-icon-button size-9 rounded-full border-[var(--line)] bg-[var(--surface-glass)]"
              aria-label="Delete item"
              title="Delete item"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <motion.div
            layoutId={`item-image-${currentItem.id}`}
            className="image-skeleton relative min-h-[58vh] overflow-hidden border border-[var(--line)] bg-[var(--surface-soft)] lg:min-h-[82vh]"
          >
            <Image
              src={currentItem.display_url}
              alt={currentItem.title}
              fill
              priority
              unoptimized={isLocalImage}
              sizes="(min-width: 1024px) 68vw, 94vw"
              className="object-contain"
            />
          </motion.div>

          <aside className="lg:sticky lg:top-8">
            {isEditing ? (
              <form
                onSubmit={handleUpdate}
                className="archive-panel space-y-4 p-5 shadow-none"
              >
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Replace image
                  </span>
                  <input
                    name="image"
                    type="file"
                    accept="image/*"
                    className="archive-field w-full px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[var(--foreground)] file:px-3 file:py-1.5 file:text-xs file:text-[var(--background)]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Remote image URL
                  </span>
                  <input
                    name="remote_image_url"
                    type="url"
                    defaultValue={
                      currentItem.image_type === "remote"
                        ? currentItem.image_url
                        : ""
                    }
                    placeholder="Optional"
                    className="premium-focus archive-field h-11 w-full px-3 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Title
                  </span>
                  <input
                    name="title"
                    defaultValue={currentItem.title}
                    className="premium-focus archive-field h-11 w-full px-3 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Source URL
                  </span>
                  <input
                    name="source_url"
                    type="url"
                    defaultValue={currentItem.source_url || ""}
                    className="premium-focus archive-field h-11 w-full px-3 text-sm"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      Category
                    </span>
                    <select
                      name="category"
                      defaultValue={currentItem.category}
                      className="premium-focus archive-field h-11 w-full bg-[var(--background)] px-3 text-sm"
                    >
                      {itemCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      Indicator
                    </span>
                    <IndicatorMultiSelect
                      value={currentItem.indicator_ids}
                      legacyValue={currentItem.indicator_id}
                      onChange={(indicatorIds) =>
                        setCurrentItem({
                          ...currentItem,
                          indicator_ids: indicatorIds,
                        })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      Tags
                    </span>
                    <input
                      name="tags"
                      defaultValue={currentItem.tags.join(", ")}
                      className="premium-focus archive-field h-11 w-full px-3 text-sm"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Notes
                  </span>
                  <textarea
                    name="notes"
                    defaultValue={currentItem.notes || ""}
                    rows={6}
                    className="premium-focus archive-field w-full resize-none px-3 py-3 text-sm leading-6"
                  />
                </label>
                {error ? (
                  <p className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--foreground)] text-sm font-medium text-[var(--background)] transition hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : null}
                  Save changes
                </button>
              </form>
            ) : (
              <motion.div
                variants={pageReveal}
                initial="hidden"
                animate="visible"
                className="space-y-6"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    {currentItem.category}
                  </p>
                  <h1 className="font-serif-accent mt-3 text-5xl leading-none tracking-normal">
                    {currentItem.title}
                  </h1>
                </div>

                {currentItem.tags.length ? (
                  <div className="flex flex-wrap gap-2">
                    {currentItem.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {indicator.length ? (
                  <div className="space-y-2 border border-[var(--line)] px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      Indicators
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {indicator.map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-2 text-sm"
                        >
                          <span
                            className="size-1.5"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {currentItem.notes ? (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--muted)]">
                    {currentItem.notes}
                  </p>
                ) : null}

                {currentItem.source_url ? (
                  <a
                    href={currentItem.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[var(--foreground)] underline decoration-[var(--line)] underline-offset-4 transition hover:decoration-[var(--foreground)]"
                  >
                    Source
                    <ExternalLink size={14} strokeWidth={1.8} />
                  </a>
                ) : null}

                {relationships ? (
                  <RelationshipMemory
                    relationships={relationships}
                    related={["references", "ideas", "resources"]}
                  />
                ) : null}

                {error ? (
                  <p className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
                    {error}
                  </p>
                ) : null}
              </motion.div>
            )}
          </aside>
        </div>
      </div>
    </motion.main>
  );
}
