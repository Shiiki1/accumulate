"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, FolderPlus, Layers, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { MinimalHeader } from "@/components/MinimalHeader";
import {
  LOCAL_USER_ID,
  archiveEvents,
  cloneProject,
  deleteProject,
  readBoardItems,
  readCollections,
  readIdeaItems,
  readPinboards,
  readProjects,
  readWebsiteItems,
  saveActiveProjectId,
  saveCollections,
  saveProjects,
} from "@/lib/localArchive";
import { gridItemReveal, pageReveal, staggerParent } from "@/lib/motion";
import type { CollectionItem, IdeaItem, ProjectItem } from "@/lib/types";

type ProjectStats = {
  media: number;
  ideas: number;
  references: number;
  resources: number;
};

function projectStats(projectId: string, ideas: IdeaItem[]): ProjectStats {
  const ideaMap = new Map(ideas.map((idea) => [idea.id, idea]));
  const items = readBoardItems(projectId);

  return items.reduce<ProjectStats>(
    (stats, item) => {
      if (item.source_type === "media") stats.media += 1;
      if (item.source_type === "website") stats.resources += 1;
      if (item.source_type === "reference") stats.references += 1;
      if (item.source_type === "idea") {
        const entry = ideaMap.get(item.source_id);
        if (entry?.entry_type === "reference") {
          stats.references += 1;
        } else {
          stats.ideas += 1;
        }
      }

      return stats;
    },
    { media: 0, ideas: 0, references: 0, resources: 0 },
  );
}

export function ProjectDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);

  function sync() {
    setProjects(readProjects());
    setIdeas(readIdeaItems());
    setCollections(readCollections());
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(sync);
    window.addEventListener(archiveEvents.projects, sync);
    window.addEventListener(archiveEvents.boardItems, sync);
    window.addEventListener(archiveEvents.ideas, sync);
    window.addEventListener(archiveEvents.collections, sync);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(archiveEvents.projects, sync);
      window.removeEventListener(archiveEvents.boardItems, sync);
      window.removeEventListener(archiveEvents.ideas, sync);
      window.removeEventListener(archiveEvents.collections, sync);
    };
  }, []);

  const projectCards = useMemo(
    () =>
      projects.map((project) => ({
        project,
        stats: projectStats(project.id, ideas),
      })),
    [ideas, projects],
  );

  function openProject(projectId: string) {
    saveActiveProjectId(projectId);
    readPinboards(projectId);
    router.push("/app/moodboard");
  }

  function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") || "").trim();
    if (!title) return;

    const project: ProjectItem = {
      id: crypto.randomUUID(),
      user_id: LOCAL_USER_ID,
      title,
      created_at: new Date().toISOString(),
    };

    saveProjects([...readProjects(), project]);
    readPinboards(project.id);
    event.currentTarget.reset();
    openProject(project.id);
  }

  function duplicateProject(projectId: string) {
    const project = cloneProject(projectId);
    if (!project) return;
    openProject(project.id);
  }

  function removeProject(projectId: string) {
    deleteProject(projectId);
    sync();
  }

  function createCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    if (!title) return;

    saveCollections([
      {
        id: crypto.randomUUID(),
        user_id: LOCAL_USER_ID,
        title,
        description,
        source_ids: [],
        created_at: new Date().toISOString(),
      },
      ...readCollections(),
    ]);

    event.currentTarget.reset();
  }

  const totalResources = readWebsiteItems().length;

  return (
    <>
      <MinimalHeader />
      <motion.main
        variants={pageReveal}
        initial="hidden"
        animate="visible"
        className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pt-14"
      >
        <section className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
              Projects
            </p>
            <h1 className="font-serif-accent mt-3 text-6xl leading-none sm:text-7xl">
              Accumulate.
            </h1>
          </div>
          <form onSubmit={createProject} className="flex max-w-md gap-2">
            <input
              name="title"
              required
              placeholder="New project"
              className="premium-focus h-11 min-w-0 flex-1 border border-[var(--line)] bg-transparent px-3 text-sm placeholder:text-[var(--muted)]"
            />
            <button
              type="submit"
              className="inline-flex h-11 shrink-0 items-center gap-2 border border-[var(--line)] px-4 text-sm text-[var(--foreground)] transition hover:border-[var(--foreground)]"
            >
              <FolderPlus size={15} />
              Create
            </button>
          </form>
        </section>

        <motion.section
          variants={staggerParent}
          initial="hidden"
          animate="visible"
          className="mt-12 grid gap-4 md:grid-cols-2"
        >
          {projectCards.map(({ project, stats }) => (
            <motion.article
              key={project.id}
              variants={gridItemReveal}
              className="group border border-[var(--line)] bg-[var(--surface-glass)] p-5 transition duration-300 hover:border-[var(--foreground)]"
            >
              <button
                type="button"
                onClick={() => openProject(project.id)}
                className="block w-full text-left"
              >
                <h2 className="font-serif-accent text-4xl leading-none">
                  {project.title}
                </h2>
                <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-[var(--muted)] sm:grid-cols-4">
                  <p>{stats.media} media</p>
                  <p>{stats.ideas} ideas</p>
                  <p>{stats.references} references</p>
                  <p>{stats.resources} resources</p>
                </div>
              </button>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openProject(project.id)}
                  className="h-9 border border-[var(--line)] px-3 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  Open Project
                </button>
                <button
                  type="button"
                  onClick={() => duplicateProject(project.id)}
                  className="inline-flex h-9 items-center gap-2 border border-[var(--line)] px-3 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  <Copy size={13} />
                  Clone
                </button>
                <button
                  type="button"
                  onClick={() => removeProject(project.id)}
                  className="inline-flex h-9 items-center gap-2 border border-transparent px-3 text-xs text-[var(--muted)] transition hover:border-[var(--line)] hover:text-[var(--foreground)]"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            </motion.article>
          ))}
        </motion.section>

        <section className="mt-16 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="border-t border-[var(--line)] pt-6">
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
              Collections
            </p>
            <div className="mt-5 grid gap-3">
              {collections.length ? (
                collections.map((collection) => (
                  <article
                    key={collection.id}
                    className="flex items-center justify-between gap-4 border border-[var(--line)] p-4"
                  >
                    <div>
                      <h3 className="text-sm font-medium">{collection.title}</h3>
                      {collection.description ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                          {collection.description}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-xs text-[var(--muted)]">
                      {collection.source_ids?.length ?? 0} items
                    </p>
                  </article>
                ))
              ) : (
                <p className="max-w-md text-sm leading-6 text-[var(--muted)]">
                  Collections are ready as reusable groups. Add names now,
                  assemble them later.
                </p>
              )}
            </div>
          </div>

          <form
            onSubmit={createCollection}
            className="border border-[var(--line)] p-5"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
              <Layers size={13} />
              New collection
            </div>
            <input
              name="title"
              required
              placeholder="Luxury Editorial References"
              className="premium-focus mt-5 h-11 w-full border border-[var(--line)] bg-transparent px-3 text-sm"
            />
            <textarea
              name="description"
              rows={3}
              placeholder="Optional note"
              className="premium-focus mt-3 w-full resize-none border border-[var(--line)] bg-transparent px-3 py-3 text-sm leading-6"
            />
            <button
              type="submit"
              className="mt-3 h-10 border border-[var(--line)] px-4 text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              Save collection
            </button>
          </form>
        </section>

        <p className="mt-10 text-xs text-[var(--muted)]">
          {totalResources} resources saved across the archive.
        </p>
      </motion.main>
    </>
  );
}
