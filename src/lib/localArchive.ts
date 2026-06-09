import type {
  BoardItem,
  BoardSourceType,
  CollectionItem,
  DisplayItem,
  IdeaItem,
  IndicatorItem,
  PinboardItem,
  ProjectItem,
  WebsiteItem,
} from "@/lib/types";
import { urlDomain } from "@/lib/clipboard";
import { normalizeToolCategories } from "@/lib/toolCategories";

export const LOCAL_USER_ID = "local-archive";
export const MAX_INDICATORS_PER_ITEM = 5;

const mediaKey = "accumulate.media";
const websitesKey = "accumulate.websites";
const ideasKey = "accumulate.ideas";
const projectsKey = "accumulate.projects";
const pinboardsKey = "accumulate.pinboards";
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

function writeItems<T>(key: string, items: T[]) {
  window.localStorage.setItem(key, JSON.stringify(items));
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

export function readMediaItems() {
  return readItems<DisplayItem>(mediaKey).map((item) => ({
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
  emitArchiveEvent(archiveEvents.media);
}

export function deleteMediaItem(id: string) {
  writeItems(
    mediaKey,
    readMediaItems().filter((item) => item.id !== id),
  );
  emitArchiveEvent(archiveEvents.media);
}

export function findMediaItem(id: string) {
  return readMediaItems().find((item) => item.id === id) ?? null;
}

export function readWebsiteItems() {
  return readItems<WebsiteItem>(websitesKey).map((item) => ({
    ...item,
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
      domain: item.domain ?? urlDomain(item.source_url),
      categories: normalizeToolCategories(item.categories),
      indicator_ids: normalizeIndicatorIds(item),
    })),
  );
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
  emitArchiveEvent(archiveEvents.collections);
}

export function readProjects() {
  const projects = readItems<ProjectItem>(projectsKey);

  if (projects.length) return projects;

  const defaultProject: ProjectItem = {
    id: "default-project",
    user_id: LOCAL_USER_ID,
    title: "Current Project",
    created_at: new Date().toISOString(),
  };

  writeItems(projectsKey, [defaultProject]);
  return [defaultProject];
}

export function saveProjects(projects: ProjectItem[]) {
  writeItems(projectsKey, projects);
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
    ({
      id: "default-project",
      user_id: LOCAL_USER_ID,
      title: "Current Project",
      created_at: new Date().toISOString(),
    } satisfies ProjectItem);

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

  if (readActiveProjectId() === projectId) {
    saveActiveProjectId(fallbackProject.id);
  }

  emitArchiveEvent(archiveEvents.projects);
  emitArchiveEvent(archiveEvents.boardItems);
  return project;
}

export function readActiveProjectId() {
  if (typeof window === "undefined") return "default-project";

  return window.localStorage.getItem(activeProjectKey) || readProjects()[0].id;
}

export function saveActiveProjectId(projectId: string) {
  window.localStorage.setItem(activeProjectKey, projectId);
}

export function readIndicators() {
  return readItems<IndicatorItem>(indicatorsKey);
}

export function saveIndicators(indicators: IndicatorItem[]) {
  writeItems(indicatorsKey, indicators);
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
  return [defaultBoard];
}

export function savePinboards(pinboards: PinboardItem[]) {
  const allPinboards = readItems<PinboardItem>(pinboardsKey);
  const projectIds = new Set(pinboards.map((board) => board.project_id));
  writeItems(pinboardsKey, [
    ...allPinboards.filter((board) => !projectIds.has(board.project_id)),
    ...pinboards,
  ]);
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
  return nextBoards.find((board) => board.id === boardId) ?? null;
}

export function deletePinboard(boardId: string) {
  const boards = readItems<PinboardItem>(pinboardsKey);
  const board = boards.find((current) => current.id === boardId);
  if (!board) return null;

  const projectBoards = boards.filter(
    (current) => current.project_id === board.project_id,
  );
  if (projectBoards.length <= 1) return null;

  writeItems(
    pinboardsKey,
    boards
      .filter((current) => current.id !== boardId)
      .map((current) =>
        current.project_id === board.project_id && current.order > board.order
          ? { ...current, order: current.order - 1 }
          : current,
      ),
  );
  writeItems(
    boardItemsKey,
    readItems<BoardItem>(boardItemsKey).filter((item) => item.board_id !== boardId),
  );

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

  const width = sourceType === "media" ? 260 : 300;
  const item: BoardItem = {
    id: crypto.randomUUID(),
    project_id: projectId,
    board_id: boardId,
    source_type: sourceType,
    source_id: sourceId,
    x: 88 + (projectItemCount % 4) * 70,
    y: 92 + Math.floor(projectItemCount / 4) * 84,
    width,
    height: sourceType === "media" ? Math.round(width * 1.25) : 180,
    created_at: new Date().toISOString(),
  };

  writeItems(boardItemsKey, [...items, item]);
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
  emitArchiveEvent(archiveEvents.boardItems);
  return nextItems.find((item) => item.id === itemId) ?? null;
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
