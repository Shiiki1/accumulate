import type {
  BoardItem,
  BoardSourceType,
  ArchiveSnapshot,
  CollectionItem,
  DisplayItem,
  IdeaItem,
  IndicatorItem,
  PageCanvasItem,
  PageItem,
  PaletteColorItem,
  PinboardItem,
  ProjectItem,
  WebsiteItem,
} from "@/lib/types";
import { urlDomain } from "@/lib/clipboard";
import { normalizeToolCategories } from "@/lib/toolCategories";
import {
  bootstrapSupabaseArchive,
  deleteSupabaseBoard,
  deleteSupabaseBoardItem,
  deleteSupabaseMedia,
  deleteSupabasePage,
  deleteSupabasePageItem,
  deleteSupabaseProject,
  persistSupabasePageItems,
  persistSupabasePages,
  persistSupabaseBoardItems,
  persistSupabaseBoards,
  persistSupabaseMedia,
  persistSupabaseProjects,
  replaceSupabaseCollections,
  replaceSupabaseIdeas,
  replaceSupabaseIndicators,
  replaceSupabaseResources,
  saveSupabaseArchive,
} from "@/lib/supabaseArchive";

export const LOCAL_USER_ID = "local-archive";
export const MAX_INDICATORS_PER_ITEM = 5;

const mediaKey = "accumulate.media";
const websitesKey = "accumulate.websites";
const ideasKey = "accumulate.ideas";
const projectsKey = "accumulate.projects";
const pinboardsKey = "accumulate.pinboards";
const pagesKey = "accumulate.pages";
const pageItemsKey = "accumulate.pageItems";
const paletteColorsKey = "accumulate.paletteColors";
const collectionsKey = "accumulate.collections";
const activeProjectKey = "accumulate.activeProject";
const indicatorsKey = "accumulate.indicators";
const boardItemsKey = "accumulate.boardItems";

export const archiveEvents = {
  media: "accumulate:media-items",
  websites: "accumulate:website-items",
  ideas: "accumulate:idea-items",
  boardItems: "accumulate:board-items",
  projects: "accumulate:projects",
  collections: "accumulate:collections",
  pages: "accumulate:pages",
  pageItems: "accumulate:page-items",
  paletteColors: "accumulate:palette-colors",
} as const;

function emitArchiveEvent(eventName: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(eventName));
  }
}

function readItems<T>(key: string): T[] {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T[]) : [];
  } catch {
    return [];
  }
}

function isDataImageUrl(value?: string | null) {
  return typeof value === "string" && value.startsWith("data:image");
}

function isQuotaExceededError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

function sanitizeMediaForCache(items: DisplayItem[]) {
  return items
    .map((item) => {
      const imageUrl = isDataImageUrl(item.image_url) ? "" : item.image_url;
      const displayUrl = isDataImageUrl(item.display_url) ? "" : item.display_url;
      const fallbackUrl = imageUrl || displayUrl;

      if (!fallbackUrl) return null;

      return {
        ...item,
        image_url: fallbackUrl,
        display_url: displayUrl || fallbackUrl,
      };
    })
    .filter((item): item is DisplayItem => Boolean(item));
}

function normalizePage(page: PageItem): PageItem {
  return {
    ...page,
    format: page.format ?? "a4-portrait",
    project_id: page.project_id ?? null,
  };
}

function normalizePaletteColor(color: PaletteColorItem): PaletteColorItem {
  return {
    ...color,
    name: color.name ?? "",
    hex: color.hex.toUpperCase(),
    favorite: Boolean(color.favorite),
    updated_at: color.updated_at ?? color.created_at,
  };
}

function dedupePages(pages: PageItem[]) {
  const seen = new Set<string>();
  const deduped: PageItem[] = [];

  for (const page of pages.map(normalizePage)) {
    if (seen.has(page.id)) continue;
    seen.add(page.id);
    deduped.push(page);
  }

  return deduped;
}

