"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileImage, Link2, Plus, TextCursorInput, X } from "lucide-react";
import { AddItemModal } from "@/components/AddItemModal";
import {
  getClipboardText,
  getImageFromClipboard,
  isProbablyUrl,
  normalizeUrl,
  titleFromUrl,
  urlDomain,
} from "@/lib/clipboard";
import {
  addSourceToProject,
  readActiveProjectId,
  updateBoardItem,
} from "@/lib/localArchive";
import {
  commandActions,
  dispatchCommandAction,
  queueCommandDraft,
} from "@/lib/commandActions";
import { modalOverlay, modalPanel } from "@/lib/motion";
import type { DisplayItem } from "@/lib/types";

type BoardDrop = { boardId: string; x: number; y: number };

const quickCaptureEvent = "accumulate:quick-capture";

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function isDialogOpen() {
  return Boolean(document.querySelector('[role="dialog"]'));
}

function imageFileFromDrop(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return null;

  return (
    Array.from(dataTransfer.files).find((file) =>
      file.type.startsWith("image/"),
    ) ?? null
  );
}

function boardDropFromEvent(event: DragEvent) {
  const target = event.target;
  const element = target instanceof HTMLElement ? target : null;
  const surface = element?.closest<HTMLElement>("[data-board-surface]");
  const boardId = surface?.dataset.boardId;

  if (!surface || !boardId) return null;

  const rect = surface.getBoundingClientRect();
  return {
    boardId,
    x: Math.max(32, Math.round(event.clientX - rect.left - 130)),
    y: Math.max(32, Math.round(event.clientY - rect.top - 160)),
  };
}

