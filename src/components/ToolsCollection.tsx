"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Info, Pencil, Plus, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AddToProjectButton,
  IndicatorFilter,
  selectedIndicatorsFor,
  useIndicators,
} from "@/components/ArchiveActions";
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
  type RelationshipSummary,
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

function filterButtonClass(isActive: boolean) {
  return `h-8 px-2.5 text-[11px] transition sm:h-9 sm:px-3 sm:text-xs ${
    isActive
      ? "border border-[var(--foreground)] text-[var(--foreground)]"
      : "archive-button"
  }`;
}

function ToolCategoryButtons({
  value,
  onChange,
}: {
  value: ToolCategory[];
  onChange: (categories: ToolCategory[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {toolCategories.map((category) => {
        const isActive = value.includes(category);

        return (
          <button
            key={category}
            type="button"
            onClick={() => toggleCategory(category, value, onChange)}
            className={`h-7 px-2 text-[10px] transition sm:h-8 sm:px-2.5 sm:text-[11px] ${
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

function primaryCategory(categories?: string[]) {
  return normalizeToolCategories(categories)[0] ?? "Resource";
}

function ToolCategoryChips({
  categories,
  compact = false,
}: {
  categories?: string[];
  compact?: boolean;
}) {
  const normalizedCategories = normalizeToolCategories(categories);

  if (!normalizedCategories.length) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "mt-4"}`}>
      {normalizedCategories.slice(0, compact ? 3 : undefined).map((category) => (
        <span
          key={category}
          className="archive-chip"
        >
          {category}
        </span>
      ))}
      {compact && normalizedCategories.length > 3 ? (
        <span className="archive-chip">+{normalizedCategories.length - 3}</span>
      ) : null}
    </div>
  );
}

function contextSentence(relationships: RelationshipSummary) {
  const parts = [
    relationships.usedProjects.length === 1
      ? `Used in ${relationships.usedProjects[0].title}`
      : relationships.usedProjects.length
        ? `Used in ${relationships.usedProjects.length} projects`
        : null,
    relationships.moodboardPlacements.length === 1
      ? "Added to 1 moodboard"
      : relationships.moodboardPlacements.length
        ? `Appears on ${relationships.moodboardPlacements.length} moodboards`
        : null,
    relationships.relatedReferences.length
      ? `Related to ${relationships.relatedReferences.length} reference${
          relationships.relatedReferences.length === 1 ? "" : "s"
        }`
      : null,
  ].filter(Boolean);

  return parts.join(" / ");
}

function previewTitles(items: { title: string }[]) {
  if (!items.length) return "";
  const visible = items.slice(0, 3).map((item) => item.title).join(", ");
  return items.length > 3 ? `${visible} +${items.length - 3}` : visible;
}

function ResourceInfoSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-[var(--line)] pt-4">
      <p className="archive-label text-[10px]">{label}</p>
      <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{children}</div>
    </section>
  );
}

type ToolDraft = {
  source_url?: string;
  name?: string;
  description?: string;
  saved_reason?: string;
  used_for?: string;
};

type SortOrder = "newest" | "oldest" | "title";
type ResourceUsageFilter = "all" | "used" | "unused";
type ViewMode = "cards" | "compact";

export function ToolsCollection() {
  const [items, setItems] = useState<WebsiteItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draftCategories, setDraftCategories] = useState<ToolCategory[]>([]);
  const [activeCategories, setActiveCategories] = useState<ToolCategory[]>([]);
  const [activeIndicatorIds, setActiveIndicatorIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [usageFilter, setUsageFilter] = useState<ResourceUsageFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [draftTool, setDraftTool] = useState<ToolDraft | null>(null);
  const [infoId, setInfoId] = useState<string | null>(null);
  const indicators = useIndicators();
  const isCompactView = viewMode === "compact";

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
  const infoItem = useMemo(
    () => items.find((item) => item.id === infoId) ?? null,
    [infoId, items],
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
    const indicatorMatch =
      !activeIndicatorIds.length ||
      selectedIndicatorsFor(indicators, item).some((indicator) =>
        activeIndicatorIds.includes(indicator.id),
      );
    const relationships = getSourceRelationships("website", item.id);
    const usageMatch =
      usageFilter === "all" ||
      (usageFilter === "used" && relationships.usedProjects.length > 0) ||
      (usageFilter === "unused" && relationships.usedProjects.length === 0);
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

    return categoryMatch && indicatorMatch && usageMatch && searchMatch;
  }).sort((a, b) => {
    if (sortOrder === "title") {
      return a.name.localeCompare(b.name);
    }

    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();

    return sortOrder === "oldest" ? aTime - bTime : bTime - aTime;
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
            <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--muted)]">
              Tools, websites, plugins, asset libraries, tutorials, and creative utilities.
            </p>
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
                <p className="archive-label ml-5 mr-1 text-[10px]">Usage</p>
                {([
                  ["all", "All"],
                  ["used", "Used"],
                  ["unused", "Unused"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setUsageFilter(value)}
                    className={filterButtonClass(usageFilter === value)}
                    aria-pressed={usageFilter === value}
                  >
                    {label}
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
                placeholder="Search resources"
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
            <div className="flex flex-wrap items-center gap-2">
              <p className="archive-label mr-1 text-[10px]">Function</p>
              <ToolCategoryButtons
                value={activeCategories}
                onChange={setActiveCategories}
              />
            </div>
          </div>
        </div>

        {filteredItems.length ? (
          <motion.section
            variants={staggerParent}
            initial="hidden"
            animate="visible"
            className={
              isCompactView
                ? "mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                : "mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            }
          >
            {filteredItems.map((item) => {
              const relationships = getSourceRelationships("website", item.id);
              const relationshipLine = relationshipStatsLine(
                relationships,
                { includeRelatedReferences: true },
              );
              const category = primaryCategory(item.categories);
              const contextText = item.used_for || item.saved_reason;

              return (
                <motion.article
                  data-layout-item
                  layout
                  variants={gridItemReveal}
                  key={item.id}
                  className={`archive-card relative flex h-full flex-col ${
                    isCompactView ? "p-3" : "p-4"
                  }`}
                >
                  <div className={`border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-soft)_72%,transparent)] ${
                    isCompactView ? "p-3" : "p-4"
                  }`}>
                    <div className="flex items-start justify-between gap-4">
                      <p className={`max-w-[70%] font-medium uppercase leading-tight tracking-[0.18em] text-[var(--foreground)] ${
                        isCompactView ? "text-sm" : "text-base"
                      }`}>
                        {category}
                      </p>
                      {!isCompactView && relationships.usedProjects.length ? (
                        <p className="archive-meta shrink-0 text-[10px]">
                          {relationships.usedProjects.length === 1
                            ? `Used in ${relationships.usedProjects[0].title}`
                            : `${relationships.usedProjects.length} projects`}
                        </p>
                      ) : null}
                    </div>
                    <p className={`${isCompactView ? "mt-3" : "mt-5"} truncate text-xs uppercase tracking-[0.2em] text-[var(--muted)]`}>
                      {item.domain ?? displayHost(item.source_url)}
                    </p>
                  </div>
                  <div className={`${isCompactView ? "mt-3" : "mt-4"} flex flex-1 items-start justify-between gap-4`}>
                    <div>
                      <h2 className={`${isCompactView ? "text-base" : "text-lg"} font-medium leading-snug`}>{item.name}</h2>
                      {!isCompactView && item.description ? (
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setInfoId(item.id)}
                        className="archive-icon-button size-8"
                        aria-label="Open resource info"
                      >
                        <Info size={14} />
                      </button>
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
                        onClick={() => {
                          if (infoId === item.id) setInfoId(null);
                          persist(items.filter((current) => current.id !== item.id));
                        }}
                        className="archive-icon-button size-8"
                        aria-label="Delete resource"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {item.used_for ? (
                    <div className="mt-4 border-t border-[var(--line)] pt-3">
                      <p className="archive-label text-[10px]">Used For</p>
                      <p className={`${isCompactView ? "line-clamp-1 text-xs leading-5" : "line-clamp-2 text-sm leading-6"} mt-1 text-[var(--foreground)]`}>
                        {item.used_for}
                      </p>
                    </div>
                  ) : contextText ? (
                    <div className="mt-4 border-t border-[var(--line)] pt-3">
                      <p className="archive-label text-[10px]">Saved Because</p>
                      <p className={`${isCompactView ? "line-clamp-1 text-xs leading-5" : "line-clamp-2 text-sm leading-6"} mt-1 text-[var(--muted)]`}>
                        {contextText}
                      </p>
                    </div>
                  ) : null}
                  {!isCompactView && item.used_for && item.saved_reason ? (
                    <p className="archive-meta mt-2 line-clamp-2">
                      Saved because: {item.saved_reason}
                    </p>
                  ) : null}
                  {!isCompactView ? (
                    <div className="mt-4">
                      <ToolCategoryChips categories={item.categories} compact />
                    </div>
                  ) : null}
                  {!isCompactView && relationshipLine ? (
                    <p className="archive-meta mt-3 border-t border-[var(--line)] pt-3">
                      {relationshipLine}
                    </p>
                  ) : !isCompactView ? (
                    <p className="archive-meta mt-3 border-t border-[var(--line)] pt-3">
                      Not used in a project yet.
                    </p>
                  ) : null}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                    <AddToProjectButton sourceType="website" sourceId={item.id} />
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
                    >
                      Open
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </motion.article>
              );
            })}
          </motion.section>
        ) : (
          <div className="grid min-h-[34vh] place-items-center px-4 text-center">
            <p className="archive-panel max-w-md p-5 text-sm leading-6 text-[var(--muted)]">
              {items.length
                ? "No resources match this view. Clear a category or search term to widen the toolkit."
                : "Save tools, websites, plugins, tutorials, references, and asset libraries here."}
            </p>
          </div>
        )}
      </motion.main>

      <AnimatePresence>
        {infoItem ? (
          <motion.div
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-[rgb(18_14_10_/_0.22)] px-4 py-8 backdrop-blur-md"
          >
            <motion.div
              variants={modalPanel}
              role="dialog"
              aria-modal="true"
              aria-label={`${infoItem.name} resource info`}
              className="archive-panel mx-auto max-h-[calc(100vh-4rem)] max-w-2xl overflow-y-auto bg-[var(--background)] p-5"
            >
              {(() => {
                const relationships = getSourceRelationships("website", infoItem.id);
                const memoryLine = contextSentence(relationships);

                return (
                  <div className="space-y-5">
                    <div className="flex items-start justify-between gap-5">
                      <div>
                        <p className="archive-label">
                          {infoItem.domain ?? displayHost(infoItem.source_url)}
                        </p>
                        <h2 className="mt-3 text-2xl font-medium leading-tight">
                          {infoItem.name}
                        </h2>
                        {infoItem.description ? (
                          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
                            {infoItem.description}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => setInfoId(null)}
                        className="archive-icon-button size-9 border-[var(--line)]"
                        aria-label="Close resource info"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <ResourceInfoSection label="Source">
                      <a
                        href={infoItem.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-[var(--foreground)] transition hover:text-[var(--muted)]"
                      >
                        {infoItem.source_url}
                        <ExternalLink size={13} />
                      </a>
                    </ResourceInfoSection>

                    <ResourceInfoSection label="Used For">
                      {infoItem.used_for ? (
                        <p className="text-[var(--foreground)]">{infoItem.used_for}</p>
                      ) : (
                        <p>Not assigned to a use yet.</p>
                      )}
                    </ResourceInfoSection>

                    <ResourceInfoSection label="Saved Reason">
                      {infoItem.saved_reason ? (
                        <p>{infoItem.saved_reason}</p>
                      ) : (
                        <p>No saved reason yet.</p>
                      )}
                    </ResourceInfoSection>

                    <ResourceInfoSection label="Appears In">
                      {memoryLine ? (
                        <p>{memoryLine}</p>
                      ) : (
                        <p>Not added to a moodboard or project yet.</p>
                      )}
                    </ResourceInfoSection>

                    <ResourceInfoSection label="Related Items">
                      {relationships.relatedReferences.length ||
                      relationships.relatedMedia.length ||
                      relationships.relatedIdeas.length ||
                      relationships.relatedResources.length ? (
                        <div className="space-y-2">
                          {relationships.relatedReferences.length ? (
                            <p>Related references: {previewTitles(relationships.relatedReferences)}</p>
                          ) : null}
                          {relationships.relatedMedia.length ? (
                            <p>Appears with media: {previewTitles(relationships.relatedMedia)}</p>
                          ) : null}
                          {relationships.relatedIdeas.length ? (
                            <p>Used with ideas: {previewTitles(relationships.relatedIdeas)}</p>
                          ) : null}
                          {relationships.relatedResources.length ? (
                            <p>Used with resources: {previewTitles(relationships.relatedResources)}</p>
                          ) : null}
                        </div>
                      ) : (
                        <p>No related items yet.</p>
                      )}
                    </ResourceInfoSection>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
                      <ToolCategoryChips categories={infoItem.categories} compact />
                      <div className="flex items-center gap-2">
                        <AddToProjectButton sourceType="website" sourceId={infoItem.id} />
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(infoItem.id);
                            setDraftTool(null);
                            setDraftCategories(normalizeToolCategories(infoItem.categories));
                            setInfoId(null);
                            setIsAdding(true);
                          }}
                          className="archive-button h-9 px-3 text-xs"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        ) : null}

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