function writeItems<T>(key: string, items: T[]) {
  const cacheItems =
    key === mediaKey
      ? (sanitizeMediaForCache(items as DisplayItem[]) as T[])
      : key === pagesKey
        ? (dedupePages(items as PageItem[]) as T[])
      : items;

  try {
    window.localStorage.setItem(key, JSON.stringify(cacheItems));
  } catch (error) {
    if (isQuotaExceededError(error)) {
      if (key === mediaKey) {
        try {
          window.localStorage.removeItem(key);
          window.localStorage.setItem(key, JSON.stringify(cacheItems));
        } catch (retryError) {
          ignorePersistenceError(retryError);
        }
        return;
      }

      ignorePersistenceError(error);
      return;
    }

    throw error;
  }
}

function ignorePersistenceError(error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("Archive persistence failed:", error);
  }
}

function persist(promise: Promise<unknown>) {
  void promise.catch(ignorePersistenceError);
}

function createDefaultProject(userId = LOCAL_USER_ID): ProjectItem {
  return {
    id: "default-project",
    user_id: userId,
    title: "Current Project",
    created_at: new Date().toISOString(),
  };
}

function createDefaultSnapshot(userId = LOCAL_USER_ID): ArchiveSnapshot {
  const project = createDefaultProject(userId);

  return {
    media: [],
    resources: [],
    ideasReferences: [],
    projects: [project],
    boards: [
      {
        id: `${project.id}-board-1`,
        project_id: project.id,
        title: "Pinboard 1",
        order: 0,
        height: 680,
        created_at: new Date().toISOString(),
      },
    ],
    boardItems: [],
    indicators: [],
    collections: [],
    pages: [],
    pageItems: [],
  };
}

export function normalizeIndicatorIds(item: {
  indicator_ids?: string[];
  indicator_id?: string | null;
}) {
  const ids = item.indicator_ids?.length
    ? item.indicator_ids
    : item.indicator_id
      ? [item.indicator_id]
      : [];

  return Array.from(new Set(ids.filter(Boolean))).slice(
    0,
    MAX_INDICATORS_PER_ITEM,
  );
}

function readArchiveSnapshot(): ArchiveSnapshot {
  return {
    media: readMediaItems(),
    resources: readWebsiteItems(),
    ideasReferences: readIdeaItems(),
    projects: readProjects(),
    boards: readItems<PinboardItem>(pinboardsKey).map((board) => ({
      ...board,
      height: board.height ?? 680,
    })),
    boardItems: readItems<BoardItem>(boardItemsKey).map(normalizeBoardItem),
    indicators: readIndicators(),
    collections: readCollections(),
    pages: [],
    pageItems: [],
  };
}

function replaceArchiveSnapshot(snapshot: ArchiveSnapshot) {
  writeItems(mediaKey, sanitizeMediaForCache(snapshot.media));
  writeItems(websitesKey, snapshot.resources);
  writeItems(ideasKey, snapshot.ideasReferences);
  writeItems(projectsKey, snapshot.projects);
  writeItems(pinboardsKey, snapshot.boards);
  writeItems(boardItemsKey, snapshot.boardItems);
  writeItems(indicatorsKey, snapshot.indicators);
  writeItems(collectionsKey, snapshot.collections);

  emitArchiveEvent(archiveEvents.media);
  emitArchiveEvent(archiveEvents.websites);
  emitArchiveEvent(archiveEvents.ideas);
  emitArchiveEvent(archiveEvents.boardItems);
  emitArchiveEvent(archiveEvents.projects);
  emitArchiveEvent(archiveEvents.collections);
  emitArchiveEvent("accumulate:indicators");
}

export async function bootstrapArchivePersistence() {
  const result = await bootstrapSupabaseArchive(
    readArchiveSnapshot(),
    createDefaultSnapshot,
  );

  if (!result) return null;

  replaceArchiveSnapshot(result.snapshot);
  return result;
}

export function readMediaItems() {
  return sanitizeMediaForCache(readItems<DisplayItem>(mediaKey)).map((item) => ({
    ...item,
    indicator_ids: normalizeIndicatorIds(item),
  }));
}

