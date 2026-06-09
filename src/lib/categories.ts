export const categories = [
  "All",
  "Fashion",
  "Furniture",
  "Interior",
  "Art",
  "Digital Art",
  "Objects",
  "Other",
] as const;

export type Category = (typeof categories)[number];
export type ItemCategory = Exclude<Category, "All">;

export const itemCategories = categories.filter(
  (category): category is ItemCategory => category !== "All",
);
