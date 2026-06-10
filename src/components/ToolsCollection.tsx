"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AddToProjectButton } from "@/components/ArchiveActions";
import { MinimalHeader } from "@/components/MinimalHeader";
import {
  commandActions,
  consumeQueuedCommandDraft,
  consumeQueuedCommandAction,
} from "@/lib/commandActions";
import { normalizeUrl, titleFromUrl, urlDomain } from "@/lib/clipboard";
import {
  archiveEvents,
  LOCAL_USER_ID,
  readWebsiteItems,
  saveWebsiteItems,
} from "@/lib/localArchive";
import {
  modalOverlay,
  modalPanel,
  pageReveal,
  staggerParent,
  gridItemReveal,
} from "@/lib/motion";
import {
  getSourceRelationships,
  relationshipStatsLine,
} from "@/lib/relationships";
import {
  normalizeToolCategories,
  toolCategories,
  type ToolCategory,
} from "@/lib/toolCategories";
import type { WebsiteItem } from "@/lib/types";

function displayHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function toggleCategory(
  category: ToolCategory,
  selected: ToolCategory[],
  onChange: (categories: ToolCategory[]) => void,
) {
  onChange(
    selected.includes(category)
      ? selected.filter((current) => current !== category)
      : [...selected, category],
  );
}

