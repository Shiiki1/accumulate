import type {
  RelationshipItem,
  RelationshipSummary,
} from "@/lib/relationships";

type RelatedKey = "media" | "resources" | "ideas" | "references";

type RelationshipMemoryProps = {
  relationships: RelationshipSummary;
  related?: RelatedKey[];
  compact?: boolean;
};

function previewList(items: { title: string }[], empty: string) {
  if (!items.length) return empty;

  const visible = items.slice(0, 3).map((item) => item.title).join(", ");
  const hiddenCount = items.length - 3;
  return hiddenCount > 0 ? `${visible} +${hiddenCount}` : visible;
}

function RelatedRow({
  label,
  items,
}: {
  label: string;
  items: RelationshipItem[];
}) {
  if (!items.length) return null;

  return (
    <p>
      {label}: {previewList(items, "")}
    </p>
  );
}

export function RelationshipMemory({
  relationships,
  related = ["references", "media", "ideas", "resources"],
  compact = false,
}: RelationshipMemoryProps) {
  const hasRelationships =
    relationships.usedProjects.length ||
    relationships.moodboardPlacements.length ||
    relationships.relatedMedia.length ||
    relationships.relatedResources.length ||
    relationships.relatedIdeas.length ||
    relationships.relatedReferences.length;

  if (!hasRelationships) {
    return (
      <div className="archive-panel px-3 py-3 text-sm leading-6 text-[var(--muted)]">
        <p className="archive-label">Memory</p>
        <p className="mt-2">Not used in a project yet.</p>
      </div>
    );
  }

  return (
    <div
      className={`archive-panel px-3 py-3 text-sm leading-6 text-[var(--muted)] ${
        compact ? "space-y-1" : "space-y-2"
      }`}
    >
      <p className="archive-label">Memory</p>
      <p>
        Used in projects:{" "}
        {previewList(relationships.usedProjects, "Not used in a project yet.")}
      </p>
      <p>
        Added to moodboards:{" "}
        {previewList(
          relationships.moodboardPlacements.map((placement) => ({
            title: `${placement.boardTitle} / ${placement.projectTitle}`,
          })),
          "Not added yet.",
        )}
      </p>
      {related.includes("references") ? (
        <RelatedRow
          label="Related references"
          items={relationships.relatedReferences}
        />
      ) : null}
      {related.includes("media") ? (
        <RelatedRow label="Related media" items={relationships.relatedMedia} />
      ) : null}
      {related.includes("ideas") ? (
        <RelatedRow label="Related ideas" items={relationships.relatedIdeas} />
      ) : null}
      {related.includes("resources") ? (
        <RelatedRow
          label="Related resources"
          items={relationships.relatedResources}
        />
      ) : null}
    </div>
  );
}
