import {
  readAllPinboards,
  readBoardItems,
  readIdeaItems,
  readMediaItems,
  readProjects,
  readWebsiteItems,
} from "@/lib/localArchive";
import type {
  BoardItem,
  BoardSourceType,
  DisplayItem,
  IdeaItem,
  PinboardItem,
  ProjectItem,
  WebsiteItem,
} from "@/lib/types";

export type RelationshipSourceType = Extract<
  BoardSourceType,
  "media" | "website" | "idea" | "reference"
>;

export type RelationshipKind = "media" | "resource" | "idea" | "reference";

export type RelationshipItem = {
  key: string;
  id: string;
  sourceType: RelationshipSourceType;
  kind: RelationshipKind;
  title: string;
  projectTitle?: string;
  boardTitle?: string;
};

export type RelationshipPlacement = {
  id: string;
  projectId: string;
  projectTitle: string;
  boardId: string;
  boardTitle: string;
};

export type RelationshipProject = {
  id: string;
  title: string;
};

export type RelationshipSummary = {
  usedProjects: RelationshipProject[];
  moodboardPlacements: RelationshipPlacement[];
  relatedMedia: RelationshipItem[];
  relatedResources: RelationshipItem[];
  relatedIdeas: RelationshipItem[];
  relatedReferences: RelationshipItem[];
};

type RelationshipSnapshot = {
  projects: ProjectItem[];
  boards: PinboardItem[];
  boardItems: BoardItem[];
  mediaItems: DisplayItem[];
  websiteItems: WebsiteItem[];
  ideaItems: IdeaItem[];
};

type SourceDescriptor = {
  kind: RelationshipKind;
  title: string;
};

function sourceKey(sourceType: RelationshipSourceType, sourceId: string) {
  return `${sourceType}:${sourceId}`;
}

function isRelationshipSourceType(
  sourceType: BoardSourceType,
): sourceType is RelationshipSourceType {
  return (
    sourceType === "media" ||
    sourceType === "website" ||
    sourceType === "idea" ||
    sourceType === "reference"
  );
}

function projectTitle(projects: ProjectItem[], projectId: string) {
  return (
    projects.find((project) => project.id === projectId)?.title ??
    "Untitled project"
  );
}

function boardTitle(boards: PinboardItem[], boardId: string) {
  return boards.find((board) => board.id === boardId)?.title ?? "Moodboard";
}

function describeSource(
  item: Pick<BoardItem, "source_type" | "source_id" | "content" | "reference_title">,
  snapshot: RelationshipSnapshot,
): SourceDescriptor | null {
  if (item.source_type === "media") {
    const source = snapshot.mediaItems.find((media) => media.id === item.source_id);
    return source ? { kind: "media", title: source.title } : null;
  }

  if (item.source_type === "website") {
    const source = snapshot.websiteItems.find(
      (website) => website.id === item.source_id,
    );
    return source ? { kind: "resource", title: source.name } : null;
  }

  if (item.source_type === "idea") {
    const source = snapshot.ideaItems.find((idea) => idea.id === item.source_id);
    if (!source) return null;

    return {
      kind: (source.entry_type ?? "idea") === "reference" ? "reference" : "idea",
      title: source.title,
    };
  }

  if (item.source_type === "reference") {
    return {
      kind: "reference",
      title: item.reference_title ?? item.content ?? "Reference",
    };
  }

  return null;
}

function toRelationshipItem(
  item: BoardItem,
  snapshot: RelationshipSnapshot,
): RelationshipItem | null {
  if (
    item.source_type !== "media" &&
    item.source_type !== "website" &&
    item.source_type !== "idea" &&
    item.source_type !== "reference"
  ) {
    return null;
  }

  const descriptor = describeSource(item, snapshot);
  if (!descriptor) return null;

  return {
    key: sourceKey(item.source_type, item.source_id),
    id: item.source_id,
    sourceType: item.source_type,
    kind: descriptor.kind,
    title: descriptor.title,
    projectTitle: projectTitle(snapshot.projects, item.project_id),
    boardTitle: boardTitle(snapshot.boards, item.board_id),
  };
}