function ToolCategoryButtons({
  value,
  onChange,
}: {
  value: ToolCategory[];
  onChange: (categories: ToolCategory[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {toolCategories.map((category) => {
        const isActive = value.includes(category);

        return (
          <button
            key={category}
            type="button"
            onClick={() => toggleCategory(category, value, onChange)}
            className={`h-8 px-3 text-xs transition ${
              isActive
                ? "border border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                : "archive-button"
            }`}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}

function ToolCategoryChips({ categories }: { categories?: string[] }) {
  const normalizedCategories = normalizeToolCategories(categories);

  if (!normalizedCategories.length) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {normalizedCategories.map((category) => (
        <span
          key={category}
          className="archive-chip"
        >
          {category}
        </span>
      ))}
    </div>
  );
}

type ToolDraft = {
  source_url?: string;
  name?: string;
  description?: string;
  saved_reason?: string;
  used_for?: string;
};

export function ToolsCollection() {
  const [items, setItems] = useState<WebsiteItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draftCategories, setDraftCategories] = useState<ToolCategory[]>([]);
  const [activeCategories, setActiveCategories] = useState<ToolCategory[]>([]);
  const [search, setSearch] = useState("");
  const [draftTool, setDraftTool] = useState<ToolDraft | null>(null);

  useEffect(() => {
    function loadItems() {
      setItems(readWebsiteItems());
    }

    const frame = window.requestAnimationFrame(loadItems);
    window.addEventListener(archiveEvents.websites, loadItems);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(archiveEvents.websites, loadItems);
    };
  }, []);

  useEffect(() => {
    function openAddTool() {
      const inlineDraft = window.sessionStorage.getItem(
        "accumulate.inlineToolDraft",
      );
      if (inlineDraft) {
        window.sessionStorage.removeItem("accumulate.inlineToolDraft");
        setDraftTool(JSON.parse(inlineDraft) as ToolDraft);
      } else {
        setDraftTool(consumeQueuedCommandDraft<ToolDraft>(commandActions.addTool));
      }
      setEditingId(null);
      setDraftCategories([]);
      setIsAdding(true);
    }

    window.addEventListener(commandActions.addTool, openAddTool);
    if (consumeQueuedCommandAction(commandActions.addTool)) {
      openAddTool();
    }

    return () => window.removeEventListener(commandActions.addTool, openAddTool);
  }, []);

  useEffect(() => {
    const editId = window.sessionStorage.getItem("accumulate.editResourceId");
    if (!editId || !items.length) return;

    const item = items.find((current) => current.id === editId);
    if (!item) return;

    window.sessionStorage.removeItem("accumulate.editResourceId");
    const timer = window.setTimeout(() => {
      setEditingId(item.id);
      setDraftTool(null);
      setDraftCategories(normalizeToolCategories(item.categories));
      setIsAdding(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [items]);

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingId) ?? null,
    [editingId, items],
  );

  function persist(nextItems: WebsiteItem[]) {
    setItems(nextItems);
    saveWebsiteItems(nextItems);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const sourceUrl = normalizeUrl(String(formData.get("source_url") || ""));
    const name =
      String(formData.get("name") || "").trim() || titleFromUrl(sourceUrl);
    const description = String(formData.get("description") || "").trim();
    const savedReason = String(formData.get("saved_reason") || "").trim();
    const usedFor = String(formData.get("used_for") || "").trim();

    if (!sourceUrl) return;

    if (editingItem) {
      persist(
        items.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                name,
                description,
                saved_reason: savedReason,
                used_for: usedFor,
                source_url: sourceUrl,
                domain: urlDomain(sourceUrl),
                categories: draftCategories,
              }
            : item,
        ),
      );
      setEditingId(null);
      setIsAdding(false);
      setDraftTool(null);
      setDraftCategories([]);
    } else {
      persist([
        {
          id: crypto.randomUUID(),
          user_id: LOCAL_USER_ID,
          name,
          description,
          saved_reason: savedReason,
          used_for: usedFor,
          source_url: sourceUrl,
          domain: urlDomain(sourceUrl),
          categories: draftCategories,
          created_at: new Date().toISOString(),
        },
        ...items,
      ]);
      setIsAdding(false);
      setDraftTool(null);
      setDraftCategories([]);
    }

    event.currentTarget.reset();
  }

  const filteredItems = items.filter((item) => {
    const categoryMatch =
      !activeCategories.length ||
      normalizeToolCategories(item.categories).some((category) =>
        activeCategories.includes(category),
      );
    const normalizedSearch = search.trim().toLowerCase();
    const searchMatch =
      !normalizedSearch ||
      item.name.toLowerCase().includes(normalizedSearch) ||
      item.description.toLowerCase().includes(normalizedSearch) ||
      (item.saved_reason ?? "").toLowerCase().includes(normalizedSearch) ||
      (item.used_for ?? "").toLowerCase().includes(normalizedSearch) ||
      item.source_url.toLowerCase().includes(normalizedSearch) ||
      (item.domain ?? displayHost(item.source_url))
        .toLowerCase()
        .includes(normalizedSearch);

    return categoryMatch && searchMatch;
  });

  return (
    <>
      <MinimalHeader />
      <motion.main
        variants={pageReveal}
        initial="hidden"
        animate="visible"
        className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pt-14"
      >
        <section className="flex flex-col gap-8 border-b border-[var(--line)] pb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="archive-label">
              Resources
            </p>
            <h1 className="font-serif-accent mt-3 text-6xl leading-none sm:text-7xl">
              Creative toolkit.
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setDraftTool(null);
              setDraftCategories([]);
              setIsAdding(true);
            }}
            className="archive-button inline-flex h-11 w-fit items-center gap-2 px-4 text-sm"
          >
            <Plus size={15} />
            Add Resource
          </button>
        </section>
        <div className="mt-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <ToolCategoryButtons
              value={activeCategories}
              onChange={setActiveCategories}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search resources"
              className="premium-focus archive-field h-10 w-full px-3 text-sm md:w-64"
            />
          </div>
        </div>

        {filteredItems.length ? (
          <motion.section
            variants={staggerParent}
            initial="hidden"
            animate="visible"
            className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filteredItems.map((item) => {
              const relationshipLine = relationshipStatsLine(
                getSourceRelationships("website", item.id),
                { includeRelatedReferences: true },
              );

              return (
              <motion.article
                variants={gridItemReveal}
                key={item.id}
                className="archive-card relative p-4"
              >
                <div className="grid aspect-[16/8] place-items-center border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-soft)_72%,transparent)] px-4 text-center text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  {item.domain ?? displayHost(item.source_url)}
                </div>
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-medium">{item.name}</h2>
                    {item.description ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                        {item.description}
                      </p>
                    ) : null}
                    {item.used_for ? (
                      <p className="archive-meta mt-3 line-clamp-1">
                        Used for: {item.used_for}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setDraftTool(null);
                        setDraftCategories(normalizeToolCategories(item.categories));
                        setIsAdding(true);
                      }}
                      className="archive-icon-button size-8"
                      aria-label="Edit resource"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        persist(items.filter((current) => current.id !== item.id))
                      }
                      className="archive-icon-button size-8"
                      aria-label="Delete resource"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex items-center gap-2 text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  Open resource
                  <ExternalLink size={14} />
                </a>
                <ToolCategoryChips categories={item.categories} />
                {item.saved_reason ? (
                  <p className="archive-meta mt-3 line-clamp-2 border-t border-[var(--line)] pt-3">
                    Saved because: {item.saved_reason}
                  </p>
                ) : null}
                {relationshipLine ? (
                  <p className="archive-meta mt-3 border-t border-[var(--line)] pt-3">
                    {relationshipLine}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <AddToProjectButton sourceType="website" sourceId={item.id} />
                </div>
              </motion.article>
              );
            })}
          </motion.section>
        ) : (
          <div className="grid min-h-[34vh] place-items-center text-sm text-[var(--muted)]">
            {items.length ? "No resources match these categories." : "No resources saved yet."}
          </div>
        )}
      </motion.main>

      <AnimatePresence>
        {isAdding ? (
          <motion.div
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-[rgb(18_14_10_/_0.22)] px-4 py-8 backdrop-blur-md"
          >
            <motion.form
              variants={modalPanel}
              onSubmit={handleSubmit}
              className="archive-panel mx-auto max-w-xl space-y-4 bg-[var(--background)] p-5"
            >
              <div className="flex items-start justify-between gap-5">
                <h2 className="font-serif-accent text-4xl leading-none">
                  {editingItem ? "Edit resource." : "Add resource."}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                    setDraftTool(null);
                    setDraftCategories([]);
                  }}
                    className="archive-icon-button size-9 border-[var(--line)]"
                  aria-label="Close source dialog"
                >
                  <X size={16} />
                </button>
              </div>
              <input
                key={editingItem?.id ?? "url"}
                name="source_url"
                type="url"
                required
                defaultValue={editingItem?.source_url ?? draftTool?.source_url ?? ""}
                placeholder="https://..."
                className="premium-focus archive-field h-12 w-full px-3 text-sm"
              />
              <input
                key={`${editingItem?.id ?? "new"}-name`}
                name="name"
                defaultValue={editingItem?.name ?? draftTool?.name ?? ""}
                placeholder="Name, optional"
                className="premium-focus archive-field h-12 w-full px-3 text-sm"
              />
              <input
                key={`${editingItem?.id ?? "new"}-description`}
                name="description"
                defaultValue={editingItem?.description ?? draftTool?.description ?? ""}
                placeholder="One-sentence function"
                className="premium-focus archive-field h-12 w-full px-3 text-sm"
              />
              <input
                key={`${editingItem?.id ?? "new"}-used-for`}
                name="used_for"
                defaultValue={editingItem?.used_for ?? draftTool?.used_for ?? ""}
                placeholder="Used for, optional"
                className="premium-focus archive-field h-12 w-full px-3 text-sm"
              />
              <textarea
                key={`${editingItem?.id ?? "new"}-saved-reason`}
                name="saved_reason"
                rows={3}
                defaultValue={
                  editingItem?.saved_reason ?? draftTool?.saved_reason ?? ""
                }
                placeholder="Saved because, optional"
                className="premium-focus archive-field w-full resize-none px-3 py-3 text-sm leading-6"
              />
              <div className="space-y-3">
                <p className="archive-label">
                  Resource type / categories
                </p>
                <ToolCategoryButtons
                  value={draftCategories}
                  onChange={setDraftCategories}
                />
              </div>
              <button
                type="submit"
                className="h-11 bg-[var(--foreground)] px-5 text-sm font-medium text-[var(--background)] transition hover:opacity-90"
              >
                {editingItem ? "Save edit" : "Add resource"}
              </button>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
