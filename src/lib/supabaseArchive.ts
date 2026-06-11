"use client";

import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { normalizeToolCategories } from "@/lib/toolCategories";
import { urlDomain } from "@/lib/clipboard";
import type {
  ArchiveSnapshot,
  BoardItem,
  CollectionItem,
  DisplayItem,
  IdeaItem,
  IndicatorItem,
  PageCanvasItem,
  PageItem,
  PinboardItem,
  ProjectItem,
  WebsiteItem,
} from "@/lib/types";

const cacheOwnerKey = "accumulate.cacheUser";
const importKeyPrefix = "accumulate.supabaseImported";

type SupabaseArchiveResult = {
  userId: string;
  snapshot: ArchiveSnapshot;
};

type SupabaseClient = ReturnType<typeof createClient>;
type ProjectColumn = "title" | "name";
type ProjectDatabaseRow = Omit<ProjectItem, "title"> & {
  title?: string | null;
  name?: string | null;
};
type ProjectWriteRow = {
  id: string;
  user_id: string;
  created_at: string;
  title?: string;
  name?: string;
};

type DynamicSupabaseClient = {
  from: (table: string) => {
    upsert: (
      rows: unknown[],
      options?: { onConflict?: string },
    ) => Promise<{ error: { message: string } | null }>;
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
      neq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
    select: (columns: string) => {
      order: (
        column: string,
        options: { ascending: boolean },
      ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
  };
};

function dynamicClient(supabase: SupabaseClient) {
  return supabase as unknown as DynamicSupabaseClient;
}

let projectColumnPreference: ProjectColumn = "title";

const emptySnapshot: ArchiveSnapshot = {
  media: [],
  resources: [],
  ideasReferences: [],
  projects: [],
  boards: [],
  boardItems: [],
  indicators: [],
  collections: [],
  pages: [],
  pageItems: [],
};

function now() {
  return new Date().toISOString();
}

function importKey(userId: string) {
  return `${importKeyPrefix}.${userId}`;
}

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function hasLocalData(snapshot: ArchiveSnapshot) {
  return (
    snapshot.media.length > 0 ||
    snapshot.resources.length > 0 ||
    snapshot.ideasReferences.length > 0 ||
    snapshot.projects.length > 0 ||
    snapshot.boards.length > 0 ||
    snapshot.boardItems.length > 0 ||
    snapshot.indicators.length > 0 ||
    snapshot.collections.length > 0 ||
    snapshot.pages.length > 0 ||
    snapshot.pageItems.length > 0
  );
}

async function getAuthenticatedClient() {
  if (!hasSupabaseEnv()) return null;

  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return { supabase, userId: user.id };
}

function owned<T extends object>(
  item: T,
  userId: string,
): T & { user_id: string; updated_at: string } {
  return {
    ...item,
    user_id: userId,
    updated_at: now(),
  };
}

function projectFromRow(row: ProjectDatabaseRow): ProjectItem {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title ?? row.name ?? "Untitled project",
    created_at: row.created_at,
  };
}

function projectRow(
  item: ProjectItem,
  userId: string,
  projectColumn: ProjectColumn,
): ProjectWriteRow {
  const base: Omit<ProjectWriteRow, "title" | "name"> = {
    id: item.id,
    user_id: userId,
    created_at: item.created_at,
  };

  return projectColumn === "title"
    ? { ...base, title: item.title }
    : { ...base, name: item.title };
}

function projectRows(
  projects: ProjectItem[],
  userId: string,
  projectColumn: ProjectColumn,
) {
  return projects.map((item) => projectRow(item, userId, projectColumn));
}

function mediaRow(item: DisplayItem, userId: string) {
  return owned(
    {
      ...item,
      display_url: item.display_url || item.image_url,
      tags: item.tags ?? [],
      indicator_ids: item.indicator_ids ?? [],
    },
    userId,
  );
}

function resourceRow(item: WebsiteItem, userId: string) {
  return owned(
    {
      ...item,
      description: item.description ?? "",
      saved_reason: item.saved_reason ?? "",
      used_for: item.used_for ?? "",
      domain: item.domain ?? urlDomain(item.source_url),
      categories: normalizeToolCategories(item.categories),
      indicator_ids: item.indicator_ids ?? [],
    },
    userId,
  );
}

function ideaRow(item: IdeaItem, userId: string) {
  return owned(
    {
      ...item,
      entry_type: item.entry_type ?? "idea",
      indicator_ids: item.indicator_ids ?? [],
    },
    userId,
  );
}

function boardRow(item: PinboardItem, userId: string) {
  return owned(
    {
      ...item,
      height: item.height ?? 680,
    },
    userId,
  );
}

function boardItemRow(item: BoardItem, userId: string) {
  return owned(item, userId);
}

function collectionRow(item: CollectionItem, userId: string) {
  return owned(
    {
      ...item,
      source_ids: item.source_ids ?? [],
    },
    userId,
  );
}

function pageRow(item: PageItem, userId: string) {
  return owned(
    {
      ...item,
      format: item.format ?? "a4-portrait",
      project_id: item.project_id ?? null,
    },
    userId,
  );
}

function pageItemRow(item: PageCanvasItem, userId: string) {
  return owned(
    {
      ...item,
      source_id: item.source_id ?? null,
      content: item.content ?? null,
      rotation: item.rotation ?? 0,
    },
    userId,
  );
}

async function upsertRows<T>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
) {
  if (!rows.length) return;

  const onConflict = table === "collections" ? "id" : "user_id,id";
  const { error } = await dynamicClient(supabase)
    .from(table)
    .upsert(rows as unknown[], { onConflict });

  if (error) {
    throw new Error(`Could not save ${table}: ${error.message}`);
  }
}

