import type { ItemCategory } from "@/lib/categories";
import type { ToolCategory } from "@/lib/toolCategories";

export type ImageType = "upload" | "remote";

export type Item = {
  id: string;
  user_id: string;
  title: string;
  image_url: string;
  image_type: ImageType;
  source_url: string | null;
  category: ItemCategory;
  tags: string[];
  indicator_id?: string | null;
  indicator_ids?: string[];
  notes: string | null;
  created_at: string;
};

export type DisplayItem = Item & {
  display_url: string;
};

export type ItemInsert = {
  user_id: string;
  title: string;
  image_url: string;
  image_type?: ImageType;
  source_url?: string | null;
  category?: ItemCategory;
  tags?: string[];
  indicator_id?: string | null;
  indicator_ids?: string[];
  notes?: string | null;
};

export type ItemUpdate = Partial<Omit<ItemInsert, "user_id">>;

export type WebsiteItem = {
  id: string;
  user_id?: string | null;
  name: string;
  description: string;
  source_url: string;
  domain?: string;
  categories?: ToolCategory[];
  indicator_id?: string | null;
  indicator_ids?: string[];
  created_at: string;
};

export type IdeaEntryType = "idea" | "reference";

export type IdeaItem = {
  id: string;
  user_id?: string | null;
  entry_type?: IdeaEntryType;
  title: string;
  body: string;
  indicator_id?: string | null;
  indicator_ids?: string[];
  created_at: string;
};

export type CollectionSourceType = "media" | "website" | "idea";

export type CollectionItem = {
  id: string;
  user_id?: string | null;
  title: string;
  description?: string;
  source_ids?: {
    source_type: CollectionSourceType;
    source_id: string;
  }[];
  created_at: string;
};

export type ProjectItem = {
  id: string;
  user_id?: string | null;
  title: string;
  created_at: string;
};

export type IndicatorItem = {
  id: string;
  user_id?: string | null;
  name: string;
  color: string;
  created_at: string;
};

export type PinboardItem = {
  id: string;
  project_id: string;
  title: string;
  order: number;
  height?: number;
  created_at: string;
};

export type BoardSourceType =
  | "media"
  | "website"
  | "idea"
  | "text"
  | "separator"
  | "reference";

export type BoardItem = {
  id: string;
  project_id: string;
  board_id: string;
  source_type: BoardSourceType;
  source_id: string;
  content?: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  text_box_enabled?: boolean;
  text_size?: number;
  text_color?: string;
  separator_orientation?: "horizontal" | "vertical";
  separator_thickness?: number;
  separator_color?: string;
  reference_title?: string;
  reference_note?: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      items: {
        Row: Item;
        Insert: ItemInsert;
        Update: ItemUpdate;
        Relationships: [];
      };
      website_items: {
        Row: WebsiteItem;
        Insert: Omit<WebsiteItem, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<WebsiteItem, "id" | "created_at">>;
        Relationships: [];
      };
      idea_items: {
        Row: IdeaItem;
        Insert: Omit<IdeaItem, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<IdeaItem, "id" | "created_at">>;
        Relationships: [];
      };
      collections: {
        Row: CollectionItem;
        Insert: Omit<CollectionItem, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<CollectionItem, "id" | "created_at">>;
        Relationships: [];
      };
      indicators: {
        Row: IndicatorItem;
        Insert: Omit<IndicatorItem, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<IndicatorItem, "id" | "created_at">>;
        Relationships: [];
      };
      projects: {
        Row: ProjectItem;
        Insert: Omit<ProjectItem, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ProjectItem, "id" | "created_at">>;
        Relationships: [];
      };
      project_board_items: {
        Row: BoardItem;
        Insert: Omit<BoardItem, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<BoardItem, "id" | "created_at">>;
        Relationships: [];
      };
      pinboards: {
        Row: PinboardItem;
        Insert: Omit<PinboardItem, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<PinboardItem, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
