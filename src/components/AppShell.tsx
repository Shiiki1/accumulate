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
import type { DisplayItem } from "@/lib/types";

type AppShellProps = {
  initialItems: DisplayItem[];
};

export function AppShell({ initialItems }: AppShellProps) {
  const [items, setItems] = useState(initialItems);
  const [activeIndicatorIds, setActiveIndicatorIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [pastedFile, setPastedFile] = useState<File | null>(null);
  const indicators = useIndicators();

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return items.filter((item) => {
      const indicatorMatch =
        !activeIndicatorIds.length ||
        selectedIndicatorsFor(indicators, item).some((indicator) =>
          activeIndicatorIds.includes(indicator.id),
        );
      const searchMatch =
        !normalizedSearch ||
        item.title.toLowerCase().includes(normalizedSearch) ||
        item.category.toLowerCase().includes(normalizedSearch) ||
        item.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));

      return indicatorMatch && searchMatch;
    });
  }, [activeIndicatorIds, indicators, items, search]);

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
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <IndicatorFilter
              selectedIds={activeIndicatorIds}
              onChange={setActiveIndicatorIds}
            />
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