function uniqueByKey<T extends { key: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function uniqueProjects(projects: RelationshipProject[]) {
  const seen = new Set<string>();
  return projects.filter((project) => {
    if (seen.has(project.id)) return false;
    seen.add(project.id);
    return true;
  });
}

function createSnapshot(snapshot?: Partial<RelationshipSnapshot>): RelationshipSnapshot {
  return {
    projects: snapshot?.projects ?? readProjects(),
    boards: snapshot?.boards ?? readAllPinboards(),
    boardItems: snapshot?.boardItems ?? readBoardItems(),
    mediaItems: snapshot?.mediaItems ?? readMediaItems(),
    websiteItems: snapshot?.websiteItems ?? readWebsiteItems(),
    ideaItems: snapshot?.ideaItems ?? readIdeaItems(),
  };
}

export function getSourceRelationships(
  sourceType: RelationshipSourceType,
  sourceId: string,
  partialSnapshot?: Partial<RelationshipSnapshot>,
): RelationshipSummary {
  const snapshot = createSnapshot(partialSnapshot);
  const key = sourceKey(sourceType, sourceId);
  const placements = snapshot.boardItems.filter(
    (item) => item.source_type === sourceType && item.source_id === sourceId,
  );
  const placementBoardIds = new Set(placements.map((item) => item.board_id));
  const placementProjectIds = new Set(placements.map((item) => item.project_id));

  const moodboardPlacements = placements.map((item) => ({
    id: item.id,
    projectId: item.project_id,
    projectTitle: projectTitle(snapshot.projects, item.project_id),
    boardId: item.board_id,
    boardTitle: boardTitle(snapshot.boards, item.board_id),
  }));

  const usedProjects = uniqueProjects(
    moodboardPlacements.map((placement) => ({
      id: placement.projectId,
      title: placement.projectTitle,
    })),
  );

  const relatedBoardItems = snapshot.boardItems.filter((item) => {
    if (!isRelationshipSourceType(item.source_type)) return false;

    if (sourceKey(item.source_type, item.source_id) === key) {
      return false;
    }

    return (
      placementBoardIds.has(item.board_id) ||
      placementProjectIds.has(item.project_id)
    );
  });

  const related = uniqueByKey(
    relatedBoardItems
      .map((item) => toRelationshipItem(item, snapshot))
      .filter((item): item is RelationshipItem => Boolean(item)),
  );

  return {
    usedProjects,
    moodboardPlacements,
    relatedMedia: related.filter((item) => item.kind === "media"),
    relatedResources: related.filter((item) => item.kind === "resource"),
    relatedIdeas: related.filter((item) => item.kind === "idea"),
    relatedReferences: related.filter((item) => item.kind === "reference"),
  };
}

export function relationshipStatsLine(
  relationships: RelationshipSummary,
  options?: {
    includeRelatedReferences?: boolean;
    includeRelatedMedia?: boolean;
    includeRelatedIdeas?: boolean;
  },
) {
  const parts = [
    relationships.usedProjects.length
      ? `${relationships.usedProjects.length} project${
          relationships.usedProjects.length === 1 ? "" : "s"
        }`
      : null,
    relationships.moodboardPlacements.length
      ? `${relationships.moodboardPlacements.length} moodboard${
          relationships.moodboardPlacements.length === 1 ? "" : "s"
        }`
      : null,
    options?.includeRelatedReferences && relationships.relatedReferences.length
      ? `${relationships.relatedReferences.length} related reference${
          relationships.relatedReferences.length === 1 ? "" : "s"
        }`
      : null,
    options?.includeRelatedMedia && relationships.relatedMedia.length
      ? `${relationships.relatedMedia.length} related media`
      : null,
    options?.includeRelatedIdeas && relationships.relatedIdeas.length
      ? `${relationships.relatedIdeas.length} related idea${
          relationships.relatedIdeas.length === 1 ? "" : "s"
        }`
      : null,
  ].filter(Boolean);

  return parts.join(" / ");
}