export function saveMediaItem(item: DisplayItem) {
  const savedItem = {
    ...item,
    indicator_ids: normalizeIndicatorIds(item),
  };
  const items = [savedItem, ...readMediaItems()];
  writeItems(mediaKey, items);
  persist(persistSupabaseMedia([savedItem]));
  emitArchiveEvent(archiveEvents.media);
  return savedItem;
}

export function updateMediaItem(item: DisplayItem) {
  const savedItem = {
    ...item,
    indicator_ids: normalizeIndicatorIds(item),
  };
  const items = readMediaItems().map((current) =>
    current.id === savedItem.id ? savedItem : current,
  );
  writeItems(mediaKey, items);
  persist(persistSupabaseMedia([savedItem]));
  emitArchiveEvent(archiveEvents.media);
  return savedItem;
}

export function saveMediaItems(items: DisplayItem[]) {
  writeItems(
    mediaKey,
    items.map((item) => ({
      ...item,
      indicator_ids: normalizeIndicatorIds(item),
    })),
  );
  persist(persistSupabaseMedia(items));
  emitArchiveEvent(archiveEvents.media);
}

export function deleteMediaItem(id: string) {
  writeItems(
    mediaKey,
    readMediaItems().filter((item) => item.id !== id),
  );
  persist(deleteSupabaseMedia(id));
  emitArchiveEvent(archiveEvents.media);
}

export function findMediaItem(id: string) {
  return readMediaItems().find((item) => item.id === id) ?? null;
}

export function readWebsiteItems() {
  return readItems<WebsiteItem>(websitesKey).map((item) => ({
    ...item,
    saved_reason: item.saved_reason ?? "",
    used_for: item.used_for ?? "",
    domain: item.domain ?? urlDomain(item.source_url),
    categories: normalizeToolCategories(item.categories),
    indicator_ids: normalizeIndicatorIds(item),
  }));
}

export function saveWebsiteItems(items: WebsiteItem[]) {
  writeItems(
    websitesKey,
    items.map((item) => ({
      ...item,
      saved_reason: item.saved_reason ?? "",
      used_for: item.used_for ?? "",
      domain: item.domain ?? urlDomain(item.source_url),
      categories: normalizeToolCategories(item.categories),
      indicator_ids: normalizeIndicatorIds(item),
    })),
  );
  persist(replaceSupabaseResources(items));
  emitArchiveEvent(archiveEvents.websites);
}

export function readIdeaItems() {
  return readItems<IdeaItem>(ideasKey).map((item) => ({
    ...item,
    entry_type: item.entry_type ?? "idea",
    indicator_ids: normalizeIndicatorIds(item),
  }));
}

export function saveIdeaItems(items: IdeaItem[]) {
  writeItems(
    ideasKey,
    items.map((item) => ({
      ...item,
      entry_type: item.entry_type ?? "idea",
      indicator_ids: normalizeIndicatorIds(item),
    })),
  );
  persist(replaceSupabaseIdeas(items));
  emitArchiveEvent(archiveEvents.ideas);
}

export function readCollections() {
  return readItems<CollectionItem>(collectionsKey).map((collection) => ({
    ...collection,
    source_ids: collection.source_ids ?? [],
  }));
}

export function saveCollections(collections: CollectionItem[]) {
  writeItems(
    collectionsKey,
    collections.map((collection) => ({
      ...collection,
      source_ids: collection.source_ids ?? [],
    })),
  );
  persist(replaceSupabaseCollections(collections));
  emitArchiveEvent(archiveEvents.collections);
}

export function readPages(projectId?: string) {
  const rawPages = readItems<PageItem>(pagesKey);
  const pages = dedupePages(rawPages);

  if (pages.length !== rawPages.length) {
    writeItems(pagesKey, pages);
  }

  return projectId
    ? pages.filter((page) => page.project_id === projectId)
    : pages;
}

export function findPage(id: string) {
  return readPages().find((page) => page.id === id) ?? null;
}

export function savePages(pages: PageItem[]) {
  const nextPages = dedupePages(pages);

  writeItems(
    pagesKey,
    nextPages,
  );
  persist(persistSupabasePages(nextPages));
  emitArchiveEvent(archiveEvents.pages);
}

