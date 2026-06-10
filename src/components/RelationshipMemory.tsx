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
    <div className="border-t border-[var(--line)] pt-2">
      <p className="archive-label text-[10px]">{label}</p>
      <p className="mt-1">{previewList(items, "")}</p>
    </div>
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
        <p className="mt-2">Not placed in a project yet.</p>
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
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="archive-label text-[10px]">Used In</p>
          <p className="mt-1">
            {previewList(relationships.usedProjects, "Not used in a project yet.")}
          </p>
        </div>
        <div>
          <p className="archive-label text-[10px]">Appears On</p>
          <p className="mt-1">
            {previewList(
              relationships.moodboardPlacements.map((placement) => ({
                title: `${placement.boardTitle} / ${placement.projectTitle}`,
              })),
              "Not added to a moodboard yet.",
            )}
          </p>
        </div>
      </div>
      {related.includes("references") ? (
        <RelatedRow
          label="Related References"
          items={relationships.relatedReferences}
        />
      ) : null}
      {related.includes("media") ? (
        <RelatedRow label="Appears With Media" items={relationships.relatedMedia} />
      ) : null}
      {related.includes("ideas") ? (
        <RelatedRow label="Related Ideas" items={relationships.relatedIdeas} />
      ) : null}
      {related.includes("resources") ? (
        <RelatedRow
          label="Related Resources"
          items={relationships.relatedResources}
        />
      ) : null}
    </div>
  );
}
