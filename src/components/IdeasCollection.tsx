"use client";

import { FormEvent, useEffect, useState } from "react";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
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
  const [draftIndicatorIds, setDraftIndicatorIds] = useState<string[]>([]);
  const [activeIndicatorIds, setActiveIndicatorIds] = useState<string[]>([]);
  const [entryFilter, setEntryFilter] = useState<EntryFilter>("all");
  const [search, setSearch] = useState("");
  const [draftIdea, setDraftIdea] = useState<IdeaDraft | null>(null);
  const [draftEntryType, setDraftEntryType] =
    useState<NonNullable<IdeaItem["entry_type"]>>("idea");
  const indicators = useIndicators();

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

    event.currentTarget.reset();
    setDraftIdea(null);
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
        <section className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
              Ideas & References
            </p>
            <h1 className="font-serif-accent mt-3 text-6xl leading-none sm:text-7xl">
              Index archive.
            </h1>
            <p className="mt-5 text-sm text-[var(--muted)]">
              {ideaCount} ideas / {referenceCount} references
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftIdea(null);
                setDraftEntryType("idea");
                setIsAdding(true);
              }}
              className="inline-flex h-11 w-fit items-center gap-2 border border-[var(--line)] px-4 text-sm text-[var(--foreground)] transition hover:border-[var(--foreground)]"
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
                className={`h-9 border px-3 text-xs capitalize transition ${
                  entryFilter === filter
                    ? "border-[var(--foreground)] text-[var(--foreground)]"
                    : "border-[var(--line)] text-[var(--muted)] hover:text-[var(--foreground)]"
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
            className="premium-focus h-10 w-full border border-[var(--line)] bg-transparent px-3 text-sm placeholder:text-[var(--muted)] md:w-64"
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

              return (
                <motion.article
                  variants={gridItemReveal}
                  key={item.id}
                  className={`relative border border-[var(--line)] bg-[var(--surface-glass)] ${
                    isReference ? "p-6" : "p-5"
                  }`}
                >
                  <IndicatorMarks indicators={selectedIndicators} />
                  <div className="flex items-start justify-between gap-4">
                    <div className={isReference ? "pr-2" : ""}>
                      <p className="mb-4 text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
                        {isReference ? "Reference" : "Idea"}
                      </p>
                      <h2
                        className={
                          isReference
                            ? "font-serif-accent text-3xl leading-none"
                            : "text-base font-medium"
                        }
                      >
                        {item.title}
                      </h2>
                      <p
                        className={`whitespace-pre-wrap text-sm text-[var(--muted)] ${
                          isReference
                            ? "mt-5 border-t border-[var(--line)] pt-4 leading-6"
                            : "mt-3 leading-7"
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
                        className="grid size-8 shrink-0 place-items-center border border-[var(--line)] text-[var(--muted)] transition hover:text-[var(--foreground)]"
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
                        onClick={() =>
                          persist(items.filter((current) => current.id !== item.id))
                        }
                        className="grid size-8 shrink-0 place-items-center border border-transparent text-[var(--muted)] transition hover:border-[var(--line)] hover:text-[var(--foreground)]"
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
              className="mx-auto max-w-xl space-y-4 border border-[var(--line)] bg-[var(--background)] p-5"
            >
              <div className="flex items-start justify-between gap-5">
                <h2 className="font-serif-accent text-4xl leading-none">
                  Add entry.
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setDraftIdea(null);
                    setDraftEntryType("idea");
                    setDraftIndicatorIds([]);
                  }}
                  className="grid size-9 place-items-center border border-[var(--line)] text-[var(--muted)]"
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
              <input
                name="title"
                required
                defaultValue={draftIdea?.title ?? ""}
                placeholder={
                  draftEntryType === "reference"
                    ? "Maison Margiela SS03"
                    : "Title"
                }
                className="premium-focus h-12 w-full border border-[var(--line)] bg-transparent px-3 text-sm"
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
                className="premium-focus w-full resize-none border border-[var(--line)] bg-transparent px-3 py-3 text-sm leading-6"
              />
              <IndicatorMultiSelect
                value={draftIndicatorIds}
                onChange={setDraftIndicatorIds}
              />
              <button
                type="submit"
                className="h-11 bg-[var(--foreground)] px-5 text-sm font-medium text-[var(--background)] transition hover:opacity-90"
              >
                Add entry
              </button>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