function titleFromText(value: string) {
  const firstLine = value.split(/\r?\n/).find(Boolean)?.trim() ?? "Untitled idea";
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

export function openQuickCapture() {
  window.dispatchEvent(new Event(quickCaptureEvent));
}

export function UniversalCapture() {
  const pathname = usePathname();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [boardDrop, setBoardDrop] = useState<BoardDrop | null>(null);

  function openMedia(file: File, drop?: BoardDrop | null) {
    setBoardDrop(drop ?? null);
    setMediaFile(file);
    setIsQuickOpen(false);
  }

  const openTool = useCallback((url: string) => {
    const sourceUrl = normalizeUrl(url);
    const draft = {
      source_url: sourceUrl,
      name: titleFromUrl(sourceUrl),
      description: "",
      domain: urlDomain(sourceUrl),
    };

    if (pathname === "/app/tools") {
      window.sessionStorage.setItem("accumulate.inlineToolDraft", JSON.stringify(draft));
      dispatchCommandAction(commandActions.addTool);
      return;
    }

    queueCommandDraft(commandActions.addTool, draft);
    router.push("/app/tools");
  }, [pathname, router]);

  const openIdea = useCallback((text: string) => {
    const draft = {
      entry_type: "idea",
      title: titleFromText(text),
      body: text,
    };

    if (pathname === "/app/ideas") {
      window.sessionStorage.setItem("accumulate.inlineIdeaDraft", JSON.stringify(draft));
      dispatchCommandAction(commandActions.addIdea);
      return;
    }

    queueCommandDraft(commandActions.addIdea, draft);
    router.push("/app/ideas");
  }, [pathname, router]);

  const handleTextCapture = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (isProbablyUrl(trimmed)) {
      openTool(trimmed);
    } else {
      openIdea(trimmed);
    }

    setQuickText("");
    setIsQuickOpen(false);
  }, [openIdea, openTool]);

  useEffect(() => {
    if (!pathname.startsWith("/app")) return;

    function handleQuickCapture() {
      setIsQuickOpen(true);
    }

    function handlePaste(event: ClipboardEvent) {
      if (isEditableTarget(event.target) || isDialogOpen()) return;

      const pastedImage = getImageFromClipboard(event.clipboardData);
      const pastedText = getClipboardText(event.clipboardData);

      if (pastedImage) {
        event.preventDefault();
        openMedia(pastedImage);
        return;
      }

      if (!pastedText) return;

      event.preventDefault();
      handleTextCapture(pastedText);
    }

    function handleDrop(event: DragEvent) {
      if (isEditableTarget(event.target) || isDialogOpen()) return;

      const file = imageFileFromDrop(event.dataTransfer);
      if (!file) return;

      event.preventDefault();
      openMedia(file, boardDropFromEvent(event));
    }

    function handleDragOver(event: DragEvent) {
      if (!imageFileFromDrop(event.dataTransfer) || isDialogOpen()) return;
      event.preventDefault();
    }

    window.addEventListener(quickCaptureEvent, handleQuickCapture);
    window.addEventListener("paste", handlePaste);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("dragover", handleDragOver);

    return () => {
      window.removeEventListener(quickCaptureEvent, handleQuickCapture);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragover", handleDragOver);
    };
  }, [handleTextCapture, pathname]);

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    openMedia(file);
    event.target.value = "";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleTextCapture(quickText);
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileInput}
      />

      <AddItemModal
        key={
          mediaFile
            ? `${mediaFile.name}-${mediaFile.lastModified}-${mediaFile.size}`
            : "universal-media"
        }
        isOpen={Boolean(mediaFile)}
        pastedFile={mediaFile}
        onClose={() => {
          setMediaFile(null);
          setBoardDrop(null);
        }}
        onCreated={(item: DisplayItem) => {
          if (boardDrop) {
            const boardItem = addSourceToProject(
              "media",
              item.id,
              readActiveProjectId(),
              boardDrop.boardId,
            );
            updateBoardItem(boardItem.id, {
              x: boardDrop.x,
              y: boardDrop.y,
            });
          }
          setMediaFile(null);
          setBoardDrop(null);
        }}
      />

      <AnimatePresence>
        {isQuickOpen ? (
          <motion.div
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-[90] bg-[rgb(18_14_10_/_0.18)] px-4 py-8 backdrop-blur-md"
            onMouseDown={() => setIsQuickOpen(false)}
          >
            <motion.form
              variants={modalPanel}
              role="dialog"
              aria-modal="true"
              aria-label="Quick capture"
              onSubmit={handleSubmit}
              onMouseDown={(event) => event.stopPropagation()}
              className="mx-auto max-w-xl border border-[var(--line)] bg-[var(--background)] p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                    Quick capture
                  </p>
                  <h2 className="font-serif-accent mt-3 text-4xl leading-none">
                    Paste anything.
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickOpen(false)}
                  className="grid size-9 place-items-center border border-[var(--line)] text-[var(--muted)]"
                  aria-label="Close quick capture"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-11 items-center justify-center gap-2 border border-[var(--line)] text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  <FileImage size={15} />
                  Image
                </button>
                <button
                  type="button"
                  onClick={() => handleTextCapture(quickText)}
                  className="flex h-11 items-center justify-center gap-2 border border-[var(--line)] text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  <Link2 size={15} />
                  URL
                </button>
                <button
                  type="button"
                  onClick={() => handleTextCapture(quickText)}
                  className="flex h-11 items-center justify-center gap-2 border border-[var(--line)] text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  <TextCursorInput size={15} />
                  Text
                </button>
              </div>

              <textarea
                value={quickText}
                onChange={(event) => setQuickText(event.target.value)}
                rows={6}
                placeholder="Paste a URL or text. Images can be pasted directly with Ctrl/Cmd V."
                className="premium-focus mt-4 w-full resize-none border border-[var(--line)] bg-transparent px-3 py-3 text-sm leading-6"
              />

              <button
                type="submit"
                className="mt-4 inline-flex h-11 items-center gap-2 bg-[var(--foreground)] px-5 text-sm font-medium text-[var(--background)] transition hover:opacity-90"
              >
                <Plus size={15} />
                Continue
              </button>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
