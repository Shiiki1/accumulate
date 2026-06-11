"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Rnd } from "react-rnd";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch";
import {
  ChevronDown,
  Copy,
  ExternalLink,
  Bookmark,
  Info,
  Minus,
  Palette,
  Pencil,
  Plus,
  Trash2,
  Type,
  X,
} from "lucide-react";
import {
  selectedIndicatorsFor,
} from "@/components/ArchiveActions";
import { MinimalHeader } from "@/components/MinimalHeader";
import { RelationshipMemory } from "@/components/RelationshipMemory";
import { openQuickCapture } from "@/components/UniversalCapture";
import {
  commandActions,
  consumeQueuedCommandAction,
} from "@/lib/commandActions";
import {
  LOCAL_USER_ID,
  addBoardElement,
  cloneBoardItem,
  cloneProject,
  createPinboard,
  deleteBoardItem,
  deletePinboard,
  readActiveProjectId,
  archiveEvents,
  readBoardItems,
  readIdeaItems,
  readIndicators,
  readMediaItems,
  readPinboards,
  readProjects,
  readWebsiteItems,
  saveActiveProjectId,
  saveProjects,
  updateBoardItem,
} from "@/lib/localArchive";
import { modalOverlay, modalPanel, pageReveal } from "@/lib/motion";
import { getSourceRelationships } from "@/lib/relationships";
import type {
  BoardItem,
  DisplayItem,
  IdeaItem,
  IndicatorItem,
  PinboardItem,
  ProjectItem,
  WebsiteItem,
} from "@/lib/types";

type SourceItem = DisplayItem | WebsiteItem | IdeaItem;

type ResolvedBoardItem = BoardItem & {
  source?: SourceItem;
  indicators: IndicatorItem[];
};

type BoardSectionProps = {
  board: PinboardItem;
  items: ResolvedBoardItem[];
  isFirst: boolean;
  isLast: boolean;
  onAddText: (boardId: string) => void;
  onAddReference: (boardId: string) => void;
  onAddSeparator: (boardId: string) => void;
  onAddColor: (boardId: string) => void;
  onAddBoard: () => void;
  onDeleteBoard: (boardId: string) => void;
  onPatchItem: (itemId: string, patch: Partial<BoardItem>) => void;
  snapMode: SnapMode;
  onSnapModeChange: (mode: SnapMode) => void;
  onMoveStop: (
    item: ResolvedBoardItem,
    node: HTMLElement,
    position: { x: number; y: number },
  ) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
};

type ContextMenuState = {
  item: ResolvedBoardItem;
  x: number;
  y: number;
} | null;

type SnapMode = "free" | "soft";

const snapModeKey = "accumulate.snapMode";
const boardWindowHeightsKey = "accumulate.boardWindowHeights";
const snapGrid = 24;
const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const fitBoardZoom = 0.5;
const workspaceWidth = 6000;
const workspaceHeight = 3600;
const defaultBoardWindowHeight = 720;
const minViewportHeight = 560;
const maxViewportHeight = 3200;
const resizeAutoScrollEdge = 80;
const resizeAutoScrollStep = 18;
const zoomExclusions = [
  "board-pan-exclude",
  "button",
  "a",
  "input",
  "textarea",
  "select",
];

function snapValue(value: number, mode: SnapMode) {
  return mode === "soft" ? Math.round(value / snapGrid) * snapGrid : value;
}

function zoomLabel(zoom: number) {
  return `${Math.round(zoom * 100)}%`;
}

