"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import { AddItemModal } from "@/components/AddItemModal";
import {
  IndicatorFilter,
  selectedIndicatorsFor,
  useIndicators,
} from "@/components/ArchiveActions";
import { EmptyState } from "@/components/EmptyState";
import { MasonryGrid } from "@/components/MasonryGrid";
import { MinimalHeader } from "@/components/MinimalHeader";
import {
  commandActions,
  consumeQueuedCommandAction,
} from "@/lib/commandActions";
import { archiveEvents, readMediaItems, saveMediaItems } from "@/lib/localArchive";
import { pageReveal, softSpring } from "@/lib/motion";
import { getSourceRelationships } from "@/lib/relationships";
import type { DisplayItem } from "@/lib/types";

type AppShellProps = {
  initialItems: DisplayItem[];
};

type SortOrder = "newest" | "oldest" | "title";
type UsageFilter = "all" | "used" | "unused";
type ViewMode = "cards" | "compact";

function filterButtonClass(isActive: boolean) {
  return `h-8 px-2.5 text-[11px] transition sm:h-9 sm:px-3 sm:text-xs ${
    isActive
      ? "border border-[var(--foreground)] text-[var(--foreground)]"
      : "archive-button"
  }`;
}

export function AppShell({ initialItems }: AppShellProps) {
  const [items, setItems] = useState(initialItems);
  const [activeIndicatorIds, setActiveIndicatorIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [isAdding, setIsAdding] = useState(false);
  const [pastedFile, setPastedFile] = useState<File | null>(null);
  const indicators = useIndicators();
  const isCompactView = viewMode === "compact";

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return items.filter((item) => {
      const indicatorMatch =
        !activeIndicatorIds.length ||
        selectedIndicatorsFor(indicators, item).some((indicator) =>
          activeIndicatorIds.includes(indicator.id),
        );
      const relationship = getSourceRelationships("media", item.id);
      const usageMatch =
        usageFilter === "all" ||
        (usageFilter === "used" && relationship.moodboardPlacements.length > 0) ||
        (usageFilter === "unused" && relationship.moodboardPlacements.length === 0);
      const searchMatch =
        !normalizedSearch ||
        item.title.toLowerCase().includes(normalizedSearch) ||
        item.category.toLowerCase().includes(normalizedSearch) ||
        item.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));

      return indicatorMatch && usageMatch && searchMatch;
    }).sort((a, b) => {
      if (sortOrder === "title") {
        return a.title.localeCompare(b.title);
      }

      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();

      return sortOrder === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [activeIndicatorIds, indicators, items, search, sortOrder, usageFilter]);

  useEffect(() => {
    function loadItems() {
      const localItems = readMediaItems();
      setItems(localItems.length ? localItems : initialItems);
    }

    const frame = window.requestAnimationFrame(loadItems);
    window.addEventListener(archiveEvents.media, loadItems);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(archiveEvents.media, loadItems);
    };
  }, [initialItems]);

  useEffect(() => {
    function openAddMedia() {
      setIsAdding(true);
    }

    window.addEventListener(commandActions.addMedia, openAddMedia);
    if (consumeQueuedCommandAction(commandActions.addMedia)) {
      openAddMedia();
    }

    return () => window.removeEventListener(commandActions.addMedia, openAddMedia);
  }, []);

  function handleIndicatorChange(itemId: string, indicatorIds: string[]) {
    setItems((current) => {
      const nextItems = current.map((item) =>
        item.id === itemId ? { ...item, indicator_ids: indicatorIds } : item,
      );
      saveMediaItems(nextItems);
      return nextItems;
    });
  }

  return (
    <>
      <MinimalHeader />
      <motion.div initial="hidden" animate="visible" variants={pageReveal}>
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-3 pt-10 sm:px-6 lg:px-8 lg:pb-5 lg:pt-14">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
                Media collection
              </p>
              <h1 className="font-serif-accent mt-3 text-6xl leading-none sm:text-7xl">
                Reference field.
              </h1>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[var(--muted)]">
              Images, clips, textures, objects, and visual fragments gathered
              while a project takes shape.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
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
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search media"
              className="premium-focus h-10 w-full border border-[var(--line)] bg-transparent px-3 text-sm placeholder:text-[var(--muted)] md:w-64"
            />
          </div>
        </section>
      </motion.div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        {items.length === 0 ? (
          <EmptyState onAdd={() => setIsAdding(true)} />
        ) : filteredItems.length === 0 ? (
          <EmptyState filtered />
        ) : (
          <MasonryGrid
            items={filteredItems}
            onIndicatorChange={handleIndicatorChange}
            compact={isCompactView}
          />
        )}
      </main>

      <motion.button
        type="button"
        onClick={() => setIsAdding(true)}
        whileHover={{ scale: 1.06, y: -2 }}
        whileTap={{ scale: 0.94 }}
        transition={softSpring}
        className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-[var(--foreground)] text-[var(--background)] shadow-xl shadow-black/15 sm:bottom-7 sm:right-7"
        aria-label="Add item"
        title="Add item"
      >
        <Plus size={22} strokeWidth={1.6} />
      </motion.button>

      <AddItemModal
        key={
          pastedFile
            ? `${pastedFile.name}-${pastedFile.lastModified}-${pastedFile.size}`
            : "manual"
        }
        isOpen={isAdding}
        pastedFile={pastedFile}
        onClose={() => {
          setIsAdding(false);
          setPastedFile(null);
        }}
        onCreated={() => setItems(readMediaItems())}
      />
    </>
  );
}