export function createPage(projectId = readActiveProjectId()) {
  const now = new Date().toISOString();
  const page: PageItem = {
    id: crypto.randomUUID(),
    user_id: LOCAL_USER_ID,
    project_id: projectId,
    title: "Untitled Page",
    format: "a4-portrait",
    created_at: now,
    updated_at: now,
  };

  savePages([page, ...readPages()]);
  return page;
}

export function updatePage(pageId: string, patch: Partial<PageItem>) {
  const pages = readPages();
  const nextPages = pages.map((page) =>
    page.id === pageId
      ? {
          ...page,
          ...patch,
          format: patch.format ?? page.format ?? "a4-portrait",
          updated_at: new Date().toISOString(),
        }
      : page,
  );
  const updatedPage = nextPages.find((page) => page.id === pageId) ?? null;

  writeItems(pagesKey, nextPages);
  if (updatedPage) persist(persistSupabasePages([updatedPage]));
  emitArchiveEvent(archiveEvents.pages);
  return updatedPage;
}

export function deletePage(pageId: string) {
  const page = findPage(pageId);
  if (!page) return null;
  const pageBoardItems = readItems<BoardItem>(boardItemsKey)
    .map(normalizeBoardItem)
    .filter((item) => item.source_type === "page" && item.source_id === pageId);

  writeItems(
    pagesKey,
    readPages().filter((current) => current.id !== pageId),
  );
  writeItems(
    pageItemsKey,
    readPageItems().filter((item) => item.page_id !== pageId),
  );
  writeItems(
    boardItemsKey,
    readItems<BoardItem>(boardItemsKey)
      .map(normalizeBoardItem)
      .filter((item) => !(item.source_type === "page" && item.source_id === pageId)),
  );
  persist(deleteSupabasePage(pageId));
  pageBoardItems.forEach((item) => persist(deleteSupabaseBoardItem(item.id)));
  emitArchiveEvent(archiveEvents.pages);
  emitArchiveEvent(archiveEvents.pageItems);
  emitArchiveEvent(archiveEvents.boardItems);
  return page;
}

function normalizePageItem(item: PageCanvasItem): PageCanvasItem {
  return {
    ...item,
    source_id: item.source_id ?? null,
    content: item.content ?? null,
    x: Math.max(0, Math.round(item.x)),
    y: Math.max(0, Math.round(item.y)),
    width: Math.max(40, Math.round(item.width)),
    height: Math.max(32, Math.round(item.height)),
    rotation: item.rotation ?? 0,
  };
}

export function readPageItems(pageId?: string) {
  const items = readItems<PageCanvasItem>(pageItemsKey).map(normalizePageItem);
  return pageId ? items.filter((item) => item.page_id === pageId) : items;
}

export function savePageItems(items: PageCanvasItem[]) {
  const allItems = readItems<PageCanvasItem>(pageItemsKey).map(normalizePageItem);
  const ids = new Set(items.map((item) => item.id));
  const nextItems = [
    ...allItems.filter((item) => !ids.has(item.id)),
    ...items.map(normalizePageItem),
  ];
  writeItems(pageItemsKey, nextItems);
  persist(persistSupabasePageItems(items.map(normalizePageItem)));
  emitArchiveEvent(archiveEvents.pageItems);
}