function isMissingProjectTitleColumn(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("'title' column") &&
    error.message.toLowerCase().includes("'projects'")
  );
}

async function upsertProjects(
  supabase: SupabaseClient,
  projects: ProjectItem[],
  userId: string,
) {
  if (!projects.length) return;

  try {
    await upsertRows(
      supabase,
      "projects",
      projectRows(projects, userId, projectColumnPreference),
    );
  } catch (error) {
    if (
      projectColumnPreference === "title" &&
      isMissingProjectTitleColumn(error)
    ) {
      projectColumnPreference = "name";
      await upsertRows(
        supabase,
        "projects",
        projectRows(projects, userId, "name"),
      );
      return;
    }

    throw error;
  }
}

async function deleteRow(supabase: SupabaseClient, table: string, id: string) {
  const { error } = await dynamicClient(supabase).from(table).delete().eq("id", id);
  if (error) {
    throw new Error(`Could not delete from ${table}: ${error.message}`);
  }
}

async function replaceUserRows<T>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
) {
  const { error: deleteError } = await dynamicClient(supabase)
    .from(table)
    .delete()
    .neq("id", "");
  if (deleteError) {
    throw new Error(`Could not replace ${table}: ${deleteError.message}`);
  }

  await upsertRows(supabase, table, rows);
}

async function selectRows<T>(
  supabase: SupabaseClient,
  table: string,
  orderColumn = "created_at",
  ascending = true,
) {
  const { data, error } = await dynamicClient(supabase)
    .from(table)
    .select("*")
    .order(orderColumn, { ascending });

  if (error) {
    throw new Error(`Could not load ${table}: ${error.message}`);
  }

  return (data ?? []) as T[];
}

