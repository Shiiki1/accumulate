export const toolCategories = [
  "Web Design",
  "Image Editing",
  "3D",
  "Video",
  "AI Tools",
  "Fonts",
  "Textures",
  "Mockups",
  "Inspiration",
  "Development",
  "Research",
  "Audio",
  "Photography",
  "Color",
  "Animation",
  "Assets",
  "Plugins",
  "Tutorials",
] as const;

export type ToolCategory = (typeof toolCategories)[number];

const toolCategorySet = new Set<string>(toolCategories);

export function normalizeToolCategories(categories?: string[] | null) {
  return Array.from(
    new Set((categories ?? []).filter((category) => toolCategorySet.has(category))),
  ) as ToolCategory[];
}
