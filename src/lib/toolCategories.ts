export const toolCategories = [
  "Web Design",
  "Image Editing",
  "3D",
  "Video Editing",
  "AI Tools",
  "Typography",
  "Fonts",
  "Color",
  "Textures",
  "Mockups",
  "Icons",
  "Shaders",
  "UI Libraries",
  "Templates",
  "Inspiration",
  "Development",
  "No-Code",
  "Plugins",
  "Asset Libraries",
  "Research",
  "Reference",
  "Tutorials",
  "Audio",
  "Photography",
  "Animation",
  "Assets",
] as const;

const categoryAliases: Record<string, (typeof toolCategories)[number]> = {
  Video: "Video Editing",
  "Asset Library": "Asset Libraries",
};

export type ToolCategory = (typeof toolCategories)[number];

const toolCategorySet = new Set<string>(toolCategories);

export function normalizeToolCategories(categories?: string[] | null) {
  return Array.from(
    new Set(
      (categories ?? [])
        .map((category) => categoryAliases[category] ?? category)
        .filter((category) => toolCategorySet.has(category)),
    ),
  ) as ToolCategory[];
}
