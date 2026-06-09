"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, X } from "lucide-react";
import {
  LOCAL_USER_ID,
  readIndicators,
  saveIndicators,
} from "@/lib/localArchive";
import { modalOverlay, modalPanel } from "@/lib/motion";
import type { IndicatorItem } from "@/lib/types";

type IndicatorDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function IndicatorDialog({ isOpen, onClose }: IndicatorDialogProps) {
  const [indicators, setIndicators] = useState<IndicatorItem[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8f7b5f");

  useEffect(() => {
    if (!isOpen) return;

    const frame = window.requestAnimationFrame(() => {
      setIndicators(readIndicators());
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  function persist(nextIndicators: IndicatorItem[]) {
    setIndicators(nextIndicators);
    saveIndicators(nextIndicators);
    window.dispatchEvent(new Event("accumulate:indicators"));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = name.trim();
    if (!cleanName) return;

    persist([
      {
        id: crypto.randomUUID(),
        user_id: LOCAL_USER_ID,
        name: cleanName,
        color,
        created_at: new Date().toISOString(),
      },
      ...indicators,
    ]);
    setName("");
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          variants={modalOverlay}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 bg-[rgb(18_14_10_/_0.24)] px-4 py-6 backdrop-blur-md"
        >
          <motion.div
            variants={modalPanel}
            role="dialog"
            aria-modal="true"
            aria-label="Indicators"
            className="mx-auto max-w-lg border border-[var(--line)] bg-[var(--background)] p-5"
          >
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  Indicators
                </p>
                <h2 className="font-serif-accent mt-2 text-4xl leading-none">
                  Visual markers.
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid size-9 place-items-center border border-[var(--line)] text-[var(--muted)] transition hover:text-[var(--foreground)]"
                aria-label="Close indicators"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name"
                className="premium-focus h-11 border border-[var(--line)] bg-transparent px-3 text-sm"
              />
              <input
                value={color}
                onChange={(event) => setColor(event.target.value)}
                type="color"
                className="h-11 w-full border border-[var(--line)] bg-transparent p-1 sm:w-14"
                aria-label="Indicator color"
              />
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 bg-[var(--foreground)] px-4 text-sm text-[var(--background)]"
              >
                <Plus size={15} />
                Add
              </button>
            </form>

            <div className="mt-6 space-y-2">
              {indicators.map((indicator) => (
                <div
                  key={indicator.id}
                  className="flex items-center gap-3 border border-[var(--line)] px-3 py-2"
                >
                  <span
                    className="h-7 w-1.5"
                    style={{ backgroundColor: indicator.color }}
                  />
                  <input
                    value={indicator.name}
                    onChange={(event) =>
                      persist(
                        indicators.map((item) =>
                          item.id === indicator.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      )
                    }
                    className="premium-focus h-9 flex-1 bg-transparent text-sm"
                  />
                  <input
                    value={indicator.color}
                    onChange={(event) =>
                      persist(
                        indicators.map((item) =>
                          item.id === indicator.id
                            ? { ...item, color: event.target.value }
                            : item,
                        ),
                      )
                    }
                    type="color"
                    className="size-9 border border-[var(--line)] bg-transparent p-1"
                    aria-label={`Color for ${indicator.name}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      persist(
                        indicators.filter((item) => item.id !== indicator.id),
                      )
                    }
                    className="grid size-9 place-items-center text-[var(--muted)] transition hover:text-[var(--foreground)]"
                    aria-label={`Delete ${indicator.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