export async function loadSupabaseArchive(): Promise<SupabaseArchiveResult | null> {
  const auth = await getAuthenticatedClient();
  if (!auth) return null;

  const { supabase, userId } = auth;
  const [
    media,
    resources,
    ideasReferences,
    projects,
    boards,
    boardItems,
    indicators,
    collections,
    pages,
    pageItems,
  ] = await Promise.all([
    selectRows<DisplayItem>(supabase, "media", "created_at", false),
    selectRows<WebsiteItem>(supabase, "resources", "created_at", false),
    selectRows<IdeaItem>(supabase, "ideas_references", "created_at", false),
    selectRows<ProjectDatabaseRow>(supabase, "projects"),
    selectRows<PinboardItem>(supabase, "boards", "order"),
    selectRows<BoardItem>(supabase, "board_items"),
    selectRows<IndicatorItem>(supabase, "indicators", "created_at", false),
    selectRows<CollectionItem>(supabase, "collections", "created_at", false).catch(
      () => [],
    ),
    selectRows<PageItem>(supabase, "pages", "created_at", false).catch(
      () => [],
    ),
    selectRows<PageCanvasItem>(supabase, "page_items").catch(() => []),
  ]);

  return {
    userId,
    snapshot: {
      media: media.map((item) => ({
        ...item,
        display_url: item.display_url || item.image_url,
        indicator_ids: item.indicator_ids ?? [],
        tags: item.tags ?? [],
      })),
      resources: resources.map((item) => ({
        ...item,
        description: item.description ?? "",
        saved_reason: item.saved_reason ?? "",
        used_for: item.used_for ?? "",
        domain: item.domain ?? urlDomain(item.source_url),
        categories: normalizeToolCategories(item.categories),
        indicator_ids: item.indicator_ids ?? [],
      })),
      ideasReferences: ideasReferences.map((item) => ({
        ...item,
        entry_type: item.entry_type ?? "idea",
        indicator_ids: item.indicator_ids ?? [],
      })),
      projects: projects.map(projectFromRow),
      boards: boards.map((board) => ({ ...board, height: board.height ?? 680 })),
      boardItems,
      indicators,
      collections: collections.map((collection) => ({
        ...collection,
        source_ids: collection.source_ids ?? [],
      })),
      pages: pages.map((page) => ({
        ...page,
        format: page.format ?? "a4-portrait",
      })),
      pageItems: pageItems.map((item) => ({
        ...item,
        source_id: item.source_id ?? null,
        content: item.content ?? null,
        rotation: item.rotation ?? 0,
      })),
    },
  };
}

export async function saveSupabaseArchive(snapshot: ArchiveSnapshot) {
  const auth = await getAuthenticatedClient();
  if (!auth) return null;

  const { supabase, userId } = auth;
  await upsertProjects(supabase, snapshot.projects, userId);
  await Promise.all([
    upsertRows(supabase, "indicators", snapshot.indicators.map((item) => owned(item, userId))),
    upsertRows(supabase, "media", snapshot.media.map((item) => mediaRow(item, userId))),
    upsertRows(supabase, "resources", snapshot.resources.map((item) => resourceRow(item, userId))),
    upsertRows(
      supabase,
      "ideas_references",
      snapshot.ideasReferences.map((item) => ideaRow(item, userId)),
    ),
    upsertRows(
      supabase,
      "collections",
      snapshot.collections.map((item) => collectionRow(item, userId)),
    ).catch(() => undefined),
    upsertRows(
      supabase,
      "pages",
      snapshot.pages.map((item) => pageRow(item, userId)),
    ).catch(() => undefined),
  ]);
  await upsertRows(supabase, "boards", snapshot.boards.map((item) => boardRow(item, userId)));
  await upsertRows(
    supabase,
    "board_items",
    snapshot.boardItems.map((item) => boardItemRow(item, userId)),
  );
  await upsertRows(
    supabase,
    "page_items",
    snapshot.pageItems.map((item) => pageItemRow(item, userId)),
  ).catch(() => undefined);

  return userId;
}

export async function bootstrapSupabaseArchive(
  localSnapshot: ArchiveSnapshot,
  createDefaultSnapshot: (userId: string) => ArchiveSnapshot,
): Promise<SupabaseArchiveResult | null> {
  const auth = await getAuthenticatedClient();
  if (!auth || !canUseBrowserStorage()) return null;

  const { userId } = auth;
  const cacheOwner = window.localStorage.getItem(cacheOwnerKey);
  const canImportLocalCache = !cacheOwner || cacheOwner === userId;
  const wasImported = window.localStorage.getItem(importKey(userId)) === "1";

  if (!wasImported && canImportLocalCache && hasLocalData(localSnapshot)) {
    await saveSupabaseArchive(localSnapshot);
    window.localStorage.setItem(importKey(userId), "1");
  }

  let loaded = await loadSupabaseArchive();

  if (!loaded?.snapshot.projects.length) {
    await saveSupabaseArchive(createDefaultSnapshot(userId));
    loaded = await loadSupabaseArchive();
  }

  if (loaded && localSnapshot.pages.length && !loaded.snapshot.pages.length) {
    loaded = {
      ...loaded,
      snapshot: {
        ...loaded.snapshot,
        pages: localSnapshot.pages,
        pageItems: localSnapshot.pageItems,
      },
    };
  }

  if (loaded) {
    window.localStorage.setItem(cacheOwnerKey, userId);
  }

  return loaded;
}