export function addPageItem(
  pageId: string,
  item: Omit<PageCanvasItem, "id" | "page_id" | "created_at">,
) {
  const createdItem: PageCanvasItem = normalizePageItem({
    ...item,
    id: crypto.randomUUID(),
    page_id: pageId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  savePageItems([createdItem]);
  return createdItem;
}

export function updatePageItem(
  itemId: string,
  patch: Partial<PageCanvasItem>,
) {
  const items = readItems<PageCanvasItem>(pageItemsKey).map(normalizePageItem);
  const nextItems = items.map((item) =>
    item.id === itemId
      ? normalizePageItem({
          ...item,
          ...patch,
          updated_at: new Date().toISOString(),
        })
      : item,
  );
  const updatedItem = nextItems.find((item) => item.id === itemId) ?? null;

  writeItems(pageItemsKey, nextItems);
  if (updatedItem) persist(persistSupabasePageItems([updatedItem]));
  emitArchiveEvent(archiveEvents.pageItems);
  return updatedItem;
}

export function deletePageItem(itemId: string) {
  writeItems(
    pageItemsKey,
    readPageItems().filter((item) => item.id !== itemId),
  );
  persist(deleteSupabasePageItem(itemId));
  emitArchiveEvent(archiveEvents.pageItems);
}

export function readProjects() {
  const projects = readItems<ProjectItem>(projectsKey);

  if (projects.length) return projects;

  const defaultProject = createDefaultProject();

  writeItems(projectsKey, [defaultProject]);
  persist(persistSupabaseProjects([defaultProject]));
  return [defaultProject];
}

export function saveProjects(projects: ProjectItem[]) {
  writeItems(projectsKey, projects);
  persist(persistSupabaseProjects(projects));
  emitArchiveEvent(archiveEvents.projects);
}

export function cloneProject(projectId: string) {
  const projects = readProjects();
  const sourceProject = projects.find((project) => project.id === projectId);
  if (!sourceProject) return null;

  const clonedProject: ProjectItem = {
    ...sourceProject,
    id: crypto.randomUUID(),
    title: `${sourceProject.title} Copy`,
    created_at: new Date().toISOString(),
  };

  const pinboards = readItems<PinboardItem>(pinboardsKey);
  const sourceBoards = pinboards
    .filter((board) => board.project_id === projectId)
    .sort((a, b) => a.order - b.order);
  const boardIdMap = new Map<string, string>();
  const clonedBoards = sourceBoards.map((board) => {
    const clonedBoardId = crypto.randomUUID();
    boardIdMap.set(board.id, clonedBoardId);
    return {
      ...board,
      id: clonedBoardId,
      project_id: clonedProject.id,
      created_at: new Date().toISOString(),
    };
  });

  const boardItems = readItems<BoardItem>(boardItemsKey).map(normalizeBoardItem);
  const clonedItems = boardItems
    .filter((item) => item.project_id === projectId)
    .map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      project_id: clonedProject.id,
      board_id: boardIdMap.get(item.board_id) ?? clonedBoards[0]?.id ?? item.board_id,
      created_at: new Date().toISOString(),
    }));

  writeItems(projectsKey, [...projects, clonedProject]);
  writeItems(pinboardsKey, [...pinboards, ...clonedBoards]);
  writeItems(boardItemsKey, [...boardItems, ...clonedItems]);
  persist(saveSupabaseArchive(readArchiveSnapshot()));
  emitArchiveEvent(archiveEvents.projects);
  emitArchiveEvent(archiveEvents.boardItems);
  return clonedProject;
}

export function deleteProject(projectId: string) {
  const projects = readProjects();
  const project = projects.find((current) => current.id === projectId);
  if (!project) return null;

  const remainingProjects = projects.filter(
    (current) => current.id !== projectId,
  );
  const fallbackProject =
    remainingProjects[0] ??
    createDefaultProject();

  const nextProjects = remainingProjects.length
    ? remainingProjects
    : [fallbackProject];

  writeItems(projectsKey, nextProjects);
  writeItems(
    pinboardsKey,
    readItems<PinboardItem>(pinboardsKey).filter(
      (board) => board.project_id !== projectId,
    ),
  );
  writeItems(
    boardItemsKey,
    readItems<BoardItem>(boardItemsKey).filter(
      (item) => item.project_id !== projectId,
    ),
  );
  persist(
    deleteSupabaseProject(projectId).then(() =>
      remainingProjects.length
        ? undefined
        : persistSupabaseProjects([fallbackProject]),
    ),
  );

  if (readActiveProjectId() === projectId) {
    saveActiveProjectId(fallbackProject.id);
  }

  emitArchiveEvent(archiveEvents.projects);
  emitArchiveEvent(archiveEvents.boardItems);
  return project;
}

