import { ItemCard } from "@/components/ItemCard";
import { staggerParent } from "@/lib/motion";
import type { DisplayItem } from "@/lib/types";
import { motion } from "framer-motion";

type MasonryGridProps = {
  items: DisplayItem[];
  onIndicatorChange: (itemId: string, indicatorIds: string[]) => void;
  compact?: boolean;
};

export function MasonryGrid({
  items,
  onIndicatorChange,
  compact = false,
}: MasonryGridProps) {
  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      animate="visible"
      className={
        compact
          ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          : "masonry columns-1 md:columns-2 xl:columns-3"
      }
    >
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          item={item}
          index={index}
          compact={compact}
          onIndicatorChange={onIndicatorChange}
        />
      ))}
    </motion.div>
  );
}
