"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AddToProjectButton,
  IndicatorMarks,
  IndicatorMultiSelect,
  selectedIndicatorsFor,
  useIndicators,
} from "@/components/ArchiveActions";
import { gridItemReveal, softSpring } from "@/lib/motion";
import type { DisplayItem } from "@/lib/types";

const aspectClasses = [
  "aspect-[4/5]",
  "aspect-[3/4]",
  "aspect-[5/6]",
  "aspect-[1/1]",
  "aspect-[4/3]",
];

type ItemCardProps = {
  item: DisplayItem;
  index: number;
  compact?: boolean;
  onIndicatorChange: (itemId: string, indicatorIds: string[]) => void;
};

export function ItemCard({
  item,
  index,
  compact = false,
  onIndicatorChange,
}: ItemCardProps) {
  const isLocalImage =
    item.display_url.startsWith("data:") || item.display_url.startsWith("blob:");
  const indicators = useIndicators();
  const selectedIndicators = selectedIndicatorsFor(indicators, item);

  return (
    <motion.article
      data-layout-item
      layout
      variants={gridItemReveal}
      whileHover={{ y: -4 }}
      transition={softSpring}
      className={`${compact ? "" : "masonry-item"} group`}
    >
      <div className="relative overflow-hidden border border-transparent transition duration-300 hover:border-[var(--line)]">
        <Link href={`/app/item/${item.id}`} className="block">
        <div
          className={`image-skeleton relative overflow-hidden bg-[var(--surface-soft)] ${
            compact ? "aspect-[4/5]" : aspectClasses[index % aspectClasses.length]
          }`}
        >
          <IndicatorMarks indicators={selectedIndicators} />
          <Image
            src={item.display_url}
            alt={item.title}
            fill
            unoptimized={isLocalImage}
            loading={index < 8 ? "eager" : "lazy"}
            priority={index < 4}
            sizes="(min-width: 1280px) 31vw, (min-width: 768px) 46vw, 92vw"
            className="object-cover transition duration-500 group-hover:scale-[1.025]"
          />
          <div className={`absolute inset-x-0 bottom-0 translate-y-3 bg-gradient-to-t from-black/58 via-black/24 to-transparent opacity-0 transition duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 ${
            compact ? "p-3" : "p-4"
          }`}>
            <h2 className={`${compact ? "text-xs" : "text-sm"} truncate font-medium text-white`}>
              {item.title}
            </h2>
            <p className={`${compact ? "text-[11px]" : "text-xs"} mt-1 text-white/72`}>
              {selectedIndicators.length
                ? selectedIndicators.map((indicator) => indicator.name).join(", ")
                : item.category}
            </p>
          </div>
        </div>
        </Link>
        <div className="flex items-center justify-between gap-2 px-1 py-2 opacity-0 transition duration-300 group-hover:opacity-100">
          <IndicatorMultiSelect
            compact
            value={item.indicator_ids}
            legacyValue={item.indicator_id}
            onChange={(indicatorIds) => onIndicatorChange(item.id, indicatorIds)}
          />
          <AddToProjectButton sourceType="media" sourceId={item.id} />
        </div>
      </div>
    </motion.article>
  );
}
