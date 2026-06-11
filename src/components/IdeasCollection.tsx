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
type SortOrder = "newest" | "oldest" | "title";
type ViewMode = "cards" | "compact";

function filterButtonClass(isActive: boolean) {
  return `h-8 px-2.5 text-[11px] transition sm:h-9 sm:px-3 sm:text-xs ${
    isActive
      ? "border border-[var(--foreground)] text-[var(--foreground)]"
      : "archive-button"
  }`;
}

export function IdeasCollection() {
  const [items, setItems] = useState<IdeaItem[]>([]);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftIndicatorIds, setDraftIndicatorIds] = useState<string[]>([]);
  const [activeIndicatorIds, setActiveIndicatorIds] = useState<string[]>([]);
  const [entryFilter, setEntryFilter] = useState<EntryFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [draftIdea, setDraftIdea] = useState<IdeaDraft | null>(null);
  const [draftEntryType, setDraftEntryType] =
    useState<NonNullable<IdeaItem["entry_type"]>>("idea");
  const indicators = useIndicators();
  const editingItem = items.find((item) => item.id === editingId) ?? null;
  const isCompactView = viewMode === "compact";

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
  }).sort((a, b) => {
    if (sortOrder === "title") {
      return a.title.localeCompare(b.title);
    }

    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();

    return sortOrder === "oldest" ? aTime - bTime : bTime - aTime;
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
            <p className="archive-label">Ideas & References</p>
            <h1 className="font-serif-accent mt-3 text-6xl leading-none sm:text-7xl">
              Notes and sources.
            </h1>
            <p className="archive-meta mt-5 max-w-xl text-sm leading-6">
              Ideas are your own working thoughts. References are external
              people, places, collections, sources, and visual cues worth
              remembering.
            </p>
            <p className="archive-meta mt-3 text-xs">
              {ideaCount} notes / {referenceCount} references
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
              Add note / reference
            </button>
          </div>
        </section>
        <div className="mt-7 border-b border-[var(--line)] pb-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <p className="archive-label mr-1 text-[10px]">Sort</p>
                {([
                  ["newest", "Newest"],
                  ["oldest", "Oldest"],
                  ["title", "Title A-Z"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSortOrder(value)}
                    className={filterButtonClass(sortOrder === value)}
                    aria-pressed={sortOrder === value}
                  >
                    {label}
                  </button>
                ))}
                <p className="archive-label ml-5 mr-1 text-[10px]">Type</p>
                {(["all", "idea", "reference"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setEntryFilter(filter)}
                    className={filterButtonClass(entryFilter === filter)}
                    aria-pressed={entryFilter === filter}
                  >
                    {filter === "all"
                      ? "All"
                      : filter === "idea"
                        ? "Notes"
                        : "References"}
                  </button>
                ))}
                <p className="archive-label ml-5 mr-1 text-[10px]">View</p>
                {([
                  ["cards", "Cards"],
                  ["compact", "Compact"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setViewMode(value)}
                    className={filterButtonClass(viewMode === value)}
                    aria-pressed={viewMode === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
                placeholder="Search ideas and references"
                className="premium-focus archive-field h-10 w-full px-3 text-sm md:w-64"
              />
            </div>
            {indicators.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="archive-label mr-1 text-[10px]">Indicators</p>
                <IndicatorFilter
                  selectedIds={activeIndicatorIds}
                  onChange={setActiveIndicatorIds}
                />
              </div>
            ) : null}
          </div>
        </div>

        {filteredItems.length ? (
          <motion.section
            variants={staggerParent}
            initial="hidden"
            animate="visible"
            className={
              isCompactView
                ? "mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "mt-12 grid gap-4 md:grid-cols-2"
            }
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
              const emptyReferenceContext = !item.body.trim();

              return (
                <motion.article
                  data-layout-item
                  layout
                  variants={gridItemReveal}
                  key={item.id}
                  className={`archive-card relative flex h-full flex-col ${
                    isReference
                      ? "border-[color-mix(in_srgb,var(--foreground)_18%,var(--line))] bg-[color-mix(in_srgb,var(--surface)_76%,transparent)] p-6"
                      : "border-[color-mix(in_srgb,var(--line)_72%,transparent)] bg-[color-mix(in_srgb,var(--surface)_44%,transparent)] p-5"
                  } ${isCompactView ? "!p-4" : ""
                  }`}
                >
                  <IndicatorMarks indicators={selectedIndicators} />
                  <div className="flex flex-1 items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div
                        className={`flex items-center justify-between gap-4 ${
                          isReference
                            ? "mb-4 border-b border-[var(--line)] pb-3"
                            : "mb-3"
                        }`}
                      >
                        <p className="archive-label text-[10px]">
                          {isReference ? "Reference / Source" : "Note"}
                        </p>
                        {relationships.moodboardPlacements.length ? (
                          <p className="archive-meta shrink-0 text-[10px]">
                            Appears on {relationships.moodboardPlacements.length}
                          </p>
                        ) : null}
                      </div>
                      {isReference ? (
                        <>
                          <h2 className="font-serif-accent text-3xl leading-none">
                            {item.title}
                          </h2>
                          <div className={`${isCompactView ? "mt-4" : "mt-5"} border-l border-[var(--line)] pl-4`}>
                            <p className="archive-label text-[9px]">
                              Source context
                            </p>
                            <p
                              className={`mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)] ${
                                isOpen ? "" : isCompactView ? "line-clamp-2" : "line-clamp-3"
                              } ${emptyReferenceContext ? "italic" : ""}`}
                            >
                              {emptyReferenceContext
                                ? "No context added yet."
                                : item.body}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <p
                            className={`max-w-[62ch] whitespace-pre-wrap font-serif-accent text-xl leading-8 text-[var(--foreground)] ${
                              isOpen ? "" : isCompactView ? "line-clamp-3" : "line-clamp-4"
                            }`}
                          >
                            {item.body}
                          </p>
                          <h2 className={`${isCompactView ? "mt-4" : "mt-5"} max-w-[62ch] text-sm font-medium leading-snug text-[var(--muted)]`}>
                            {item.title}
                          </h2>
                        </>
                      )}
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
                  <div className="mt-auto pt-5">
                    {relationshipLine ? (
                      <p className="archive-meta border-t border-[var(--line)] pt-3">
                        <span className="mr-1 text-[var(--foreground)]">
                          {isReference ? "Source memory" : "Connected to"}
                        </span>
                        {relationshipLine}
                      </p>
                    ) : null}
                    <div
                      className={`flex flex-wrap items-center gap-2 ${
                        relationshipLine ? "mt-4" : "border-t border-[var(--line)] pt-3"
                      }`}
                    >
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
                  </div>
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
                  ? "Idea / Note: your own thought, direction, plan, observation, or working note."
                  : "Reference / Source: external inspiration such as an artist, brand, collection, place, movement, material, or visual cue."}
              </p>
              <input
                name="title"
                required
                defaultValue={draftIdea?.title ?? ""}
                placeholder={
                  draftEntryType === "reference"
                    ? "Maison Margiela SS03"
                    : "Working title"
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
                    ? "Source context, why it matters, or where it came from"
                    : "Write the thought, direction, or observation"
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
