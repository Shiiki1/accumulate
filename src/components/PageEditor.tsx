"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { DragEvent as ReactDragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { ImagePlus, Layers, Trash2, Type, X } from "lucide-react";
import { MinimalHeader } from "@/components/MinimalHeader";
import {
  addPageItem,
  addSourceToProject,
  archiveEvents,
  findPage,
  readMediaItems,
  readPageItems,
  updatePage,
  updatePageItem,
  deletePageItem,
} from "@/lib/localArchive";
import type { DisplayItem, PageCanvasItem, PageItem } from "@/lib/types";

const pageWidth = 794;
const pageHeight = 1123;

type PageEditorProps = {
  pageId: string;
  embedded?: boolean;
  onClose?: () => void;
  panelWidth?: number;
  panelHeight?: number;
};

type PageComposerProps = {
  pageId: string;
  embedded?: boolean;
  onClose?: () => void;
  showHeader?: boolean;
  panelWidth?: number;
  panelHeight?: number;
};

export function PageComposer({
  pageId,
  embedded = false,
  onClose,
  showHeader = true,
  panelWidth = 420,
  panelHeight,
}: PageComposerProps) {
  const router = useRouter();
  const titleSaveTimer = useRef<number | null>(null);
  const itemSaveTimers = useRef<Record<string, number>>({});
  const [page, setPage] = useState<PageItem | null>(() => findPage(pageId));
  const [items, setItems] = useState<PageCanvasItem[]>(() =>
    readPageItems(pageId),
  );
  const [media, setMedia] = useState<DisplayItem[]>(() => readMediaItems());
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    function load() {
      setPage(findPage(pageId));
      setItems(readPageItems(pageId));
      setMedia(readMediaItems());
    }

    const frame = window.requestAnimationFrame(load);
    window.addEventListener(archiveEvents.pages, load);
    window.addEventListener(archiveEvents.pageItems, load);
    window.addEventListener(archiveEvents.media, load);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(archiveEvents.pages, load);
      window.removeEventListener(archiveEvents.pageItems, load);
      window.removeEventListener(archiveEvents.media, load);
    };
  }, [pageId]);

  useEffect(() => {
    return () => {
      if (titleSaveTimer.current) {
        window.clearTimeout(titleSaveTimer.current);
      }
      Object.values(itemSaveTimers.current).forEach((timer) =>
        window.clearTimeout(timer),
      );
      itemSaveTimers.current = {};
    };
  }, []);

  const mediaById = useMemo(() => {
    return new Map(media.map((item) => [item.id, item]));
  }, [media]);

  const embeddedPageWidth = Math.max(280, Math.min(680, panelWidth - 48));
  const embeddedPageHeight = Math.round(embeddedPageWidth * (pageHeight / pageWidth));
  const scale = embedded ? embeddedPageWidth / pageWidth : 1;
  const canvasWidth = embedded ? embeddedPageWidth : pageWidth;
  const canvasHeight = embedded ? embeddedPageHeight : pageHeight;

  function clampPageValue(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function renamePage(title: string) {
    if (!page) return;
    const nextTitle = title;
    const pageIdToSave = page.id;
    setPage({ ...page, title: nextTitle });

    if (titleSaveTimer.current) {
      window.clearTimeout(titleSaveTimer.current);
    }

    titleSaveTimer.current = window.setTimeout(() => {
      const updated = updatePage(pageIdToSave, {
        title: nextTitle.trim() || "Untitled Page",
      });
      if (updated) setPage(updated);
      titleSaveTimer.current = null;
    }, 450);
  }

  function flushPageTitle() {
    if (!page) return;
    if (titleSaveTimer.current) {
      window.clearTimeout(titleSaveTimer.current);
      titleSaveTimer.current = null;
    }
    const updated = updatePage(page.id, {
      title: page.title.trim() || "Untitled Page",
    });
    if (updated) setPage(updated);
  }

  function addImage(source: DisplayItem, position?: { x: number; y: number }) {
    const index = items.length;
    const width = 250;
    const height = 330;
    const created = addPageItem(pageId, {
      type: "image",
      source_id: source.id,
      content: null,
      x: position
        ? clampPageValue(Math.round(position.x - width / 2), 0, pageWidth - width)
        : 70 + (index % 3) * 42,
      y: position
        ? clampPageValue(Math.round(position.y - height / 2), 0, pageHeight - height)
        : 90 + Math.floor(index / 3) * 52,
      width,
      height,
      rotation: 0,
    });
    setIsPickerOpen(false);
    setItems(readPageItems(pageId));
    return created;
  }

  function handlePageDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    const mediaId =
      event.dataTransfer.getData("application/x-accumulate-media-id") ||
      event.dataTransfer.getData("text/plain");
    if (!mediaId) return;

    const source = media.find((item) => item.id === mediaId);
    if (!source) return;

    const rect = event.currentTarget.getBoundingClientRect();
    addImage(source, {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale,
    });
  }

  function addText() {
    addPageItem(pageId, {
      type: "text",
      source_id: null,
      content: "Short note",
      x: 86,
      y: 130 + items.length * 28,
      width: 260,
      height: 96,
      rotation: 0,
    });
    setItems(readPageItems(pageId));
  }

  function patchItem(itemId: string, patch: Partial<PageCanvasItem>) {
    if (itemSaveTimers.current[itemId]) {
      window.clearTimeout(itemSaveTimers.current[itemId]);
      delete itemSaveTimers.current[itemId];
    }
    const updated = updatePageItem(itemId, patch);
    if (!updated) return;
    setItems((current) =>
      current.map((item) => (item.id === itemId ? updated : item)),
    );
  }

  function patchItemDebounced(itemId: string, patch: Partial<PageCanvasItem>) {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );

    if (itemSaveTimers.current[itemId]) {
      window.clearTimeout(itemSaveTimers.current[itemId]);
    }

    itemSaveTimers.current[itemId] = window.setTimeout(() => {
      const updated = updatePageItem(itemId, patch);
      if (updated) {
        setItems((current) =>
          current.map((item) => (item.id === itemId ? updated : item)),
        );
      }
      delete itemSaveTimers.current[itemId];
    }, 450);
  }

  function flushItem(itemId: string) {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item) return;

    if (itemSaveTimers.current[itemId]) {
      window.clearTimeout(itemSaveTimers.current[itemId]);
      delete itemSaveTimers.current[itemId];
    }

    const updated = updatePageItem(itemId, item);
    if (updated) {
      setItems((current) =>
        current.map((candidate) => (candidate.id === itemId ? updated : candidate)),
      );
    }
  }

  function removeItem(itemId: string) {
    deletePageItem(itemId);
    setItems((current) => current.filter((item) => item.id !== itemId));
  }

  function addPageToMoodboard() {
    if (!page) return;
    addSourceToProject("page", page.id, page.project_id ?? undefined);
    router.push("/app/moodboard");
  }

  if (!page) {
    if (embedded) return null;

    return (
      <>
        <MinimalHeader />
        <main className="grid min-h-[calc(100vh-72px)] place-items-center px-6 text-center">
          <div>
            <p className="archive-label">Page not found</p>
            <button
              type="button"
              onClick={() => router.push("/app/media")}
              className="archive-button mt-5 h-10 px-4 text-sm"
            >
              Back to Media
            </button>
          </div>
        </main>
      </>
    );
  }

  const content = (
    <div
      className={
        embedded
          ? "sticky top-24 overflow-y-auto border border-[var(--line)] bg-[rgb(18_15_12)] p-4 text-[rgb(244_239_230)] shadow-[var(--shadow-soft)]"
          : "mx-auto flex max-w-7xl flex-col gap-5"
      }
      style={embedded && panelHeight ? { height: panelHeight } : undefined}
    >
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-white/45">
                Private visual sheet
              </p>
              <input
                value={page.title}
                onChange={(event) => renamePage(event.target.value)}
                onBlur={flushPageTitle}
                className={`mt-2 w-full bg-transparent font-serif-accent leading-none text-[rgb(244_239_230)] outline-none ${
                  embedded ? "text-3xl" : "text-5xl sm:text-6xl"
                }`}
                aria-label="Page title"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsPickerOpen((value) => !value)}
                className="archive-button inline-flex h-9 items-center gap-2 px-3 text-xs"
              >
                <ImagePlus size={14} />
                Add Image
              </button>
              <button
                type="button"
                onClick={addText}
                className="archive-button inline-flex h-9 items-center gap-2 px-3 text-xs"
              >
                <Type size={14} />
                Text
              </button>
              <button
                type="button"
                onClick={addPageToMoodboard}
                className="archive-button inline-flex h-9 items-center gap-2 px-3 text-xs"
              >
                <Layers size={14} />
                Add to Moodboard
              </button>
              {embedded && onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="archive-button inline-flex h-9 items-center gap-2 px-3 text-xs"
                >
                  <X size={14} />
                  Close
                </button>
              ) : null}
            </div>
          </div>

          {isPickerOpen ? (
            <section className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto border border-white/10 bg-white/[0.03] p-2 sm:grid-cols-5 lg:grid-cols-8">
              {media.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addImage(item)}
                  className="group relative aspect-[4/5] overflow-hidden bg-white/5"
                  title={item.title}
                >
                  <Image
                    src={item.display_url}
                    alt={item.title}
                    fill
                    sizes="120px"
                    unoptimized={item.display_url.startsWith("data:")}
                    className="object-cover opacity-80 transition group-hover:scale-[1.03] group-hover:opacity-100"
                  />
                </button>
              ))}
              {!media.length ? (
                <p className="col-span-full py-8 text-center text-sm text-white/45">
                  Add media first, then place it on a page.
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="overflow-auto pb-10">
            <div
              className="relative mx-auto bg-[rgb(239_235_225)] text-[rgb(30_25_20)] shadow-[0_28px_90px_rgb(0_0_0_/_0.38)]"
              style={{ width: canvasWidth, height: canvasHeight }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handlePageDrop}
            >
              {items.map((item) => {
                const source = item.source_id ? mediaById.get(item.source_id) : null;

                return (
                  <Rnd
                    key={item.id}
                    bounds="parent"
                    position={{ x: item.x * scale, y: item.y * scale }}
                    size={{ width: item.width * scale, height: item.height * scale }}
                    minWidth={(item.type === "image" ? 80 : 120) * scale}
                    minHeight={(item.type === "image" ? 80 : 48) * scale}
                    onDragStop={(_, data) =>
                      patchItem(item.id, {
                        x: Math.round(data.x / scale),
                        y: Math.round(data.y / scale),
                      })
                    }
                    onResizeStop={(_, __, ref, ___, position) =>
                      patchItem(item.id, {
                        x: Math.round(position.x / scale),
                        y: Math.round(position.y / scale),
                        width: Math.round(ref.offsetWidth / scale),
                        height: Math.round(ref.offsetHeight / scale),
                      })
                    }
                    data-page-item-id={item.id}
                    className="group border border-transparent transition hover:border-black/20"
                  >
                    {item.type === "image" && source ? (
                      <div className="relative h-full w-full overflow-hidden bg-black/5">
                        <Image
                          src={source.display_url}
                          alt={source.title}
                          fill
                          sizes="420px"
                          draggable={false}
                          unoptimized={source.display_url.startsWith("data:")}
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <textarea
                        value={item.content ?? ""}
                        onChange={(event) =>
                          patchItemDebounced(item.id, {
                            content: event.target.value,
                          })
                        }
                        onBlur={() => flushItem(item.id)}
                        className="h-full w-full resize-none bg-transparent p-3 font-serif-accent text-2xl leading-tight outline-none"
                        style={{ fontSize: embedded ? 18 : 24 }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="absolute right-1 top-1 grid size-7 place-items-center bg-[rgb(239_235_225)] text-black/45 opacity-0 transition hover:text-black group-hover:opacity-100"
                      aria-label="Delete page item"
                    >
                      <Trash2 size={13} />
                    </button>
                  </Rnd>
                );
              })}
              {!items.length ? (
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-black/35">
                      Private visual sheet
                    </p>
                    <p className="mt-3 max-w-xs text-sm leading-6 text-black/45">
                      Add media or a short text block to start composing.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
  );

  if (embedded) return content;

  return (
    <>
      {showHeader ? <MinimalHeader /> : null}
      <main className="min-h-[calc(100vh-72px)] bg-[rgb(18_15_12)] px-4 py-6 text-[var(--foreground)] sm:px-6 lg:px-8">
        {content}
      </main>
    </>
  );
}

export function PageEditor({
  pageId,
  embedded,
  onClose,
  panelWidth,
  panelHeight,
}: PageEditorProps) {
  return (
    <PageComposer
      pageId={pageId}
      embedded={embedded}
      onClose={onClose}
      showHeader={!embedded}
      panelWidth={panelWidth}
      panelHeight={panelHeight}
    />
  );
}