export function readActiveProjectId() {
  if (typeof window === "undefined") return "default-project";

  const projects = readProjects();
  const storedProjectId = window.localStorage.getItem(activeProjectKey);
  const activeProject = projects.find((project) => project.id === storedProjectId);
  const activeProjectId = activeProject?.id ?? projects[0].id;

  if (storedProjectId !== activeProjectId) {
    window.localStorage.setItem(activeProjectKey, activeProjectId);
  }

  return activeProjectId;
}

export function saveActiveProjectId(projectId: string) {
  window.localStorage.setItem(activeProjectKey, projectId);
}

export function readIndicators() {
  return readItems<IndicatorItem>(indicatorsKey);
}

export function saveIndicators(indicators: IndicatorItem[]) {
  writeItems(indicatorsKey, indicators);
  persist(replaceSupabaseIndicators(indicators));
  emitArchiveEvent("accumulate:indicators");
}

export function readPaletteColors(projectId = readActiveProjectId()) {
  return readItems<PaletteColorItem>(paletteColorsKey)
    .map(normalizePaletteColor)
    .filter((color) => color.project_id === projectId);
}

export function savePaletteColors(colors: PaletteColorItem[]) {
  const normalizedColors = colors.map(normalizePaletteColor);
  const projectIds = new Set(normalizedColors.map((color) => color.project_id));
  const existingColors = readItems<PaletteColorItem>(paletteColorsKey)
    .map(normalizePaletteColor)
    .filter((color) => !projectIds.has(color.project_id));

  writeItems(paletteColorsKey, [...existingColors, ...normalizedColors]);
  emitArchiveEvent(archiveEvents.paletteColors);
}

export function readPinboards(projectId = readActiveProjectId()) {
  const pinboards = readItems<PinboardItem>(pinboardsKey);
  const projectPinboards = pinboards
    .filter((board) => board.project_id === projectId)
    .map((board) => ({ ...board, height: board.height ?? 680 }))
    .sort((a, b) => a.order - b.order);

  if (projectPinboards.length) return projectPinboards;

  const defaultBoard: PinboardItem = {
    id: `${projectId}-board-1`,
    project_id: projectId,
    title: "Pinboard 1",
    order: 0,
    height: 680,
    created_at: new Date().toISOString(),
  };

  writeItems(pinboardsKey, [...pinboards, defaultBoard]);
  persist(persistSupabaseBoards([defaultBoard]));
  return [defaultBoard];
}

export function readAllPinboards() {
  return readItems<PinboardItem>(pinboardsKey).map((board) => ({
    ...board,
    height: board.height ?? 680,
  }));
}

export function savePinboards(pinboards: PinboardItem[]) {
  const allPinboards = readItems<PinboardItem>(pinboardsKey);
  const projectIds = new Set(pinboards.map((board) => board.project_id));
  writeItems(pinboardsKey, [
    ...allPinboards.filter((board) => !projectIds.has(board.project_id)),
    ...pinboards,
  ]);
  persist(persistSupabaseBoards(pinboards));
}

export function createPinboard(projectId = readActiveProjectId()) {
  const pinboards = readPinboards(projectId);
  const board: PinboardItem = {
    id: crypto.randomUUID(),
    project_id: projectId,
    title: `Pinboard ${pinboards.length + 1}`,
    order: pinboards.length,
    height: 680,
    created_at: new Date().toISOString(),
  };

  savePinboards([...pinboards, board]);
  return board;
}

function normalizeBoardItem(item: BoardItem): BoardItem {
  const board = readPinboards(item.project_id)[0];
  const normalized = {
    ...item,
    board_id: item.board_id || board.id,
    height:
      item.height ??
      (item.source_type === "media"
        ? Math.round(item.width * 1.25)
        : item.source_type === "separator"
          ? 2
          : item.source_type === "page"
            ? Math.round(item.width * 1.414)
          : item.source_type === "reference"
            ? 124
          : 180),
    text_box_enabled: item.text_box_enabled ?? true,
    text_size: item.text_size ?? 32,
    text_color: item.text_color ?? "var(--board-card-text)",
    separator_orientation: item.separator_orientation ?? "horizontal",
    separator_thickness: item.separator_thickness ?? 4,
    separator_color: item.separator_color ?? "var(--board-line-strong)",
  };

  if (item.board_id) return normalized;

  return {
    ...normalized,
    board_id: board.id,
  };
}

