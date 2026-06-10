"use client";

import { FormEvent, useEffect, useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AddToProjectButton,
  IndicatorFilter,
  IndicatorMarks,
  IndicatorMultiSelect,
  selectedIndicatorsFor,
  useIndicators,
} from "@/components/ArchiveActions";
import { MinimalHeader } from "@/components/MinimalHeader";
import {
  commandActions,
  consumeQueuedCommandDraft,
  consumeQueuedCommandAction,
} from "@/lib/commandActions";
import {
  archiveEvents,
  LOCAL_USER_ID,
  readIdeaItems,
  saveIdeaItems,
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
import type { IdeaItem } from "@/lib/types";

type IdeaDraft = {
  entry_type?: IdeaItem["entry_type"];
  title?: string;
  body?: string;
};

type EntryFilter = "all" | "idea" | "reference";

export function IdeasCollection() {
  const [items, setItems] = useState<IdeaItem[]>([]);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftIndicatorIds, setDraftIndicatorIds] = useState<string[]>([]);
  const [activeIndicatorIds, setActiveIndicatorIds] = useState<string[]>([]);
  const [entryFilter, setEntryFilter] = useState<EntryFilter>("all");
  const [search, setSearch] = useState("");
  const [draftIdea, setDraftIdea] = useState<IdeaDraft | null>(null);
  const [draftEntryType, setDraftEntryType] =
    useState<NonNullable<IdeaItem["entry_type"]>>("idea");
  const indicators = useIndicators();
  const editingItem = items.find((item) => item.id === editingId) ?? null;

  useEffect(() => {
    function loadItems() {
      setItems(readIdeaItems());
    }

    const frame = window.requestAnimationFrame(loadItems);
    window.addEventListener(archiveEvents.ideas, loadItems);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(archiveEvents.ideas, loadItems);
    };
  }, []);

  useEffect(() => {
    function openAddIdea() {
      const inlineDraft = window.sessionStorage.getItem(
        "accumulate.inlineIdeaDraft",
      );
      let nextDraft: IdeaDraft | null = null;
      if (inlineDraft) {
        window.sessionStorage.removeItem("accumulate.inlineIdeaDraft");
        nextDraft = JSON.parse(inlineDraft) as IdeaDraft;
      } else {
        nextDraft = consumeQueuedCommandDraft<IdeaDraft>(commandActions.addIdea);
      }
      setDraftIdea(nextDraft);
      setDraftEntryType(nextDraft?.entry_type ?? "idea");
      setDraftIndicatorIds([]);
      setIsAdding(true);
    }

    window.addEventListener(commandActions.addIdea, openAddIdea);
    if (consumeQueuedCommandAction(commandActions.addIdea)) {
      openAddIdea();
    }

    return () => window.removeEventListener(commandActions.addIdea, openAddIdea);
  }, []);

  useEffect(() => {
    const editId = window.sessionStorage.getItem("accumulate.editIdeaId");
    if (!editId || !items.length) return;

    const item = items.find((current) => current.id === editId);
    if (!item) return;

    window.sessionStorage.removeItem("accumulate.editIdeaId");
    const timer = window.setTimeout(() => {
      setEditingId(item.id);
      setDraftIdea({
        entry_type: item.entry_type ?? "idea",
        title: item.title,
        body: item.body,
      });
      setDraftEntryType(item.entry_type ?? "idea");
      setDraftIndicatorIds(item.indicator_ids ?? []);
      setIsAdding(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [items]);

  function persist(nextItems: IdeaItem[]) {
    setItems(nextItems);
    saveIdeaItems(nextItems);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") || "").trim();
    const body = String(formData.get("body") || "").trim();
    const entryType =
      formData.get("entry_type") === "reference" ? "reference" : "idea";

    if (!title || (entryType === "idea" && !body)) return;

    if (editingItem) {
      persist(
        items.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                entry_type: entryType,
                title,
                body,
                indicator_ids: draftIndicatorIds,
              }
            : item,
        ),
      );
    } else {
      persist([
        {
          id: crypto.randomUUID(),
          user_id: LOCAL_USER_ID,
          entry_type: entryType,
          title,
          body,
          indicator_ids: draftIndicatorIds,
          created_at: new Date().toISOString(),
        },
        ...items,
      ]);
    }

    event.currentTarget.reset();
    setDraftIdea(null);
    setEditingId(null);
    setDraftEntryType("idea");
    setDraftIndicatorIds([]);
    setIsAdding(false);
  }

  function handleIndicatorChange(itemId: string, indicatorIds: string[]) {
    persist(
      items.map((item) =>
        item.id === itemId ? { ...item, indicator_ids: indicatorIds } : item,
      ),
    );
  }

  const filteredItems = items.filter((item) => {
    const indicatorMatch =
      !activeIndicatorIds.length ||
      selectedIndicatorsFor(indicators, item).some((indicator) =>
        activeIndicatorIds.includes(indicator.id),
      );
    const normalizedSearch = search.trim().toLowerCase();
    const entryMatch =
      entryFilter === "all" || (item.entry_type ?? "idea") === entryFilter;
    const searchMatch =
      !normalizedSearch ||
      item.title.toLowerCase().includes(normalizedSearch) ||
      item.body.toLowerCase().includes(normalizedSearch);

    return indicatorMatch && entryMatch && searchMatch;
  });

  const ideaCount = items.filter((item) => (item.entry_type ?? "idea") === "idea").length;
  const referenceCount = items.filter(
    (item) => (item.entry_type ?? "idea") === "reference",
  ).length;

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
              Ideas & References
            </p>
            <h1 className="font-serif-accent mt-3 text-6xl leading-none sm:text-7xl">
              Index archive.
            </h1>
            <p className="archive-meta mt-5 text-sm">
              {ideaCount} ideas / {referenceCount} references
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftIdea(null);
                setEditingId(null);
                setDraftEntryType("idea");
                setIsAdding(true);
              }}
              className="archive-button inline-flex h-11 w-fit items-center gap-2 px-4 text-sm"
            >
              <Plus size={15} />
              Add Entry
            </button>
          </div>
        </section>
        <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["all", "idea", "reference"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setEntryFilter(filter)}
                className={`h-9 px-3 text-xs capitalize transition ${
                  entryFilter === filter
                    ? "border border-[var(--foreground)] text-[var(--foreground)]"
                    : "archive-button"
                }`}
              >
                {filter === "all"
                  ? "All"
                  : filter === "idea"
                    ? "Ideas"
                    : "References"}
              </button>
            ))}
            <IndicatorFilter
              selectedIds={activeIndicatorIds}
              onChange={setActiveIndicatorIds}
            />
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ideas and references"
            className="premium-focus archive-field h-10 w-full px-3 text-sm md:w-64"
          />
        </div>

        {filteredItems.length ? (
          <motion.section
            variants={staggerParent}
            initial="hidden"
            animate="visible"
            className="mt-12 grid gap-4 md:grid-cols-2"
          >
            {filteredItems.map((item) => {
              const isOpen = openIds.includes(item.id);
              const selectedIndicators = selectedIndicatorsFor(indicators, item);
              const isReference = (item.entry_type ?? "idea") === "reference";
              const relationships = getSourceRelationships("idea", item.id);
              const relationshipLine = relationshipStatsLine(
                relationships,
                isReference
                  ? { includeRelatedMedia: true, includeRelatedIdeas: true }
                  : { includeRelatedReferences: true },
              );

              return (
                <motion.article
                  variants={gridItemReveal}
                  key={item.id}
                  className={`archive-card relative ${
                    isReference
                      ? "bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] p-6"
                      : "bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] p-5"
                  }`}
                >
                  <IndicatorMarks indicators={selectedIndicators} />
                  <div className="flex items-start justify-between gap-4">
                    <div className={isReference ? "pr-2" : ""}>
                      <div
                        className={`mb-4 flex items-center justify-between gap-4 ${
                          isReference ? "border-b border-[var(--line)] pb-3" : ""
                        }`}
                      >
                        <p className="archive-label text-[10px]">
                          {isReference ? "Reference / Source" : "Idea / Thought"}
                        </p>
                        {relationships.moodboardPlacements.length ? (
                          <p className="archive-meta shrink-0 text-[10px]">
                            Appears on {relationships.moodboardPlacements.length}
                          </p>
                        ) : null}
                      </div>
                      <h2
                        className={
                          isReference
                            ? "font-serif-accent text-3xl leading-none"
                            : "text-lg font-medium leading-snug"
                        }
                      >
                        {item.title}
                      </h2>
                      <p
                        className={`whitespace-pre-wrap text-sm text-[var(--muted)] ${
                          isReference
                            ? "mt-5 leading-6"
                            : "mt-4 max-w-[62ch] font-serif-accent text-lg leading-7"
                        } ${
                          isOpen ? "" : "line-clamp-3"
                        }`}
                      >
                        {item.body}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenIds((current) =>
                            isOpen
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id],
                          )
                        }
                        className="archive-icon-button size-8 shrink-0 border-[var(--line)]"
                        aria-label={isOpen ? "Collapse entry" : "Expand entry"}
                      >
                        <ChevronDown
                          size={15}
                          className={`transition duration-300 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);
                          setDraftIdea({
                            entry_type: item.entry_type ?? "idea",
                            title: item.title,
                            body: item.body,
                          });
                          setDraftEntryType(item.entry_type ?? "idea");
                          setDraftIndicatorIds(item.indicator_ids ?? []);
                          setIsAdding(true);
                        }}
                        className="archive-icon-button size-8 shrink-0"
                        aria-label="Edit entry"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          persist(items.filter((current) => current.id !== item.id))
                        }
                        className="archive-icon-button size-8 shrink-0"
                        aria-label="Delete entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <IndicatorMultiSelect
                      compact
                      value={item.indicator_ids}
                      legacyValue={item.indicator_id}
                      onChange={(indicatorIds) =>
                        handleIndicatorChange(item.id, indicatorIds)
                      }
                    />
                    <AddToProjectButton sourceType="idea" sourceId={item.id} />
                  </div>
                  {relationshipLine ? (
                    <p className="archive-meta mt-4 border-t border-[var(--line)] pt-3">
                      <span className="mr-1 text-[var(--foreground)]">
                        {isReference ? "Evidence" : "Memory"}
                      </span>
                      {relationshipLine}
                    </p>
                  ) : null}
                </motion.article>
              );
            })}
          </motion.section>
        ) : (
          <div className="grid min-h-[34vh] place-items-center text-sm text-[var(--muted)]">
            {items.length
              ? "No entries match this view."
              : "No ideas or references saved yet."}
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
                  {editingItem ? "Edit entry." : "Add entry."}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setDraftIdea(null);
                    setEditingId(null);
                    setDraftEntryType("idea");
                    setDraftIndicatorIds([]);
                  }}
                    className="archive-icon-button size-9 border-[var(--line)]"
                  aria-label="Close idea dialog"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 border border-[var(--line)]">
                {(["idea", "reference"] as const).map((entryType) => (
                  <label
                    key={entryType}
                    className={`flex h-10 cursor-pointer items-center justify-center text-sm transition ${
                      draftEntryType === entryType
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="entry_type"
                      value={entryType}
                      checked={draftEntryType === entryType}
                      onChange={() => setDraftEntryType(entryType)}
                      className="sr-only"
                    />
                    {entryType === "idea" ? "Idea" : "Reference"}
                  </label>
                ))}
              </div>
              <p className="archive-meta leading-5">
                {draftEntryType === "idea"
                  ? "Idea: your own note, concept, direction, or plan."
                  : "Reference: an external artist, brand, collection, aesthetic, place, or visual concept."}
              </p>
              <input
                name="title"
                required
                defaultValue={draftIdea?.title ?? ""}
                placeholder={
                  draftEntryType === "reference"
                    ? "Maison Margiela SS03"
                    : "Title"
                }
                className="premium-focus archive-field h-12 w-full px-3 text-sm"
              />
              <textarea
                name="body"
                required={draftEntryType === "idea"}
                rows={5}
                defaultValue={draftIdea?.body ?? ""}
                placeholder={
                  draftEntryType === "reference"
                    ? "Optional context or note"
                    : "Idea"
                }
                className="premium-focus archive-field w-full resize-none px-3 py-3 text-sm leading-6"
              />
              <IndicatorMultiSelect
                value={draftIndicatorIds}
                onChange={setDraftIndicatorIds}
              />
              <button
                type="submit"
                className="h-11 bg-[var(--foreground)] px-5 text-sm font-medium text-[var(--background)] transition hover:opacity-90"
              >
                {editingItem ? "Save edit" : "Add entry"}
              </button>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
