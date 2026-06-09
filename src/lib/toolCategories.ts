export const toolCategories = [
  "Image Editing",
  "Web Design",
  "3D",
  "Video Editing",
  "AI Tools",
  "Typography",
  "Color",
  "Mockups",
  "Textures",
  "Icons",
  "Animation",
  "Development",
  "Productivity",
  "Research",
  "Inspiration",
  "Asset Libraries",
  "Photography",
  "Audio",
  "Fonts",
  "Reference",
] as const;

export type ToolCategory = (typeof toolCategories)[number];

const toolCategorySet = new Set<string>(toolCategories);

export function normalizeToolCategories(categories?: string[] | null) {
  return Array.from(
    new Set((categories ?? []).filter((category) => toolCategorySet.has(category))),
  ) as ToolCategory[];
}
