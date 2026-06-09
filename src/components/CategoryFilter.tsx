"use client";

import { Search } from "lucide-react";
import { categories, type Category } from "@/lib/categories";

type CategoryFilterProps = {
  activeCategory: Category;
  search: string;
  onCategoryChange: (category: Category) => void;
  onSearchChange: (search: string) => void;
};

export function CategoryFilter({
  activeCategory,
  search,
  onCategoryChange,
  onSearchChange,
}: CategoryFilterProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => onCategoryChange(category)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-xs transition duration-300 ${
                activeCategory === category
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                  : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        <label className="relative block w-full md:w-64">
          <Search
            aria-hidden="true"
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search media"
            className="premium-focus h-10 w-full rounded-full border border-[var(--line)] bg-transparent pl-9 pr-3 text-sm placeholder:text-[var(--muted)]"
          />
        </label>
      </div>
    </div>
  );
}
