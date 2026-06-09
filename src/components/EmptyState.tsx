import { motion } from "framer-motion";
import { pageReveal } from "@/lib/motion";

type EmptyStateProps = {
  onAdd?: () => void;
  filtered?: boolean;
};

export function EmptyState({ onAdd, filtered = false }: EmptyStateProps) {
  return (
    <motion.div
      variants={pageReveal}
      initial="hidden"
      animate="visible"
      className="mx-auto flex min-h-[54vh] max-w-md flex-col items-center justify-center px-6 text-center"
    >
      <div className="grid w-52 grid-cols-3 gap-2 opacity-90">
        <div className="h-28 rounded-md border border-[var(--line)] bg-[var(--surface)]" />
        <div className="mt-8 h-36 rounded-md border border-[var(--line)] bg-[var(--surface-soft)]" />
        <div className="h-24 rounded-md border border-[var(--line)] bg-[var(--foreground)]" />
      </div>
      <h2 className="font-serif-accent mt-10 text-4xl">
        {filtered ? "Nothing in this view." : "Start with one image."}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        {filtered
          ? "Try a different category or tag search."
          : "Add a reference, texture, interior, product, artwork, or anything worth keeping close."}
      </p>
      {!filtered && onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="mt-7 rounded-full border border-[var(--line)] px-4 py-2 text-sm transition duration-300 hover:border-[var(--foreground)]"
        >
          Add an item
        </button>
      ) : null}
    </motion.div>
  );
}
