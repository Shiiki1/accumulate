"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, Plus } from "lucide-react";
import {
  addSourceToProject,
  archiveEvents,
  MAX_INDICATORS_PER_ITEM,
  normalizeIndicatorIds,
  readActiveProjectId,
  readBoardItems,
  readIndicators,
} from "@/lib/localArchive";
import type { BoardSourceType, IndicatorItem } from "@/lib/types";

type IndicatorMultiSelectProps = {
  value?: string[];
  legacyValue?: string | null;
  onChange: (indicatorIds: string[]) => void;
  compact?: boolean;
};

type AddToProjectButtonProps = {
  sourceType: Exclude<BoardSourceType, "text" | "separator" | "reference">;
  sourceId: string;
};

type IndicatorFilterProps = {
  selectedIds: string[];
  onChange: (indicatorIds: string[]) => void;
};

function indicatorButtonStyle(color: string, isSelected: boolean) {
  return {
    borderColor: `color-mix(in srgb, ${color} ${isSelected ? "70%" : "22%"}, var(--line))`,
    backgroundColor: `color-mix(in srgb, ${color} ${isSelected ? "28%" : "8%"}, var(--surface))`,
    color: "var(--foreground)",
  };
}

export function useIndicators() {
  const [indicators, setIndicators] = useState<IndicatorItem[]>([]);

  useEffect(() => {
    function sync() {
      setIndicators(readIndicators());
    }

    const frame = window.requestAnimationFrame(sync);
    window.addEventListener("accumulate:indicators", sync);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("accumulate:indicators", sync);
    };
  }, []);

  return indicators;
}

export function IndicatorMultiSelect({
  value,
  legacyValue,
  onChange,
  compact = false,
}: IndicatorMultiSelectProps) {
  const indicators = useIndicators();
  const selectedIds = useMemo(
    () => normalizeIndicatorIds({ indicator_ids: value, indicator_id: legacyValue }),
    [legacyValue, value],
  );

  if (!indicators.length) return null;

  function toggleIndicator(indicatorId: string) {
    const isSelected = selectedIds.includes(indicatorId);

    if (isSelected) {
      onChange(selectedIds.filter((id) => id !== indicatorId));
      return;
    }

    if (selectedIds.length >= MAX_INDICATORS_PER_ITEM) return;
    onChange([...selectedIds, indicatorId]);
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "max-w-full" : ""}`}>
      {indicators.map((indicator) => {
        const isSelected = selectedIds.includes(indicator.id);

        return (
          <button
            key={indicator.id}
            type="button"
            onClick={() => toggleIndicator(indicator.id)}
            className={`inline-flex h-7 items-center gap-1.5 border px-2 text-[11px] transition ${
              isSelected
                ? "border-[var(--foreground)] text-[var(--foreground)]"
                : "border-[var(--line)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
            title={indicator.name}
            aria-pressed={isSelected}
          >
            <span
              className="size-1.5"
              style={{ backgroundColor: indicator.color }}
            />
            {compact ? null : indicator.name}
          </button>
        );
      })}
    </div>
  );
}

export function IndicatorFilter({ selectedIds, onChange }: IndicatorFilterProps) {
  const indicators = useIndicators();

  if (!indicators.length) return null;

  function toggleIndicator(indicatorId: string) {
    onChange(
      selectedIds.includes(indicatorId)
        ? selectedIds.filter((id) => id !== indicatorId)
        : [...selectedIds, indicatorId],
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {indicators.map((indicator) => {
        const isSelected = selectedIds.includes(indicator.id);

        return (
          <button
            key={indicator.id}
            type="button"
            onClick={() => toggleIndicator(indicator.id)}
            className="inline-flex h-9 items-center gap-2 border px-3 text-xs transition hover:border-[var(--foreground)]"
            style={indicatorButtonStyle(indicator.color, isSelected)}
            aria-pressed={isSelected}
          >
            <span
              className="size-1.5"
              style={{ backgroundColor: indicator.color }}
            />
            {indicator.name}
          </button>
        );
      })}
    </div>
  );
}

export function IndicatorMarks({
  indicators,
}: {
  indicators: IndicatorItem[];
}) {
  if (!indicators.length) return null;

  return (
    <div className="absolute inset-y-0 left-0 z-10 flex w-1.5 flex-col overflow-hidden">
      {indicators.slice(0, MAX_INDICATORS_PER_ITEM).map((indicator) => (
        <span
          key={indicator.id}
          className="min-h-2 flex-1"
          style={{ backgroundColor: indicator.color }}
          title={indicator.name}
        />
      ))}
    </div>
  );
}

export function selectedIndicatorsFor(
  indicators: IndicatorItem[],
  item: { indicator_ids?: string[]; indicator_id?: string | null },
) {
  const ids = normalizeIndicatorIds(item);
  return ids
    .map((id) => indicators.find((indicator) => indicator.id === id))
    .filter((indicator): indicator is IndicatorItem => Boolean(indicator));
}

export function AddToProjectButton({
  sourceType,
  sourceId,
}: AddToProjectButtonProps) {
  const [label, setLabel] = useState("Add to Project");
  const [usageCount, setUsageCount] = useState(0);

  useEffect(() => {
    function syncUsage() {
      setUsageCount(
        readBoardItems(readActiveProjectId()).filter(
          (item) =>
            item.source_type === sourceType && item.source_id === sourceId,
        ).length,
      );
    }

    const frame = window.requestAnimationFrame(syncUsage);
    window.addEventListener(archiveEvents.boardItems, syncUsage);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(archiveEvents.boardItems, syncUsage);
    };
  }, [sourceId, sourceType]);

  function handleClick() {
    addSourceToProject(sourceType, sourceId);
    setUsageCount((current) => Math.max(current, 1));
    setLabel("Added");
    window.setTimeout(() => setLabel("Add to Project"), 1200);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex h-8 items-center gap-2 border border-[var(--line)] px-2.5 text-xs text-[var(--muted)] transition hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
    >
      {label === "Added" ? <Layers size={13} /> : <Plus size={13} />}
      {usageCount ? "Added to moodboard" : label}
    </button>
  );
}