function clampBoardWindowHeight(height: number) {
  return Math.min(
    maxViewportHeight,
    Math.max(minViewportHeight, Math.round(height)),
  );
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;

  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toUpperCase() : null;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbLabel(hex: string) {
  const rgb = hexToRgb(hex);
  return rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : "";
}

function isLightColor(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;

  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 170;
}

function readBoardWindowHeight(boardId: string) {
  if (typeof window === "undefined") return defaultBoardWindowHeight;

  try {
    const saved = JSON.parse(
      window.localStorage.getItem(boardWindowHeightsKey) ?? "{}",
    ) as Record<string, number>;
    return clampBoardWindowHeight(saved[boardId] ?? defaultBoardWindowHeight);
  } catch {
    return defaultBoardWindowHeight;
  }
}

function saveBoardWindowHeight(boardId: string, height: number) {
  if (typeof window === "undefined") return;

  try {
    const saved = JSON.parse(
      window.localStorage.getItem(boardWindowHeightsKey) ?? "{}",
    ) as Record<string, number>;
    window.localStorage.setItem(
      boardWindowHeightsKey,
      JSON.stringify({
        ...saved,
        [boardId]: clampBoardWindowHeight(height),
      }),
    );
  } catch {
    // View-window size is a local preference. Ignore storage failures.
  }
}

function fixedGridStyle() {
  return {
    backgroundImage:
      "linear-gradient(color-mix(in srgb, var(--board-grid) 24%, transparent) 1px, transparent 1px), " +
      "linear-gradient(90deg, color-mix(in srgb, var(--board-grid) 24%, transparent) 1px, transparent 1px), " +
      "linear-gradient(color-mix(in srgb, var(--board-line-strong) 18%, transparent) 1px, transparent 1px), " +
      "linear-gradient(90deg, color-mix(in srgb, var(--board-line-strong) 18%, transparent) 1px, transparent 1px)",
    backgroundSize: "48px 48px, 48px 48px, 192px 192px, 192px 192px",
    backgroundPosition: "0 0, 0 0, 0 0, 0 0",
  };
}

function sourceTitle(source: SourceItem) {
  if ("name" in source) return source.name;
  return source.title;
}

function sourceText(source: SourceItem) {
  if ("description" in source) return source.description;
  if ("body" in source) return source.body;
  return source.category;
}

function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function itemHeight(item: BoardItem) {
  if (isColorSwatchItem(item)) return item.height ?? 120;
  if (item.source_type === "media") return Math.round(item.width * 1.25);
  if (item.source_type === "separator") return item.height ?? 4;
  if (item.source_type === "reference") return item.height ?? 124;
  return item.height ?? 160;
}

function isColorSwatchItem(item: BoardItem) {
  return item.source_type === "text" && item.reference_title === "color-swatch";
}

function sourceRoute(sourceType: BoardItem["source_type"]) {
  if (sourceType === "media") return "/app/media";
  if (sourceType === "website") return "/app/tools";
  if (sourceType === "idea") return "/app/ideas";
  return null;
}

function sourceDetailRoute(item: ResolvedBoardItem) {
  if (item.source_type === "media") return `/app/item/${item.source_id}`;
  return sourceRoute(item.source_type);
}

function sourceLabel(item: ResolvedBoardItem) {
  if (isColorSwatchItem(item)) return "color";

  if (item.source_type === "idea" && item.source && "body" in item.source) {
    return item.source.entry_type === "reference" ? "reference" : "idea";
  }

  if (item.source_type === "website") return "resource";

  return item.source_type;
}

function boardObjectClass(
  item: ResolvedBoardItem,
  isLibraryReference: boolean,
) {
  if (item.source_type === "separator") return "border-transparent bg-transparent";
  if (item.source_type === "media") return "board-object board-object-media";
  if (item.source_type === "website") return "board-object board-object-resource";
  if (item.source_type === "reference") return "board-object board-object-reference";
  if (isColorSwatchItem(item)) return "board-object-color";
  if (item.source_type === "text") {
    return item.text_box_enabled ? "board-object board-object-text" : "";
  }

  return isLibraryReference
    ? "board-object board-object-reference"
    : "board-object board-object-idea";
}

function BoardCard({
  item,
  onPatchItem,
  onMoveStop,
  onContextMenu,
  snapMode,
  zoom,
}: {
  item: ResolvedBoardItem;
  onPatchItem: (itemId: string, patch: Partial<BoardItem>) => void;
  onMoveStop: (
    item: ResolvedBoardItem,
    node: HTMLElement,
    position: { x: number; y: number },
  ) => void;
  onContextMenu: (event: ReactMouseEvent, item: ResolvedBoardItem) => void;
  snapMode: SnapMode;
  zoom: number;
}) {
  const height = itemHeight(item);
  const isSeparator = item.source_type === "separator";
  const isVerticalSeparator =
    item.separator_orientation === "vertical" && isSeparator;
  const separatorThickness = item.separator_thickness ?? 4;
  const isLibraryReference =
    item.source && "body" in item.source
      ? (item.source.entry_type ?? "idea") === "reference"
      : false;
  const isColorSwatch = isColorSwatchItem(item);
  const colorHex = normalizeHexColor(item.content ?? item.text_color ?? "") ?? "#E8E1D6";
  const lightColor = isLightColor(colorHex);

  return (
    <Rnd
      bounds="parent"
      cancel="[data-board-control]"
      dragHandleClassName={
        item.source_type === "text" && !isColorSwatch
          ? "board-drag-handle"
          : undefined
      }
      minWidth={isVerticalSeparator ? separatorThickness : isSeparator ? 100 : 90}
      minHeight={isVerticalSeparator ? 100 : isSeparator ? separatorThickness : 64}
      lockAspectRatio={item.source_type === "media" ? 0.8 : false}
      scale={zoom}
      position={{ x: item.x, y: item.y }}
      dragGrid={snapMode === "soft" ? [snapGrid, snapGrid] : undefined}
      resizeGrid={snapMode === "soft" ? [snapGrid, snapGrid] : undefined}
      size={{
        width: isVerticalSeparator ? separatorThickness : item.width,
        height: isVerticalSeparator ? height || 280 : height,
      }}
      enableResizing={{
        top: false,
        right: isSeparator && !isVerticalSeparator,
        bottom: isSeparator && isVerticalSeparator,
        left: false,
        topRight: false,
        bottomRight: !isSeparator,
        bottomLeft: false,
        topLeft: false,
      }}
      resizeHandleStyles={{
        right: { right: 0, width: 8 },
        bottom: { bottom: 0, height: 8 },
        bottomRight: {
          right: 4,
          bottom: 4,
          width: 13,
          height: 13,
          borderRight: "1px solid var(--board-card-text)",
          borderBottom: "1px solid var(--board-card-text)",
          opacity: 0.45,
        },
      }}
      onDragStop={(_, data) => onMoveStop(item, data.node, data)}
      onResizeStop={(_, __, ref, ___, position) =>
        onPatchItem(item.id, {
          x: Math.round(position.x),
          y: Math.round(position.y),
          width: isVerticalSeparator
            ? separatorThickness
            : Math.round(ref.offsetWidth),
          height: isSeparator
            ? isVerticalSeparator
              ? Math.round(ref.offsetHeight)
              : separatorThickness
            : Math.round(ref.offsetHeight),
        })
      }
      onContextMenu={(event: ReactMouseEvent) => onContextMenu(event, item)}
      data-board-object
      className={`board-pan-exclude group cursor-grab transition-shadow duration-200 active:cursor-grabbing active:shadow-[var(--shadow-soft)] ${
        boardObjectClass(item, isLibraryReference)
      } ${isSeparator ? "" : "overflow-hidden"}`}
    >
      {item.indicators.length ? (
        <div className="absolute inset-y-0 left-0 z-10 flex w-1.5 flex-col overflow-hidden">
          {item.indicators.map((indicator) => (
            <span
              key={indicator.id}
              className="min-h-2 flex-1"
              style={{ backgroundColor: indicator.color }}
              title={indicator.name}
            />
          ))}
        </div>
      ) : null}

      {item.source_type === "separator" ? (
        <div
          className="h-full w-full"
          style={{ backgroundColor: item.separator_color ?? "var(--board-line-strong)" }}
        />
      ) : item.source_type === "reference" ? (
        <div className="flex h-full flex-col p-4">
          <div className="flex items-center justify-between border-b border-[var(--board-card-border)] pb-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--board-muted)]">
              Reference
            </p>
            <span className="text-[10px] text-[var(--board-muted)]">Index</span>
          </div>
          <input
            data-board-control
            value={item.reference_title ?? item.content ?? ""}
            onChange={(event) =>
              onPatchItem(item.id, {
                reference_title: event.target.value,
                content: event.target.value,
              })
            }
            placeholder="Reference"
            className="mt-4 w-full bg-transparent font-serif-accent text-2xl leading-none text-[var(--board-card-text)] outline-none placeholder:text-[var(--board-muted)]"
          />
          <textarea
            data-board-control
            value={item.reference_note ?? ""}
            onChange={(event) =>
              onPatchItem(item.id, { reference_note: event.target.value })
            }
            placeholder="Optional note"
            className="no-card-scrollbar mt-3 flex-1 resize-none bg-transparent text-xs leading-5 text-[var(--board-muted)] outline-none placeholder:text-[var(--board-muted)]"
          />
        </div>
      ) : isColorSwatch ? (
        <div
          className="h-full w-full rounded-[4px] border"
          style={{
            backgroundColor: colorHex,
            borderColor: lightColor
              ? "rgb(30 25 20 / 0.22)"
              : "rgb(255 255 255 / 0.16)",
            boxShadow: lightColor
              ? "inset 0 0 0 1px rgb(255 255 255 / 0.22)"
              : "inset 0 0 0 1px rgb(255 255 255 / 0.08)",
          }}
          aria-label={`Color swatch ${colorHex}`}
        />
      ) : item.source_type === "text" ? (
        <div className="relative h-full w-full">
          <button
            type="button"
            className="board-drag-handle absolute left-2 top-2 z-20 h-7 w-12 cursor-grab border border-[var(--board-card-border)] bg-[var(--board-card-bg)] text-[10px] uppercase tracking-[0.18em] text-[var(--board-muted)] opacity-0 transition group-hover:opacity-100 focus:opacity-100"
            aria-label="Drag text block"
          >
            Move
          </button>
          <textarea
            data-board-control
            value={item.content ?? ""}
            onChange={(event) =>
              onPatchItem(item.id, { content: event.target.value })
            }
            className={`no-card-scrollbar h-full w-full resize-none overflow-hidden bg-transparent font-serif-accent leading-tight outline-none ${
              item.text_box_enabled ? "p-10 pt-11" : "p-0 pt-10"
            }`}
            style={{
              fontSize: item.text_size ?? 32,
              color: item.text_color ?? "var(--board-card-text)",
            }}
          />
          <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
            <button
              data-board-control
              type="button"
              onClick={() =>
                onPatchItem(item.id, {
                  text_box_enabled: !(item.text_box_enabled ?? true),
                })
              }
              className="border border-[var(--board-card-border)] bg-[var(--board-card-bg)] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--board-muted)]"
            >
              Box
            </button>
            <input
              data-board-control
              type="number"
              min={14}
              max={72}
              value={item.text_size ?? 32}
              onChange={(event) =>
                onPatchItem(item.id, { text_size: Number(event.target.value) })
              }
              className="h-7 w-12 border border-[var(--board-card-border)] bg-[var(--board-card-bg)] px-1 text-xs text-[var(--board-card-text)]"
              aria-label="Text size"
            />
            <input
              data-board-control
              type="color"
              value={
                item.text_color?.startsWith("#") ? item.text_color : "#e8e1d6"
              }
              onChange={(event) =>
                onPatchItem(item.id, { text_color: event.target.value })
              }
              className="h-7 w-8 border border-[var(--board-card-border)] bg-[var(--board-card-bg)]"
              aria-label="Text color"
            />
          </div>
        </div>
      ) : item.source && "display_url" in item.source ? (
        <div className="image-skeleton relative h-full w-full">
          <Image
            src={item.source.display_url}
            alt={item.source.title}
            fill
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            unoptimized={item.source.display_url.startsWith("data:")}
            sizes="320px"
            className="select-none object-cover"
          />
        </div>
      ) : item.source && "source_url" in item.source ? (
        <div className="flex h-full flex-col overflow-hidden p-4">
          <div className="border-b border-[var(--board-card-border)] pb-3">
            <div className="flex items-start justify-between gap-3">
              <p className="max-w-[68%] text-sm font-medium uppercase leading-tight tracking-[0.18em] text-[var(--board-card-text)]">
                {item.source.categories?.[0] ?? "Resource"}
              </p>
              <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--board-muted)]">
                Source
              </span>
            </div>
            <a
              data-board-control
              href={item.source.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex max-w-full items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[var(--board-muted)] transition hover:text-[var(--board-card-text)]"
            >
              <span className="truncate">{hostLabel(item.source.source_url)}</span>
              <ExternalLink size={10} />
            </a>
          </div>
          <div className="pt-3">
            <h3 className="line-clamp-2 text-sm font-medium">
              {sourceTitle(item.source)}
            </h3>
            <p className="mt-3 line-clamp-3 text-xs leading-5 text-[var(--board-muted)]">
              {sourceText(item.source)}
            </p>
            {item.source.used_for || item.source.saved_reason ? (
              <p className="mt-3 line-clamp-2 border-t border-[var(--board-card-border)] pt-3 text-[11px] leading-5 text-[var(--board-muted)]">
                {item.source.used_for || item.source.saved_reason}
              </p>
            ) : null}
          </div>
        </div>
      ) : item.source ? (
        <div className={`h-full overflow-hidden ${isLibraryReference ? "p-5" : "p-5"}`}>
          <div
            className={`flex items-center justify-between ${
              isLibraryReference ? "border-b border-[var(--board-card-border)] pb-2" : ""
            }`}
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--board-muted)]">
              {isLibraryReference ? "reference" : "idea"}
            </p>
            {isLibraryReference ? (
              <span className="text-[10px] text-[var(--board-muted)]">Archive</span>
            ) : null}
          </div>
          <h3
            className={`line-clamp-2 font-serif-accent ${
              isLibraryReference
                ? "mt-4 text-3xl leading-none"
                : "mt-4 text-2xl leading-tight"
            }`}
          >
            {sourceTitle(item.source)}
          </h3>
          <p
            className={`mt-4 line-clamp-4 whitespace-pre-wrap leading-6 text-[var(--board-muted)] ${
              isLibraryReference
                ? "text-sm"
                : "font-serif-accent text-lg"
            }`}
          >
            {sourceText(item.source)}
          </p>
        </div>
      ) : null}

    </Rnd>
  );
}