export async function persistSupabaseMedia(items: DisplayItem[]) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await upsertRows(auth.supabase, "media", items.map((item) => mediaRow(item, auth.userId)));
}

export async function persistSupabaseResources(items: WebsiteItem[]) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await upsertRows(auth.supabase, "resources", items.map((item) => resourceRow(item, auth.userId)));
}

export async function replaceSupabaseResources(items: WebsiteItem[]) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await replaceUserRows(
    auth.supabase,
    "resources",
    items.map((item) => resourceRow(item, auth.userId)),
  );
}

export async function persistSupabaseIdeas(items: IdeaItem[]) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await upsertRows(
    auth.supabase,
    "ideas_references",
    items.map((item) => ideaRow(item, auth.userId)),
  );
}

export async function replaceSupabaseIdeas(items: IdeaItem[]) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await replaceUserRows(
    auth.supabase,
    "ideas_references",
    items.map((item) => ideaRow(item, auth.userId)),
  );
}

export async function persistSupabaseProjects(items: ProjectItem[]) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await upsertProjects(auth.supabase, items, auth.userId);
}

export async function persistSupabaseBoards(items: PinboardItem[]) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await upsertRows(auth.supabase, "boards", items.map((item) => boardRow(item, auth.userId)));
}

export async function persistSupabaseBoardItems(items: BoardItem[]) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await upsertRows(
    auth.supabase,
    "board_items",
    items.map((item) => boardItemRow(item, auth.userId)),
  );
}

export async function persistSupabaseIndicators(items: IndicatorItem[]) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await upsertRows(auth.supabase, "indicators", items.map((item) => owned(item, auth.userId)));
}

export async function replaceSupabaseIndicators(items: IndicatorItem[]) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await replaceUserRows(
    auth.supabase,
    "indicators",
    items.map((item) => owned(item, auth.userId)),
  );
}

export async function persistSupabaseCollections(items: CollectionItem[]) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await upsertRows(
    auth.supabase,
    "collections",
    items.map((item) => collectionRow(item, auth.userId)),
  ).catch(() => undefined);
}

export async function persistSupabasePages(items: PageItem[]) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await upsertRows(
    auth.supabase,
    "pages",
    items.map((item) => pageRow(item, auth.userId)),
  ).catch(() => undefined);
}

export async function persistSupabasePageItems(items: PageCanvasItem[]) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await upsertRows(
    auth.supabase,
    "page_items",
    items.map((item) => pageItemRow(item, auth.userId)),
  ).catch(() => undefined);
}

export async function replaceSupabaseCollections(items: CollectionItem[]) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await replaceUserRows(
    auth.supabase,
    "collections",
    items.map((item) => collectionRow(item, auth.userId)),
  ).catch(() => undefined);
}

export async function deleteSupabaseMedia(id: string) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await deleteRow(auth.supabase, "media", id);
}

export async function deleteSupabaseProject(id: string) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await deleteRow(auth.supabase, "projects", id);
}

export async function deleteSupabaseBoard(id: string) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await deleteRow(auth.supabase, "boards", id);
}

export async function deleteSupabaseBoardItem(id: string) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await deleteRow(auth.supabase, "board_items", id);
}

export async function deleteSupabasePage(id: string) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await deleteRow(auth.supabase, "pages", id);
}

export async function deleteSupabasePageItem(id: string) {
  const auth = await getAuthenticatedClient();
  if (!auth) return;
  await deleteRow(auth.supabase, "page_items", id);
}

export { cacheOwnerKey, emptySnapshot };
