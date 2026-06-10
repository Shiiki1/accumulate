"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clipboard,
  ImagePlus,
  Link2,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { itemCategories, type ItemCategory } from "@/lib/categories";
import { getImageFromClipboard, pastedImageTitle } from "@/lib/clipboard";
import {
  LOCAL_USER_ID,
  saveMediaItem,
} from "@/lib/localArchive";
import { IndicatorMultiSelect } from "@/components/ArchiveActions";
import { modalOverlay, modalPanel } from "@/lib/motion";
import { uploadMediaFile } from "@/lib/storage";
import type { DisplayItem, ImageType } from "@/lib/types";

type AddItemModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (item: DisplayItem) => void;
  pastedFile?: File | null;
};

type InputMode = "upload" | "remote";

export function AddItemModal({
  isOpen,
  onClose,
  onCreated,
  pastedFile,
}: AddItemModalProps) {
  const [mode, setMode] = useState<InputMode>("upload");
  const [file, setFile] = useState<File | null>(pastedFile ?? null);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [title, setTitle] = useState(() =>
    pastedFile ? pastedImageTitle(pastedFile) : "",
  );
  const [sourceUrl, setSourceUrl] = useState("");
  const [category, setCategory] = useState<ItemCategory>("Other");
  const [indicatorIds, setIndicatorIds] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const localPreviewUrl = useMemo(() => {
    return file ? URL.createObjectURL(file) : null;
  }, [file]);

  const remotePreviewUrl = remoteUrl.trim();
  const previewUrl = mode === "upload" ? localPreviewUrl : remotePreviewUrl;

  const handleFile = useCallback((nextFile?: File) => {
    if (!nextFile) return;
    setMode("upload");
    setFile(nextFile);
    setRemoteUrl("");
    setError(null);
    if (!title.trim()) {
      setTitle(pastedImageTitle(nextFile));
    }
  }, [title]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePaste(event: ClipboardEvent) {
      const pastedImage = getImageFromClipboard(event.clipboardData);
      if (!pastedImage) return;

      event.preventDefault();
      handleFile(pastedImage);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFile, isOpen]);

  function reset() {
    setMode("upload");
    setFile(null);
    setRemoteUrl("");
    setTitle("");
    setSourceUrl("");
    setCategory("Other");
    setIndicatorIds([]);
    setTags("");
    setNotes("");
    setError(null);
    setIsDragging(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    const cleanRemoteUrl = remoteUrl.trim();
    const cleanSourceUrl = sourceUrl.trim() || cleanRemoteUrl || null;

    if (!cleanTitle) {
      setError("Give the item a title.");
      return;
    }

    if (mode === "upload" && !file) {
      setError("Drop or choose an image.");
      return;
    }

    if (mode === "remote" && !cleanRemoteUrl) {
      setError("Paste an image URL.");
      return;
    }

    setIsSaving(true);

    try {
      let imageUrl = cleanRemoteUrl;
      let displayUrl = cleanRemoteUrl;
      let imageType: ImageType = "remote";

      if (mode === "upload" && file) {
        const uploaded = await uploadMediaFile(file);
        imageUrl = uploaded.publicUrl;
        displayUrl = uploaded.publicUrl;
        imageType = "upload";
      }

      const parsedTags = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      const item = saveMediaItem({
        id: crypto.randomUUID(),
        user_id: LOCAL_USER_ID,
        title: cleanTitle,
        image_url: imageUrl,
        image_type: imageType,
        source_url: cleanSourceUrl,
        category,
        indicator_ids: indicatorIds,
        tags: parsedTags,
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
        display_url: displayUrl,
      });

      onCreated(item);
      close();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save item.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          variants={modalOverlay}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 overflow-y-auto bg-[rgb(18_14_10_/_0.22)] px-3 py-3 backdrop-blur-md sm:px-5 sm:py-8"
        >
          <motion.div
            variants={modalPanel}
            role="dialog"
            aria-modal="true"
            aria-label="Add inspiration"
            className="quiet-panel mx-auto grid max-w-5xl overflow-hidden rounded-[18px] bg-[var(--background)] md:grid-cols-[1.02fr_0.98fr]"
          >
            <div className="relative min-h-[48vh] border-b border-[var(--line)] bg-[var(--surface-soft)] md:min-h-[720px] md:border-b-0 md:border-r">
              <div className="absolute left-4 top-4 z-10 flex rounded-full border border-white/30 bg-black/18 p-1 text-white backdrop-blur-xl">
                {(["upload", "remote"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setMode(option);
                      setError(null);
                    }}
                    className={`flex h-9 items-center gap-2 rounded-full px-3 text-xs transition ${
                      mode === option
                        ? "bg-white text-black"
                        : "text-white/78 hover:text-white"
                    }`}
                  >
                    {option === "upload" ? <Upload size={13} /> : <Link2 size={13} />}
                    {option === "upload" ? "Upload" : "URL"}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={close}
                className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full border border-white/30 bg-black/18 text-white backdrop-blur-xl transition hover:bg-black/32"
                aria-label="Close"
              >
                <X size={16} strokeWidth={1.8} />
              </button>

              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt="Preview"
                  fill
                  unoptimized={mode === "upload"}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <label
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    handleFile(event.dataTransfer.files?.[0]);
                  }}
                  className={`flex h-full min-h-[48vh] cursor-pointer flex-col items-center justify-center gap-5 px-8 text-center transition md:min-h-[720px] ${
                    isDragging ? "bg-[var(--surface)]" : ""
                  }`}
                >
                  <span className="grid size-16 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface-glass)]">
                    {mode === "upload" ? (
                      <ImagePlus size={22} strokeWidth={1.45} />
                    ) : (
                      <Link2 size={22} strokeWidth={1.45} />
                    )}
                  </span>
                  <span className="max-w-xs text-sm leading-6 text-[var(--muted)]">
                    {mode === "upload"
                      ? "Drop, paste, or choose an image from your device."
                      : "Paste a direct image link to preview it here."}
                  </span>
                  {mode === "upload" ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)]">
                      <Clipboard size={13} strokeWidth={1.6} />
                      Ctrl V
                    </span>
                  ) : null}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => handleFile(event.target.files?.[0])}
                  />
                </label>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex min-h-[560px] flex-col justify-between gap-8 p-5 sm:p-8"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  New reference
                </p>
                <h2 className="font-serif-accent mt-3 text-5xl leading-none">
                  Capture the feeling.
                </h2>
              </div>

              <div className="space-y-5">
                {mode === "remote" ? (
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      Image URL
                    </span>
                    <input
                      value={remoteUrl}
                      onChange={(event) => {
                        setRemoteUrl(event.target.value);
                        if (!sourceUrl) setSourceUrl(event.target.value);
                      }}
                      placeholder="https://..."
                      type="url"
                      className="premium-focus h-12 w-full rounded-md border border-[var(--line)] bg-transparent px-3 text-sm"
                    />
                  </label>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Title
                  </span>
                  <input
                    required
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Untitled study"
                    className="premium-focus h-12 w-full rounded-md border border-[var(--line)] bg-transparent px-3 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Source
                  </span>
                  <input
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                    placeholder="Optional"
                    type="url"
                    className="premium-focus h-12 w-full rounded-md border border-[var(--line)] bg-transparent px-3 text-sm"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      Category
                    </span>
                    <select
                      value={category}
                      onChange={(event) =>
                        setCategory(event.target.value as ItemCategory)
                      }
                      className="premium-focus h-12 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-3 text-sm"
                    >
                      {itemCategories.map((itemCategory) => (
                        <option key={itemCategory} value={itemCategory}>
                          {itemCategory}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      Indicator
                    </span>
                    <IndicatorMultiSelect
                      value={indicatorIds}
                      onChange={setIndicatorIds}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      Tags
                    </span>
                    <input
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="stone, chair, blue"
                      className="premium-focus h-12 w-full rounded-md border border-[var(--line)] bg-transparent px-3 text-sm"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Notes
                  </span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    placeholder="Texture, composition, material, memory..."
                    className="premium-focus w-full resize-none rounded-md border border-[var(--line)] bg-transparent px-3 py-3 text-sm leading-6"
                  />
                </label>

                {error ? (
                  <p className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
                    {error}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--foreground)] px-5 text-sm font-medium text-[var(--background)] transition duration-300 hover:scale-[1.01] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : null}
                {isSaving ? "Saving" : "Save to library"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