export function readBoardItems(projectId?: string, boardId?: string) {
  const items = readItems<BoardItem>(boardItemsKey).map(normalizeBoardItem);

  return items.filter((item) => {
    const projectMatch = projectId ? item.project_id === projectId : true;
    const boardMatch = boardId ? item.board_id === boardId : true;
    return projectMatch && boardMatch;
  });
}

export function saveBoardItems(items: BoardItem[]) {
  const allItems = readItems<BoardItem>(boardItemsKey).map(normalizeBoardItem);
  const ids = new Set(items.map((item) => item.id));
  writeItems(boardItemsKey, [
    ...allItems.filter((item) => !ids.has(item.id)),
    ...items,
  ]);
  persist(persistSupabaseBoardItems(items));
  emitArchiveEvent(archiveEvents.boardItems);
}

export function updatePinboard(boardId: string, patch: Partial<PinboardItem>) {
  const boards = readItems<PinboardItem>(pinboardsKey);
  const nextBoards = boards.map((board) =>
    board.id === boardId
      ? {
          ...board,
          ...patch,
          height:
            patch.height === undefined
              ? board.height
              : Math.max(320, Math.round(patch.height)),
        }
      : board,
  );

  writeItems(pinboardsKey, nextBoards);
  const updatedBoard = nextBoards.find((board) => board.id === boardId) ?? null;
  if (updatedBoard) persist(persistSupabaseBoards([updatedBoard]));
  return updatedBoard;
}

export function deletePinboard(boardId: string) {
  const boards = readItems<PinboardItem>(pinboardsKey);
  const board = boards.find((current) => current.id === boardId);
  if (!board) return null;

  const projectBoards = boards.filter(
    (current) => current.project_id === board.project_id,
  );
  if (projectBoards.length <= 1) return null;

  const nextBoards = boards
    .filter((current) => current.id !== boardId)
    .map((current) =>
      current.project_id === board.project_id && current.order > board.order
        ? { ...current, order: current.order - 1 }
        : current,
    );

  writeItems(pinboardsKey, nextBoards);
  writeItems(
    boardItemsKey,
    readItems<BoardItem>(boardItemsKey).filter((item) => item.board_id !== boardId),
  );
  persist(deleteSupabaseBoard(boardId));
  persist(persistSupabaseBoards(nextBoards.filter((item) => item.project_id === board.project_id)));

  return board;
}

export function addSourceToProject(
  sourceType: Exclude<BoardSourceType, "text" | "separator" | "reference">,
  sourceId: string,
  projectId = readActiveProjectId(),
  boardId = readPinboards(projectId)[0].id,
) {
  const items = readItems<BoardItem>(boardItemsKey).map(normalizeBoardItem);
  const existing = items.find(
    (item) =>
      item.project_id === projectId &&
      item.source_type === sourceType &&
      item.source_id === sourceId,
  );

  if (existing) return existing;

  const projectItemCount = items.filter(
    (item) => item.project_id === projectId && item.board_id === boardId,
  ).length;

  const width = sourceType === "media" ? 260 : sourceType === "page" ? 230 : 300;
  const item: BoardItem = {
    id: crypto.randomUUID(),
    project_id: projectId,
    board_id: boardId,
    source_type: sourceType,
    source_id: sourceId,
    x: 88 + (projectItemCount % 4) * 70,
    y: 92 + Math.floor(projectItemCount / 4) * 84,
    width,
    height:
      sourceType === "media"
        ? Math.round(width * 1.25)
        : sourceType === "page"
          ? Math.round(width * 1.414)
          : 180,
    created_at: new Date().toISOString(),
  };

  writeItems(boardItemsKey, [...items, item]);
  persist(persistSupabaseBoardItems([item]));
  emitArchiveEvent(archiveEvents.boardItems);
  return item;
}

