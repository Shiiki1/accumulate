import { ItemCard } from "@/components/ItemCard";
import { staggerParent } from "@/lib/motion";
import type { DisplayItem } from "@/lib/types";
import { motion } from "framer-motion";

type MasonryGridProps = {
  items: DisplayItem[];
  onIndicatorChange: (itemId: string, indicatorIds: string[]) => void;
};

export function MasonryGrid({ items, onIndicatorChange }: MasonryGridProps) {
  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      animate="visible"
      className="masonry columns-1 md:columns-2 xl:columns-3"
    >
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          item={item}
          index={index}
          onIndicatorChange={onIndicatorChange}
        />
      ))}
    </motion.div>
  );
}