function BoardSection({
  board,
  items,
  isLast,
  onAddText,
  onAddReference,
  onAddSeparator,
  onAddColor,
  onAddBoard,
  onDeleteBoard,
  onPatchItem,
  snapMode,
  onSnapModeChange,
  onMoveStop,
  zoom,
  onZoomChange,
}: BoardSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const transformRef = useRef<ReactZoomPanPinchContentRef | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const resizeAutoScrollFrame = useRef<number | null>(null);
  const resizePointerY = useRef<number | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState(false);
  const [boardWindowHeight, setBoardWindowHeight] = useState(() =>
    readBoardWindowHeight(board.id),
  );
  const gridStyle = fixedGridStyle();

  useEffect(() => {
    return () => {
      if (resizeAutoScrollFrame.current !== null) {
        window.cancelAnimationFrame(resizeAutoScrollFrame.current);
      }
    };
  }, []);

  function syncGridPosition(positionX: number, positionY: number) {
    const minorX = `${positionX % 48}px`;
    const minorY = `${positionY % 48}px`;
    const majorX = `${positionX % 192}px`;
    const majorY = `${positionY % 192}px`;

    if (!gridRef.current) return;
    gridRef.current.style.backgroundPosition = `${minorX} ${minorY}, ${minorX} ${minorY}, ${majorX} ${majorY}, ${majorX} ${majorY}`;
  }

  function beginBoardResize(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = boardWindowHeight;
    const startScrollY = window.scrollY;
    resizePointerY.current = event.clientY;

    function updateHeight(clientY: number) {
      const nextHeight = clampBoardWindowHeight(
        startHeight + clientY - startY + window.scrollY - startScrollY,
      );
      setBoardWindowHeight(nextHeight);
      saveBoardWindowHeight(board.id, nextHeight);
    }

    function tickAutoScroll() {
      const pointerY = resizePointerY.current;

      if (pointerY !== null) {
        if (pointerY > window.innerHeight - resizeAutoScrollEdge) {
          window.scrollBy({ top: resizeAutoScrollStep, behavior: "auto" });
          updateHeight(pointerY);
        } else if (pointerY < resizeAutoScrollEdge) {
          window.scrollBy({ top: -resizeAutoScrollStep, behavior: "auto" });
          updateHeight(pointerY);
        }
      }

      resizeAutoScrollFrame.current =
        window.requestAnimationFrame(tickAutoScroll);
    }

    function stopAutoScroll() {
      if (resizeAutoScrollFrame.current !== null) {
        window.cancelAnimationFrame(resizeAutoScrollFrame.current);
        resizeAutoScrollFrame.current = null;
      }
      resizePointerY.current = null;
    }

    function handleMove(moveEvent: MouseEvent) {
      resizePointerY.current = moveEvent.clientY;
      updateHeight(moveEvent.clientY);
    }

    function handleUp() {
      stopAutoScroll();
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    }

    resizeAutoScrollFrame.current = window.requestAnimationFrame(tickAutoScroll);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp, { once: true });
  }

  function setBoardZoom(nextZoom: number) {
    const ref = transformRef.current;
    if (!ref) {
      onZoomChange(nextZoom);
      return;
    }

    ref.setTransform(
      ref.state.positionX,
      ref.state.positionY,
      nextZoom,
      160,
      "easeOut",
    );
    onZoomChange(nextZoom);
  }

  function fitBoard() {
    sectionRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    transformRef.current?.setTransform(0, 0, fitBoardZoom, 180, "easeOut");
    onZoomChange(fitBoardZoom);
  }

  function resetZoom() {
    transformRef.current?.setTransform(0, 0, 1, 180, "easeOut");
    onZoomChange(1);
  }

  useEffect(() => {
    const ref = transformRef.current;
    if (!ref || Math.abs(ref.state.scale - zoom) < 0.001) return;

    ref.setTransform(
      ref.state.positionX,
      ref.state.positionY,
      zoom,
      0,
      "easeOut",
    );
  }, [zoom]);

  return (
    <section
      ref={sectionRef}
      className={`relative mx-4 sm:mx-6 lg:mx-8 ${
        isLast ? "mb-16" : "mb-3"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-4 px-1">
        <p className="archive-label">
          {board.title}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <div className="relative mr-1 flex items-center border border-[color-mix(in_srgb,var(--line)_82%,transparent)]">
            <button
              type="button"
              onClick={() => setIsZoomMenuOpen((value) => !value)}
              className="inline-flex h-8 min-w-16 items-center justify-between gap-2 px-2.5 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
              aria-expanded={isZoomMenuOpen}
              aria-label="Moodboard zoom options"
            >
              {zoomLabel(zoom)}
              <ChevronDown size={12} />
            </button>
            {isZoomMenuOpen ? (
              <div
                data-board-control
                className="absolute right-0 top-9 z-40 min-w-32 border border-[var(--line-strong)] bg-[var(--background)] p-1 shadow-[var(--shadow-soft)]"
              >
                {zoomLevels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      setBoardZoom(level);
                      setIsZoomMenuOpen(false);
                    }}
                    className={`block h-8 w-full px-2.5 text-left text-xs transition ${
                      Math.abs(zoom - level) < 0.01
                        ? "bg-[var(--surface-soft)] text-[var(--foreground)]"
                        : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {zoomLabel(level)}
                  </button>
                ))}
                <div className="mt-1 border-t border-[var(--line)] pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      fitBoard();
                      setIsZoomMenuOpen(false);
                    }}
                    className="block h-8 w-full px-2.5 text-left text-xs text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                  >
                    Fit board
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetZoom();
                      setIsZoomMenuOpen(false);
                    }}
                    className="block h-8 w-full px-2.5 text-left text-xs text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                  >
                    Reset 100%
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="mr-1 flex border border-[color-mix(in_srgb,var(--line)_82%,transparent)]">
            {(["free", "soft"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onSnapModeChange(mode)}
                className={`h-8 px-2.5 text-xs capitalize transition ${
                  snapMode === mode
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {mode === "free" ? "Free" : "Soft Snap"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onAddText(board.id)}
            className="archive-button inline-flex h-8 items-center gap-2 px-2.5 text-xs"
          >
            <Type size={13} />
            Text
          </button>
          <button
            type="button"
            onClick={() => onAddReference(board.id)}
            className="archive-button inline-flex h-8 items-center gap-2 px-2.5 text-xs"
          >
            <Bookmark size={13} />
            Reference
          </button>
          <button
            type="button"
            onClick={() => onAddSeparator(board.id)}
            className="archive-button inline-flex h-8 items-center gap-2 px-2.5 text-xs"
          >
            <Minus size={13} />
            Separator
          </button>
          <button
            type="button"
            onClick={() => onAddColor(board.id)}
            className="archive-button inline-flex h-8 items-center gap-2 px-2.5 text-xs"
          >
            <Palette size={13} />
            Color
          </button>
          <button
            type="button"
            onClick={onAddBoard}
            className="archive-button inline-flex h-8 items-center gap-2 px-2.5 text-xs"
          >
            <Plus size={13} />
            Board
          </button>
          <button
            type="button"
            onClick={() => onDeleteBoard(board.id)}
            className="archive-button inline-flex h-8 items-center gap-2 px-2.5 text-xs"
          >
            <Trash2 size={13} />
            Remove
          </button>
        </div>
      </div>

      <div
        className="relative overflow-hidden bg-[var(--board-bg)]"
        style={{
          height: boardWindowHeight,
          boxShadow:
            "inset 0 0 0 1px color-mix(in srgb, var(--board-line-strong) 22%, transparent)",
        }}
      >
        <div
          ref={gridRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={gridStyle}
        />
        <TransformWrapper
          ref={transformRef}
          initialScale={zoom}
          initialPositionX={0}
          initialPositionY={0}
          minScale={0.5}
          maxScale={2}
          limitToBounds
          disablePadding
          smooth
          wheel={{
            activationKeys: ["Control", "Meta"],
            step: 0.18,
            excluded: zoomExclusions,
          }}
          panning={{
            allowLeftClickPan: true,
            allowMiddleClickPan: true,
            excluded: zoomExclusions,
          }}
          pinch={{
            allowPanning: true,
            excluded: zoomExclusions,
          }}
          doubleClick={{ disabled: true }}
          velocityAnimation={{ disabled: true }}
          onPanningStart={() => setIsPanning(true)}
          onPanningStop={() => setIsPanning(false)}
          onTransform={(_, state) => {
            syncGridPosition(state.positionX, state.positionY);
            const nextZoom = Number(state.scale.toFixed(3));
            if (Math.abs(nextZoom - zoom) > 0.001) {
              onZoomChange(nextZoom);
            }
          }}
        >
          <TransformComponent
            wrapperClass={`board-transform-wrapper ${
              isPanning ? "board-transform-wrapper-panning" : ""
            }`}
            contentClass="board-transform-content"
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{
              width: workspaceWidth,
              height: workspaceHeight,
              position: "relative",
              backgroundColor: "transparent",
              boxShadow:
                "inset 0 0 0 1px color-mix(in srgb, var(--board-line-strong) 28%, transparent)",
            }}
          >
            <div
              data-board-surface
              data-board-id={board.id}
              className="absolute inset-0"
            >
              {items.map((item) => (
                <BoardCard
                  key={item.id}
                  item={item}
                  onPatchItem={onPatchItem}
                  onMoveStop={onMoveStop}
                  snapMode={snapMode}
                  zoom={zoom}
                  onContextMenu={(event, menuItem) => {
                    event.preventDefault();
                    event.stopPropagation();
                    window.dispatchEvent(
                      new CustomEvent<ContextMenuState>("accumulate:board-menu", {
                        detail: { item: menuItem, x: event.clientX, y: event.clientY },
                      }),
                    );
                  }}
                />
              ))}
            </div>
          </TransformComponent>
        </TransformWrapper>
        {!items.length ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
                Empty surface
              </p>
              <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--muted)]">
                Add media, resources, ideas, or text blocks to this pinboard.
              </p>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onMouseDown={beginBoardResize}
          className="absolute bottom-2 left-1/2 z-20 flex h-6 w-28 -translate-x-1/2 cursor-ns-resize items-center justify-center border border-[var(--board-border)] bg-[var(--board-card-bg)] text-[10px] uppercase tracking-[0.18em] text-[var(--board-muted)] opacity-80 transition hover:text-[var(--board-card-text)] hover:opacity-100"
          aria-label="Resize moodboard view window"
        >
          Window
        </button>
      </div>
    </section>
  );
}

export function MoodboardHome() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [pinboards, setPinboards] = useState<PinboardItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("default-project");
  const [boardItems, setBoardItems] = useState<BoardItem[]>([]);
  const [mediaItems, setMediaItems] = useState<DisplayItem[]>([]);
  const [websiteItems, setWebsiteItems] = useState<WebsiteItem[]>([]);
  const [ideaItems, setIdeaItems] = useState<IdeaItem[]>([]);
  const [indicators, setIndicators] = useState<IndicatorItem[]>([]);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [infoItem, setInfoItem] = useState<ResolvedBoardItem | null>(null);
  const [editItem, setEditItem] = useState<ResolvedBoardItem | null>(null);
  const [separatorBoardId, setSeparatorBoardId] = useState<string | null>(null);
  const [colorBoardId, setColorBoardId] = useState<string | null>(null);
  const [colorDraft, setColorDraft] = useState("#E8E1D6");
  const [colorError, setColorError] = useState("");
  const [snapMode, setSnapMode] = useState<SnapMode>("free");
  const [moodboardZoom, setMoodboardZoom] = useState<number>(1);

  function load(projectId = readActiveProjectId()) {
    setProjects(readProjects());
    setActiveProjectId(projectId);
    setPinboards(readPinboards(projectId));
    setBoardItems(readBoardItems(projectId));
    setMediaItems(readMediaItems());
    setWebsiteItems(readWebsiteItems());
    setIdeaItems(readIdeaItems());
    setIndicators(readIndicators());
    setSnapMode(
      window.localStorage.getItem(snapModeKey) === "soft" ? "soft" : "free",
    );
  }

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    function handleIndicators() {
      load(activeProjectId);
    }

    function openSwitcher() {
      setIsSwitcherOpen(true);
    }

    window.addEventListener("accumulate:indicators", handleIndicators);
    window.addEventListener(archiveEvents.media, handleIndicators);
    window.addEventListener(archiveEvents.websites, handleIndicators);
    window.addEventListener(archiveEvents.ideas, handleIndicators);
    window.addEventListener(archiveEvents.boardItems, handleIndicators);
    window.addEventListener(commandActions.switchProject, openSwitcher);
    if (consumeQueuedCommandAction(commandActions.switchProject)) {
      openSwitcher();
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("accumulate:indicators", handleIndicators);
      window.removeEventListener(archiveEvents.media, handleIndicators);
      window.removeEventListener(archiveEvents.websites, handleIndicators);
      window.removeEventListener(archiveEvents.ideas, handleIndicators);
      window.removeEventListener(archiveEvents.boardItems, handleIndicators);
      window.removeEventListener(commandActions.switchProject, openSwitcher);
    };
  }, [activeProjectId]);

  useEffect(() => {
    if (!projects.length || pinboards.length) return;
    const timer = window.setTimeout(() => {
      setPinboards(readPinboards(activeProjectId));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeProjectId, pinboards.length, projects.length]);

  useEffect(() => {
    function openMenu(event: Event) {
      setContextMenu((event as CustomEvent<ContextMenuState>).detail);
    }

    function closeMenu() {
      setContextMenu(null);
    }

    window.addEventListener("accumulate:board-menu", openMenu);
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("accumulate:board-menu", openMenu);
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, []);

  const activeProject =
    projects.find((project) => project.id === activeProjectId) ?? projects[0];

  const resolvedItems = useMemo<ResolvedBoardItem[]>(() => {
    return boardItems.flatMap((item) => {
      const source =
        item.source_type === "media"
          ? mediaItems.find((sourceItem) => sourceItem.id === item.source_id)
          : item.source_type === "website"
            ? websiteItems.find((sourceItem) => sourceItem.id === item.source_id)
            : item.source_type === "idea"
              ? ideaItems.find((sourceItem) => sourceItem.id === item.source_id)
              : undefined;

      if (
        !source &&
        item.source_type !== "text" &&
        item.source_type !== "separator" &&
        item.source_type !== "reference"
      ) {
        return [];
      }

      return [
        {
          ...item,
          source,
          indicators: source ? selectedIndicatorsFor(indicators, source) : [],
        },
      ];
    });
  }, [boardItems, ideaItems, indicators, mediaItems, websiteItems]);

  const infoRelationships = useMemo(() => {
    if (
      !infoItem ||
      (infoItem.source_type !== "media" &&
        infoItem.source_type !== "website" &&
        infoItem.source_type !== "idea" &&
        infoItem.source_type !== "reference")
    ) {
      return null;
    }

    return getSourceRelationships(infoItem.source_type, infoItem.source_id);
  }, [infoItem]);

  function syncProject(projectId: string) {
    saveActiveProjectId(projectId);
    setIsSwitcherOpen(false);
    load(projectId);
  }

  function createProject() {
    const project: ProjectItem = {
      id: crypto.randomUUID(),
      user_id: LOCAL_USER_ID,
      title: `Project ${projects.length + 1}`,
      created_at: new Date().toISOString(),
    };
    const nextProjects = [...projects, project];
    setProjects(nextProjects);
    saveProjects(nextProjects);
    syncProject(project.id);
  }

  function duplicateProject(projectId: string) {
    const cloned = cloneProject(projectId);
    if (!cloned) return;
    syncProject(cloned.id);
  }

  function renameProject(event: FormEvent<HTMLFormElement>, projectId: string) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") || "").trim();
    if (!title) return;

    const nextProjects = projects.map((project) =>
      project.id === projectId ? { ...project, title } : project,
    );
    setProjects(nextProjects);
    saveProjects(nextProjects);
    setRenameId(null);
  }

  function patchBoardItem(itemId: string, patch: Partial<BoardItem>) {
    const updated = updateBoardItem(itemId, patch);
    if (!updated) return;

    setBoardItems((current) =>
      current.map((item) => (item.id === itemId ? updated : item)),
    );
  }

  function moveBoardItem(
    item: ResolvedBoardItem,
    node: HTMLElement,
    position: { x: number; y: number },
  ) {
    const itemRect = node.getBoundingClientRect();
    const centerX = itemRect.left + itemRect.width / 2;
    const centerY = itemRect.top + itemRect.height / 2;
    const surfaces = Array.from(
      document.querySelectorAll<HTMLElement>("[data-board-surface]"),
    );
    const targetSurface =
      surfaces.find((surface) => {
        const rect = surface.getBoundingClientRect();
        return (
          centerX >= rect.left &&
          centerX <= rect.right &&
          centerY >= rect.top &&
          centerY <= rect.bottom
        );
      }) ??
      surfaces.find((surface) => surface.dataset.boardId === item.board_id);

    if (!targetSurface) {
      patchBoardItem(item.id, {
        x: snapValue(Math.round(position.x), snapMode),
        y: snapValue(Math.round(position.y), snapMode),
      });
      return;
    }

    const targetRect = targetSurface.getBoundingClientRect();
    patchBoardItem(item.id, {
      board_id: targetSurface.dataset.boardId ?? item.board_id,
      x: snapValue(
        Math.round((itemRect.left - targetRect.left) / moodboardZoom),
        snapMode,
      ),
      y: snapValue(
        Math.round((itemRect.top - targetRect.top) / moodboardZoom),
        snapMode,
      ),
    });
  }

  function changeSnapMode(mode: SnapMode) {
    setSnapMode(mode);
    window.localStorage.setItem(snapModeKey, mode);
  }

  function cloneItem(itemId: string) {
    const item = cloneBoardItem(itemId);
    if (!item) return;
    setBoardItems(readBoardItems(activeProjectId));
    setContextMenu(null);
  }

  function removeBoardItem(itemId: string) {
    deleteBoardItem(itemId);
    setBoardItems(readBoardItems(activeProjectId));
    setContextMenu(null);
  }

  function goToSource(item: ResolvedBoardItem) {
    const route = sourceDetailRoute(item);
    if (!route) return;
    router.push(route);
  }

  function editSource(item: ResolvedBoardItem) {
    if (item.source_type === "media") {
      window.sessionStorage.setItem("accumulate.editMediaId", item.source_id);
      router.push(`/app/item/${item.source_id}`);
      return;
    }

    if (item.source_type === "website") {
      window.sessionStorage.setItem("accumulate.editResourceId", item.source_id);
      router.push("/app/tools");
      return;
    }

    if (item.source_type === "idea") {
      window.sessionStorage.setItem("accumulate.editIdeaId", item.source_id);
      router.push("/app/ideas");
      return;
    }

    setEditItem(item);
  }

  function addText(boardId: string) {
    addBoardElement(
      "text",
      "Untitled note",
      activeProjectId,
      boardId,
    );
    setBoardItems(readBoardItems(activeProjectId));
  }

  function addReference(boardId: string) {
    addBoardElement(
      "reference",
      "Untitled reference",
      activeProjectId,
      boardId,
    );
    setBoardItems(readBoardItems(activeProjectId));
  }

  function addSeparator(boardId: string) {
    setSeparatorBoardId(boardId);
  }

  function addColor(boardId: string) {
    setColorBoardId(boardId);
    setColorDraft("#E8E1D6");
    setColorError("");
  }

  function createColorSwatch() {
    if (!colorBoardId) return;

    const hex = normalizeHexColor(colorDraft);
    if (!hex) {
      setColorError("Use a valid HEX color, for example #E8E1D6.");
      return;
    }

    const item = addBoardElement("text", hex, activeProjectId, colorBoardId);
    updateBoardItem(item.id, {
      reference_title: "color-swatch",
      reference_note: "",
      text_box_enabled: false,
      text_color: hex,
      text_size: 12,
      width: 140,
      height: 120,
    });
    setColorBoardId(null);
    setColorError("");
    setBoardItems(readBoardItems(activeProjectId));
  }

  function copyColor(hex: string) {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return;

    void navigator.clipboard?.writeText(normalized);
  }

  function createSeparator(orientation: "horizontal" | "vertical") {
    if (!separatorBoardId) return;

    const item = addBoardElement(
      "separator",
      "",
      activeProjectId,
      separatorBoardId,
    );
    updateBoardItem(item.id, {
      separator_orientation: orientation,
      width: orientation === "vertical" ? 4 : 360,
      height: orientation === "vertical" ? 260 : 4,
    });
    setSeparatorBoardId(null);
    setBoardItems(readBoardItems(activeProjectId));
  }

  function addBoard() {
    const board = createPinboard(activeProjectId);
    setPinboards((current) => [...current, board]);
  }

  function removeBoard(boardId: string) {
    if (pinboards.length <= 1) return;

    const hasItems = boardItems.some((item) => item.board_id === boardId);
    if (
      hasItems &&
      !window.confirm("Remove this board and its moodboard adz?")
    ) {
      return;
    }

    const deleted = deletePinboard(boardId);
    if (!deleted) return;

    setPinboards(readPinboards(activeProjectId));
    setBoardItems(readBoardItems(activeProjectId));
  }

  return (
    <>
      <MinimalHeader />
      <motion.main
        variants={pageReveal}
        initial="hidden"
        animate="visible"
        className="flex min-h-[calc(100vh-72px)] flex-col pb-12"
      >
        <div className="mx-auto flex w-full max-w-7xl items-start justify-between gap-5 px-4 py-7 sm:px-6 lg:px-8">
          <div>
            <button
              type="button"
              onClick={() => setIsSwitcherOpen(true)}
              className="inline-flex items-center gap-2 text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              {activeProject?.title ?? "Current Project"}
              <ChevronDown size={15} />
            </button>
            <h1 className="font-serif-accent mt-3 text-6xl leading-none sm:text-8xl">
              {activeProject?.title ?? "Current Project"}
            </h1>
          </div>
        </div>

        {pinboards.map((board, index) => (
          <BoardSection
            key={board.id}
            board={board}
            isFirst={index === 0}
            isLast={index === pinboards.length - 1}
            items={resolvedItems.filter((item) => item.board_id === board.id)}
            onAddText={addText}
            onAddReference={addReference}
            onAddSeparator={addSeparator}
            onAddColor={addColor}
            onAddBoard={addBoard}
            onDeleteBoard={removeBoard}
            onPatchItem={patchBoardItem}
            snapMode={snapMode}
            onSnapModeChange={changeSnapMode}
            onMoveStop={moveBoardItem}
            zoom={moodboardZoom}
            onZoomChange={setMoodboardZoom}
          />
        ))}
      </motion.main>

      <button
        type="button"
        onClick={openQuickCapture}
        className="fixed bottom-5 left-5 z-40 grid size-12 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--surface-glass)] text-[var(--foreground)] shadow-[var(--shadow-soft)] backdrop-blur-xl transition hover:border-[var(--foreground)] sm:bottom-7 sm:left-7"
        aria-label="Quick capture"
        title="Quick capture"
      >
        <Plus size={18} />
      </button>

      <div className="fixed bottom-5 right-5 z-40 max-w-[300px]">
        <button
          type="button"
          onClick={() => setIsPaletteOpen((value) => !value)}
          className="flex items-center gap-3 border border-[var(--line-strong)] bg-[var(--surface-glass)] px-5 py-3.5 text-xs text-[var(--foreground)] shadow-[var(--shadow-soft)] backdrop-blur-xl transition hover:border-[var(--foreground)]"
        >
          <span className="flex -space-x-1">
            {indicators.slice(0, 4).map((indicator) => (
              <span
                key={indicator.id}
                className="size-3.5 border border-[var(--background)]"
                style={{ backgroundColor: indicator.color }}
              />
            ))}
          </span>
          <span className="uppercase tracking-[0.18em]">Indicator Legend</span>
        </button>
        {isPaletteOpen ? (
          <div className="mt-2 border border-[var(--line)] bg-[var(--background)] p-4 shadow-[var(--shadow-soft)]">
            {indicators.length ? (
              <div className="space-y-3">
                {indicators.map((indicator) => (
                  <div key={indicator.id} className="flex items-center gap-3 text-sm">
                    <span
                      className="size-4 border border-[var(--line)]"
                      style={{ backgroundColor: indicator.color }}
                    />
                    {indicator.name}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">No indicators yet.</p>
            )}
          </div>
        ) : null}
      </div>

      {contextMenu ? (
        <div
          className="fixed z-[70] min-w-44 border border-[var(--line)] bg-[var(--background)] p-1 shadow-[var(--shadow-soft)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {isColorSwatchItem(contextMenu.item) ? (
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                HEX
              </span>
              <span className="font-mono text-xs uppercase text-[var(--foreground)]">
                {normalizeHexColor(contextMenu.item.content ?? "") ?? "#E8E1D6"}
              </span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setInfoItem(contextMenu.item);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
          >
            <Info size={13} />
            Info
          </button>
          {isColorSwatchItem(contextMenu.item) ? (
            <button
              type="button"
              onClick={() => {
                copyColor(contextMenu.item.content ?? "");
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
            >
              <Copy size={13} />
              Copy HEX
            </button>
          ) : null}
          {sourceRoute(contextMenu.item.source_type) ? (
            <button
              type="button"
              onClick={() => goToSource(contextMenu.item)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
            >
              <ExternalLink size={13} />
              View in library
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              editSource(contextMenu.item);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
          >
            <Pencil size={13} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => cloneItem(contextMenu.item.id)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
          >
            <Copy size={13} />
            Clone
          </button>
          <button
            type="button"
            onClick={() => removeBoardItem(contextMenu.item.id)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
          >
            <Trash2 size={13} />
            Delete from board
          </button>
        </div>
      ) : null}

      <AnimatePresence>
        {infoItem ? (
          <motion.div
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-[75] flex items-center justify-center overflow-y-auto bg-[rgb(18_14_10_/_0.18)] px-4 py-8 backdrop-blur-md"
          >
            <motion.div
              variants={modalPanel}
              className="archive-panel max-h-[calc(100vh-4rem)] w-full max-w-2xl overflow-y-auto bg-[var(--background)] p-5"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="archive-label">
                    {sourceLabel(infoItem)}
                  </p>
                  <h2 className="font-serif-accent mt-2 text-4xl leading-none">
                    {infoItem.source
                      ? sourceTitle(infoItem.source)
                      : infoItem.content || "Board element"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoItem(null)}
                  className="archive-icon-button size-9 border-[var(--line)]"
                  aria-label="Close info"
                >
                  <X size={16} />
                </button>
              </div>

              {infoItem.source ? (
                <div className="mt-6 space-y-4 text-sm leading-6 text-[var(--muted)]">
                  {"display_url" in infoItem.source ? (
                    <div className="image-skeleton relative aspect-[4/3] overflow-hidden bg-[var(--surface-soft)]">
                      <Image
                        src={infoItem.source.display_url}
                        alt={infoItem.source.title}
                        fill
                        unoptimized={infoItem.source.display_url.startsWith("data:")}
                        sizes="520px"
                        className="object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {"description" in infoItem.source &&
                    infoItem.source.description ? (
                      <div className="archive-panel p-3">
                        <p className="archive-label text-[10px]">What It Is</p>
                        <p className="mt-2">{infoItem.source.description}</p>
                      </div>
                    ) : null}
                    {"used_for" in infoItem.source && infoItem.source.used_for ? (
                      <div className="archive-panel p-3">
                        <p className="archive-label text-[10px]">Used For</p>
                        <p className="mt-2">{infoItem.source.used_for}</p>
                      </div>
                    ) : null}
                    {"saved_reason" in infoItem.source &&
                    infoItem.source.saved_reason ? (
                      <div className="archive-panel p-3">
                        <p className="archive-label text-[10px]">Saved Because</p>
                        <p className="mt-2">{infoItem.source.saved_reason}</p>
                      </div>
                    ) : null}
                    {"body" in infoItem.source ? (
                      <div className="archive-panel p-3 sm:col-span-2">
                        <p className="archive-label text-[10px]">
                          {(infoItem.source.entry_type ?? "idea") === "reference"
                            ? "Reference Context"
                            : "Idea Text"}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap">
                          {infoItem.source.body || "No content added."}
                        </p>
                      </div>
                    ) : null}
                    {"display_url" in infoItem.source && infoItem.source.notes ? (
                      <div className="archive-panel p-3 sm:col-span-2">
                        <p className="archive-label text-[10px]">Notes</p>
                        <p className="mt-2 whitespace-pre-wrap">
                          {infoItem.source.notes}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="archive-panel grid gap-2 p-3 sm:grid-cols-2">
                    {"domain" in infoItem.source && infoItem.source.domain ? (
                      <p>
                        <span className="archive-label mr-2 text-[10px]">Domain</span>
                        {infoItem.source.domain}
                      </p>
                    ) : null}
                    {"category" in infoItem.source ? (
                      <p>
                        <span className="archive-label mr-2 text-[10px]">Category</span>
                        {infoItem.source.category}
                      </p>
                    ) : null}
                    {"categories" in infoItem.source &&
                    infoItem.source.categories?.length ? (
                      <p className="sm:col-span-2">
                        <span className="archive-label mr-2 text-[10px]">Categories</span>
                        {infoItem.source.categories.join(", ")}
                      </p>
                    ) : null}
                    {"tags" in infoItem.source && infoItem.source.tags.length ? (
                      <p className="sm:col-span-2">
                        <span className="archive-label mr-2 text-[10px]">Tags</span>
                        {infoItem.source.tags.join(", ")}
                      </p>
                    ) : null}
                    {infoItem.indicators.length ? (
                      <p className="sm:col-span-2">
                        <span className="archive-label mr-2 text-[10px]">Indicators</span>
                        {infoItem.indicators
                          .map((indicator) => indicator.name)
                          .join(", ")}
                      </p>
                    ) : null}
                    <p>
                      <span className="archive-label mr-2 text-[10px]">Added</span>
                      {new Date(infoItem.source.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {infoRelationships ? (
                    <RelationshipMemory relationships={infoRelationships} />
                  ) : null}
                  {"source_url" in infoItem.source &&
                  infoItem.source.source_url ? (
                    <a
                      href={infoItem.source.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-[var(--foreground)]"
                    >
                      {hostLabel(infoItem.source.source_url)}
                      <ExternalLink size={13} />
                    </a>
                  ) : null}
                </div>
              ) : null}

              {!infoItem.source ? (
                <div className="mt-6 space-y-3 text-sm leading-6 text-[var(--muted)]">
                  {isColorSwatchItem(infoItem) ? (
                    <div className="space-y-4">
                      <div
                        className="h-36 border"
                        style={{
                          backgroundColor:
                            normalizeHexColor(infoItem.content ?? "") ?? "#E8E1D6",
                          borderColor: isLightColor(infoItem.content ?? "")
                            ? "rgb(30 25 20 / 0.22)"
                            : "rgb(255 255 255 / 0.16)",
                        }}
                      />
                      <div className="archive-panel grid gap-3 p-3 sm:grid-cols-2">
                        <p>
                          <span className="archive-label mr-2 text-[10px]">HEX</span>
                          {normalizeHexColor(infoItem.content ?? "") ?? "#E8E1D6"}
                        </p>
                        <p>
                          <span className="archive-label mr-2 text-[10px]">RGB</span>
                          {rgbLabel(infoItem.content ?? "")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyColor(infoItem.content ?? "")}
                        className="archive-button inline-flex h-9 items-center gap-2 px-3 text-xs"
                      >
                        <Copy size={13} />
                        Copy HEX
                      </button>
                      <p className="archive-meta">
                        Color analysis coming later.
                      </p>
                    </div>
                  ) : null}
                  {infoItem.source_type === "reference" ? (
                    <>
                      <p>Title: {infoItem.reference_title ?? infoItem.content}</p>
                      {infoItem.reference_note ? (
                        <p>Note: {infoItem.reference_note}</p>
                      ) : null}
                    </>
                  ) : null}
                  {infoItem.source_type === "text" && !isColorSwatchItem(infoItem) ? (
                    <p className="whitespace-pre-wrap">{infoItem.content}</p>
                  ) : null}
                  {infoItem.source_type === "separator" ? (
                    <>
                      <p>
                        Orientation:{" "}
                        {infoItem.separator_orientation ?? "horizontal"}
                      </p>
                      <p>Thickness: {infoItem.separator_thickness ?? 4}</p>
                    </>
                  ) : null}
                  <p>
                    Date added: {new Date(infoItem.created_at).toLocaleDateString()}
                  </p>
                  {infoRelationships ? (
                    <RelationshipMemory relationships={infoRelationships} />
                  ) : null}
                </div>
              ) : null}

            </motion.div>
          </motion.div>
        ) : null}

        {editItem ? (
          <motion.div
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-[75] flex items-center justify-center overflow-y-auto bg-[rgb(18_14_10_/_0.18)] px-4 py-8 backdrop-blur-md"
          >
            <motion.div
              variants={modalPanel}
              role="dialog"
              aria-modal="true"
                  className="archive-panel max-h-[calc(100vh-4rem)] w-full max-w-lg overflow-y-auto bg-[var(--background)] p-5"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="archive-label">
                    Edit {editItem.source_type}
                  </p>
                  <h2 className="font-serif-accent mt-2 text-4xl leading-none">
                    Board object.
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  className="archive-icon-button size-9 border-[var(--line)]"
                  aria-label="Close editor"
                >
                  <X size={16} />
                </button>
              </div>

              {isColorSwatchItem(editItem) ? (
                <div className="mt-6 space-y-3">
                  <div
                    className="h-28 border"
                    style={{
                      backgroundColor:
                        normalizeHexColor(editItem.content ?? "") ?? "#E8E1D6",
                      borderColor: isLightColor(editItem.content ?? "")
                        ? "rgb(30 25 20 / 0.22)"
                        : "rgb(255 255 255 / 0.16)",
                    }}
                  />
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input
                      value={editItem.content ?? ""}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        const normalized = normalizeHexColor(nextValue);
                        const patch: Partial<BoardItem> = {
                          content: nextValue,
                          text_color: normalized ?? editItem.text_color,
                        };
                        patchBoardItem(editItem.id, patch);
                        setEditItem({ ...editItem, ...patch });
                      }}
                      placeholder="#E8E1D6"
                      className="premium-focus h-10 border border-[var(--line)] bg-transparent px-3 font-mono text-sm uppercase"
                      aria-label="Color HEX"
                    />
                    <input
                      type="color"
                      value={
                        normalizeHexColor(editItem.content ?? "") ?? "#E8E1D6"
                      }
                      onChange={(event) => {
                        const hex = normalizeHexColor(event.target.value) ?? "#E8E1D6";
                        const patch: Partial<BoardItem> = {
                          content: hex,
                          text_color: hex,
                        };
                        patchBoardItem(editItem.id, patch);
                        setEditItem({ ...editItem, ...patch });
                      }}
                      className="h-10 w-14 border border-[var(--line)] bg-transparent"
                      aria-label="Pick color"
                    />
                  </div>
                </div>
              ) : null}

              {editItem.source_type === "text" && !isColorSwatchItem(editItem) ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => {
                      const patch = {
                        text_box_enabled: !(editItem.text_box_enabled ?? true),
                      };
                      patchBoardItem(editItem.id, patch);
                      setEditItem({ ...editItem, ...patch });
                    }}
                    className="h-10 border border-[var(--line)] text-sm text-[var(--muted)]"
                  >
                    Box {editItem.text_box_enabled ?? true ? "on" : "off"}
                  </button>
                  <input
                    type="number"
                    min={14}
                    max={72}
                    value={editItem.text_size ?? 32}
                    onChange={(event) => {
                      const patch = { text_size: Number(event.target.value) };
                      patchBoardItem(editItem.id, patch);
                      setEditItem({ ...editItem, ...patch });
                    }}
                    className="premium-focus h-10 border border-[var(--line)] bg-transparent px-3 text-sm"
                    aria-label="Text size"
                  />
                  <input
                    type="color"
                    value={
                      editItem.text_color?.startsWith("#")
                        ? editItem.text_color
                        : "#e8e1d6"
                    }
                    onChange={(event) => {
                      const patch = { text_color: event.target.value };
                      patchBoardItem(editItem.id, patch);
                      setEditItem({ ...editItem, ...patch });
                    }}
                    className="h-10 border border-[var(--line)] bg-transparent"
                    aria-label="Text color"
                  />
                </div>
              ) : null}

              {editItem.source_type === "reference" ? (
                <div className="mt-6 space-y-3">
                  <input
                    value={editItem.reference_title ?? editItem.content ?? ""}
                    onChange={(event) => {
                      const patch = {
                        reference_title: event.target.value,
                        content: event.target.value,
                      };
                      patchBoardItem(editItem.id, patch);
                      setEditItem({ ...editItem, ...patch });
                    }}
                    placeholder="Reference"
                    className="premium-focus h-10 w-full border border-[var(--line)] bg-transparent px-3 text-sm"
                  />
                  <textarea
                    value={editItem.reference_note ?? ""}
                    onChange={(event) => {
                      const patch = { reference_note: event.target.value };
                      patchBoardItem(editItem.id, patch);
                      setEditItem({ ...editItem, ...patch });
                    }}
                    rows={4}
                    placeholder="Optional note"
                    className="premium-focus w-full resize-none border border-[var(--line)] bg-transparent px-3 py-3 text-sm leading-6"
                  />
                </div>
              ) : null}

              {editItem.source_type === "separator" ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <select
                    value={editItem.separator_orientation ?? "horizontal"}
                    onChange={(event) => {
                      const isVertical = event.target.value === "vertical";
                      const patch: Partial<BoardItem> = {
                        separator_orientation: isVertical
                          ? "vertical"
                          : "horizontal",
                        width: isVertical
                          ? editItem.separator_thickness ?? 4
                          : Math.max(editItem.width, 160),
                        height: isVertical
                          ? Math.max(editItem.height ?? 260, 160)
                          : editItem.separator_thickness ?? 4,
                      };
                      patchBoardItem(editItem.id, patch);
                      setEditItem({ ...editItem, ...patch });
                    }}
                    className="premium-focus h-10 border border-[var(--line)] bg-transparent px-3 text-sm"
                  >
                    <option value="horizontal">Horizontal</option>
                    <option value="vertical">Vertical</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={editItem.separator_thickness ?? 4}
                    onChange={(event) => {
                      const thickness = Number(event.target.value);
                      const isVertical =
                        editItem.separator_orientation === "vertical";
                      const patch: Partial<BoardItem> = {
                        separator_thickness: thickness,
                        width: isVertical ? thickness : editItem.width,
                        height: isVertical ? editItem.height : thickness,
                      };
                      patchBoardItem(editItem.id, patch);
                      setEditItem({ ...editItem, ...patch });
                    }}
                    className="premium-focus h-10 border border-[var(--line)] bg-transparent px-3 text-sm"
                    aria-label="Separator thickness"
                  />
                  <input
                    type="color"
                    value={
                      editItem.separator_color?.startsWith("#")
                        ? editItem.separator_color
                        : "#4d4740"
                    }
                    onChange={(event) => {
                      const patch = { separator_color: event.target.value };
                      patchBoardItem(editItem.id, patch);
                      setEditItem({ ...editItem, ...patch });
                    }}
                    className="h-10 border border-[var(--line)] bg-transparent"
                    aria-label="Separator color"
                  />
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}

        {separatorBoardId ? (
          <motion.div
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-[76] bg-[rgb(18_14_10_/_0.18)] px-4 py-8 backdrop-blur-md"
          >
            <motion.div
              variants={modalPanel}
              role="dialog"
              aria-modal="true"
              className="mx-auto max-w-sm border border-[var(--line)] bg-[var(--background)] p-5"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                    Separator
                  </p>
                  <h2 className="font-serif-accent mt-2 text-4xl leading-none">
                    Direction.
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSeparatorBoardId(null)}
                  className="grid size-9 place-items-center border border-[var(--line)] text-[var(--muted)]"
                  aria-label="Close separator dialog"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-6 grid gap-2">
                <button
                  type="button"
                  onClick={() => createSeparator("horizontal")}
                  className="h-11 border border-[var(--line)] text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  Horizontal
                </button>
                <button
                  type="button"
                  onClick={() => createSeparator("vertical")}
                  className="h-11 border border-[var(--line)] text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  Vertical
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {colorBoardId ? (
          <motion.div
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-[76] bg-[rgb(18_14_10_/_0.18)] px-4 py-8 backdrop-blur-md"
          >
            <motion.div
              variants={modalPanel}
              role="dialog"
              aria-modal="true"
              className="mx-auto max-w-sm border border-[var(--line)] bg-[var(--background)] p-5"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                    Color
                  </p>
                  <h2 className="font-serif-accent mt-2 text-4xl leading-none">
                    Swatch.
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setColorBoardId(null)}
                  className="grid size-9 place-items-center border border-[var(--line)] text-[var(--muted)]"
                  aria-label="Close color dialog"
                >
                  <X size={16} />
                </button>
              </div>
              <div
                className="mt-6 h-28 border"
                style={{
                  backgroundColor: normalizeHexColor(colorDraft) ?? "#E8E1D6",
                  borderColor: isLightColor(colorDraft)
                    ? "rgb(30 25 20 / 0.22)"
                    : "rgb(255 255 255 / 0.16)",
                }}
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  value={colorDraft}
                  onChange={(event) => {
                    setColorDraft(event.target.value);
                    setColorError("");
                  }}
                  placeholder="#E8E1D6"
                  className="premium-focus h-10 border border-[var(--line)] bg-transparent px-3 font-mono text-sm uppercase"
                  aria-label="HEX color"
                />
                <input
                  type="color"
                  value={normalizeHexColor(colorDraft) ?? "#E8E1D6"}
                  onChange={(event) => {
                    setColorDraft(event.target.value.toUpperCase());
                    setColorError("");
                  }}
                  className="h-10 w-14 border border-[var(--line)] bg-transparent"
                  aria-label="Pick color"
                />
              </div>
              {colorError ? (
                <p className="mt-3 text-xs text-[var(--muted)]">{colorError}</p>
              ) : null}
              <button
                type="button"
                onClick={createColorSwatch}
                className="mt-5 h-10 bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)] transition hover:opacity-90"
              >
                Add color
              </button>
            </motion.div>
          </motion.div>
        ) : null}

        {isSwitcherOpen ? (
          <motion.div
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 bg-[rgb(18_14_10_/_0.18)] px-4 py-8 backdrop-blur-md"
          >
            <motion.div
              variants={modalPanel}
              className="mx-auto max-w-md border border-[var(--line)] bg-[var(--background)] p-5"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                    Projects
                  </p>
                  <h2 className="font-serif-accent mt-2 text-4xl leading-none">
                    Current Project.
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSwitcherOpen(false)}
                  className="grid size-9 place-items-center border border-[var(--line)] text-[var(--muted)]"
                  aria-label="Close projects"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-7 space-y-2">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center gap-2 border border-[var(--line)] p-2"
                  >
                    {renameId === project.id ? (
                      <form
                        onSubmit={(event) => renameProject(event, project.id)}
                        className="flex flex-1 gap-2"
                      >
                        <input
                          name="title"
                          defaultValue={project.title}
                          className="premium-focus h-9 flex-1 bg-transparent px-2 text-sm"
                        />
                        <button type="submit" className="px-2 text-xs">
                          Save
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => syncProject(project.id)}
                        className={`flex-1 px-2 py-2 text-left text-sm ${
                          project.id === activeProjectId
                            ? "text-[var(--foreground)]"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {project.title}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setRenameId(project.id)}
                      className="grid size-8 place-items-center text-[var(--muted)]"
                      aria-label={`Rename ${project.title}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateProject(project.id)}
                      className="grid size-8 place-items-center text-[var(--muted)] transition hover:text-[var(--foreground)]"
                      aria-label={`Clone ${project.title}`}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={createProject}
                className="mt-4 inline-flex h-10 items-center gap-2 border border-[var(--line)] px-3 text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                <Plus size={15} />
                New project
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