export function addBoardElement(
  sourceType: Extract<BoardSourceType, "text" | "separator" | "reference">,
  content: string,
  projectId = readActiveProjectId(),
  boardId = readPinboards(projectId)[0].id,
) {
  const items = readItems<BoardItem>(boardItemsKey).map(normalizeBoardItem);
  const projectItemCount = items.filter(
    (item) => item.project_id === projectId && item.board_id === boardId,
  ).length;
  const width =
    sourceType === "separator" ? 360 : sourceType === "reference" ? 240 : 260;

  const item: BoardItem = {
    id: crypto.randomUUID(),
    project_id: projectId,
    board_id: boardId,
    source_type: sourceType,
    source_id: crypto.randomUUID(),
    content,
    x: 96 + (projectItemCount % 3) * 80,
    y: 110 + Math.floor(projectItemCount / 3) * 90,
    width,
    height:
      sourceType === "separator" ? 4 : sourceType === "reference" ? 124 : 132,
    text_box_enabled: sourceType === "text" ? true : undefined,
    text_size: sourceType === "text" ? 32 : undefined,
    text_color: sourceType === "text" ? "var(--board-card-text)" : undefined,
    separator_orientation: sourceType === "separator" ? "horizontal" : undefined,
    separator_thickness: sourceType === "separator" ? 4 : undefined,
    separator_color: sourceType === "separator" ? "var(--board-line-strong)" : undefined,
    reference_title: sourceType === "reference" ? content : undefined,
    reference_note: sourceType === "reference" ? "" : undefined,
    created_at: new Date().toISOString(),
  };

  writeItems(boardItemsKey, [...items, item]);
  persist(persistSupabaseBoardItems([item]));
  emitArchiveEvent(archiveEvents.boardItems);
  return item;
}

export function updateBoardItem(itemId: string, patch: Partial<BoardItem>) {
  const items = readItems<BoardItem>(boardItemsKey).map(normalizeBoardItem);
  const nextItems = items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          ...patch,
          x:
            patch.x === undefined
              ? item.x
              : Math.max(32, Math.round(patch.x)),
          y:
            patch.y === undefined
              ? item.y
              : Math.max(32, Math.round(patch.y)),
          width:
            patch.width === undefined
              ? item.width
              : Math.max(item.source_type === "separator" ? 2 : 80, Math.round(patch.width)),
          height:
            patch.height === undefined
              ? item.height
              : Math.max(item.source_type === "separator" ? 2 : 40, Math.round(patch.height)),
        }
      : item,
  );

  writeItems(boardItemsKey, nextItems);
  const updatedItem = nextItems.find((item) => item.id === itemId) ?? null;
  if (updatedItem) persist(persistSupabaseBoardItems([updatedItem]));
  emitArchiveEvent(archiveEvents.boardItems);
  return updatedItem;
}

export function cloneBoardItem(itemId: string) {
  const items = readItems<BoardItem>(boardItemsKey).map(normalizeBoardItem);
  const item = items.find((current) => current.id === itemId);
  if (!item) return null;

  const clonedItem: BoardItem = {
    ...item,
    id: crypto.randomUUID(),
    source_id:
      item.source_type === "text" ||
      item.source_type === "separator" ||
      item.source_type === "reference"
        ? crypto.randomUUID()
        : item.source_id,
    x: item.x + 28,
    y: item.y + 28,
    created_at: new Date().toISOString(),
  };

  writeItems(boardItemsKey, [...items, clonedItem]);
  persist(persistSupabaseBoardItems([clonedItem]));
  emitArchiveEvent(archiveEvents.boardItems);
  return clonedItem;
}

export function deleteBoardItem(itemId: string) {
  writeItems(
    boardItemsKey,
    readItems<BoardItem>(boardItemsKey)
      .map(normalizeBoardItem)
      .filter((item) => item.id !== itemId),
  );
  persist(deleteSupabaseBoardItem(itemId));
  emitArchiveEvent(archiveEvents.boardItems);
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
