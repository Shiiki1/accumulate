"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, FolderPlus, Layers, Pencil, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { MinimalHeader } from "@/components/MinimalHeader";
import { openQuickCapture } from "@/components/UniversalCapture";
import {
  LOCAL_USER_ID,
  archiveEvents,
  cloneProject,
  deleteProject,
  readActiveProjectId,
  readBoardItems,
  readCollections,
  readIdeaItems,
  readMediaItems,
  readPinboards,
  readProjects,
  readWebsiteItems,
  saveActiveProjectId,
  saveCollections,
  saveProjects,
} from "@/lib/localArchive";
import { gridItemReveal, pageReveal, staggerParent } from "@/lib/motion";
import type {
  CollectionItem,
  DisplayItem,
  IdeaItem,
  ProjectItem,
  WebsiteItem,
} from "@/lib/types";

type ProjectStats = {
  media: number;
  ideas: number;
  references: number;
  resources: number;
};

type RecentCapture = {
  id: string;
  label: string;
  title: string;
  detail?: string;
  created_at: string;
};

type RecentResource = {
  id: string;
  title: string;
  domain?: string;
  created_at: string;
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function projectLastUpdated(project: ProjectItem) {
  const boardDates = readBoardItems(project.id).map((item) => item.created_at);
  const latest = [project.created_at, ...boardDates]
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return latest ? formatDate(latest) : null;
}

function recentCaptures(
  media: DisplayItem[],
  websites: WebsiteItem[],
  ideas: IdeaItem[],
): RecentCapture[] {
  return [
    ...media.map((item) => ({
      id: item.id,
      label: "Media",
      title: item.title,
      detail: item.category,
      created_at: item.created_at,
    })),
    ...websites.map((item) => ({
      id: item.id,
      label: "Resource",
      title: item.name,
      detail: item.domain,
      created_at: item.created_at,
    })),
    ...ideas.map((item) => ({
      id: item.id,
      label: item.entry_type === "reference" ? "Reference" : "Idea",
      title: item.title,
      detail: item.body,
      created_at: item.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);
}

function recentlyUsedResources(projectId: string, websites: WebsiteItem[]) {
  const resourceMap = new Map(websites.map((item) => [item.id, item]));

  return readBoardItems(projectId)
    .filter((item) => item.source_type === "website")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((item) => resourceMap.get(item.source_id))
    .filter((item): item is WebsiteItem => Boolean(item))
    .map<RecentResource>((item) => ({
      id: item.id,
      title: item.name,
      domain: item.domain,
      created_at: item.created_at,
    }))
    .slice(0, 4);
}

export function ProjectDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [media, setMedia] = useState<DisplayItem[]>([]);
  const [websites, setWebsites] = useState<WebsiteItem[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState("default-project");

  function sync() {
    setProjects(readProjects());
    setIdeas(readIdeaItems());
    setMedia(readMediaItems());
    setWebsites(readWebsiteItems());
    setCollections(readCollections());
    setActiveProjectId(readActiveProjectId());
  }

  useEffect(() => {
    const timer = window.setTimeout(sync, 0);
    window.addEventListener(archiveEvents.projects, sync);
    window.addEventListener(archiveEvents.boardItems, sync);
    window.addEventListener(archiveEvents.media, sync);
    window.addEventListener(archiveEvents.websites, sync);
    window.addEventListener(archiveEvents.ideas, sync);
    window.addEventListener(archiveEvents.collections, sync);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(archiveEvents.projects, sync);
      window.removeEventListener(archiveEvents.boardItems, sync);
      window.removeEventListener(archiveEvents.media, sync);
      window.removeEventListener(archiveEvents.websites, sync);
      window.removeEventListener(archiveEvents.ideas, sync);
      window.removeEventListener(archiveEvents.collections, sync);
    };
  }, []);

  const projectCards = useMemo(
    () =>
      projects.map((project) => ({
        project,
        stats: projectStats(project.id, ideas),
        lastUpdated: projectLastUpdated(project),
      })),
    [ideas, projects],
  );

  const captures = useMemo(
    () => recentCaptures(media, websites, ideas),
    [ideas, media, websites],
  );

  const activeProject = projects.find((project) => project.id === activeProjectId);
  const recentResources = useMemo(
    () => recentlyUsedResources(activeProjectId, websites),
    [activeProjectId, websites],
  );

  function openProject(projectId: string, path = "/app/moodboard") {
    saveActiveProjectId(projectId);
    readPinboards(projectId);
    setActiveProjectId(projectId);
    router.push(path);
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

  function renameProject(event: FormEvent<HTMLFormElement>, projectId: string) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") || "").trim();
    if (!title) return;

    saveProjects(
      readProjects().map((project) =>
        project.id === projectId ? { ...project, title } : project,
      ),
    );
    setRenameId(null);
    sync();
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

  return (
    <>
      <MinimalHeader />
      <motion.main
        variants={pageReveal}
        initial="hidden"
        animate="visible"
        className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pt-14"
      >
        <section className="flex flex-col gap-10 border-b border-[var(--line)] pb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="archive-label">
              Projects
            </p>
            <h1 className="font-serif-accent mt-4 text-6xl leading-none sm:text-7xl">
              Accumulate.
            </h1>
          </div>
          <div className="grid w-full max-w-md gap-2">
            <button
              type="button"
              onClick={openQuickCapture}
              className="archive-card flex h-14 items-center justify-between px-4 text-left"
            >
              <span>
                <span className="block text-sm font-medium">Quick Capture</span>
                <span className="archive-meta mt-0.5 block">
                  Paste or save media, resources, ideas, and references.
                </span>
              </span>
              <span className="archive-meta">Open</span>
            </button>
            <form onSubmit={createProject} className="flex gap-2">
              <input
                name="title"
                required
                placeholder="New project"
                className="premium-focus archive-field h-11 min-w-0 flex-1 px-3 text-sm"
              />
              <button
                type="submit"
                className="archive-button inline-flex h-11 shrink-0 items-center gap-2 px-4 text-sm"
              >
                <FolderPlus size={15} />
                Create
              </button>
            </form>
          </div>
        </section>

        <motion.section
          variants={staggerParent}
          initial="hidden"
          animate="visible"
          className="mt-10 grid gap-4 md:grid-cols-2"
        >
          {projectCards.map(({ project, stats, lastUpdated }) => (
            <motion.article
              key={project.id}
              variants={gridItemReveal}
              className="archive-card group p-6"
            >
              <div className="flex items-start justify-between gap-4">
                {renameId === project.id ? (
                  <form
                    onSubmit={(event) => renameProject(event, project.id)}
                    className="flex min-w-0 flex-1 gap-2"
                  >
                    <input
                      name="title"
                      defaultValue={project.title}
                      className="premium-focus archive-field h-11 min-w-0 flex-1 px-3 font-serif-accent text-3xl leading-none"
                    />
                    <button
                      type="submit"
                      className="archive-button h-11 px-3 text-xs"
                    >
                      Save
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => openProject(project.id)}
                    className="block min-w-0 flex-1 text-left"
                  >
                    <h2 className="font-serif-accent text-4xl leading-none transition group-hover:opacity-85">
                      {project.title}
                    </h2>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setRenameId(project.id)}
                  className="archive-icon-button size-8 shrink-0"
                  aria-label={`Rename ${project.title}`}
                >
                  <Pencil size={14} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => openProject(project.id)}
                className="mt-8 block w-full text-left"
              >
                <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                  {[
                    ["Media", stats.media],
                    ["Ideas", stats.ideas],
                    ["References", stats.references],
                    ["Resources", stats.resources],
                  ].map(([label, value]) => (
                    <p key={label} className="space-y-1">
                      <span className="block text-lg text-[var(--foreground)]">
                        {value}
                      </span>
                      <span className="archive-meta block">{label}</span>
                    </p>
                  ))}
                </div>
                {lastUpdated ? (
                  <p className="archive-meta mt-5">
                    Last updated {lastUpdated}
                  </p>
                ) : null}
              </button>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
                <button
                  type="button"
                  onClick={() => openProject(project.id)}
                  className="archive-button h-9 px-3 text-xs"
                >
                  Open Moodboard
                </button>
                <button
                  type="button"
                  onClick={() => openProject(project.id, "/app/media")}
                  className="archive-button h-9 px-3 text-xs"
                >
                  View Media
                </button>
                <button
                  type="button"
                  onClick={() => openProject(project.id, "/app/tools")}
                  className="archive-button h-9 px-3 text-xs"
                >
                  View Resources
                </button>
                <button
                  type="button"
                  onClick={() => openProject(project.id, "/app/ideas")}
                  className="archive-button h-9 px-3 text-xs"
                >
                  View Ideas & References
                </button>
                <button
                  type="button"
                  onClick={() => duplicateProject(project.id)}
                  className="archive-button inline-flex h-9 items-center gap-2 px-3 text-xs"
                >
                  <Copy size={13} />
                  Clone
                </button>
                <button
                  type="button"
                  onClick={() => removeProject(project.id)}
                  className="archive-button inline-flex h-9 items-center gap-2 border-transparent px-3 text-xs"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            </motion.article>
          ))}
        </motion.section>

        <section className="mt-16 grid gap-8 lg:grid-cols-[1fr_0.8fr]">
          <div className="border-t border-[var(--line)] pt-6">
            <p className="archive-label">
              Continue
            </p>
            {activeProject ? (
              <button
                type="button"
                onClick={() => openProject(activeProject.id)}
                className="archive-card mt-5 flex w-full items-center justify-between gap-4 p-4 text-left"
              >
                <span>
                  <span className="block text-sm font-medium">
                    {activeProject.title}
                  </span>
                  <span className="archive-meta mt-1 block">
                    Last opened project
                  </span>
                </span>
                <span className="archive-meta">Open</span>
              </button>
            ) : null}
            {recentResources.length ? (
              <div className="mt-5">
                <p className="archive-label mb-2 text-[10px]">
                  Recently used resources
                </p>
                <div className="grid gap-2">
                  {recentResources.map((resource) => (
                    <article
                      key={resource.id}
                      className="flex items-center justify-between gap-4 border-b border-[var(--line)] py-2.5"
                    >
                      <div className="min-w-0">
                        <h3 className="truncate text-sm">{resource.title}</h3>
                        {resource.domain ? (
                          <p className="archive-meta mt-1 truncate">
                            {resource.domain}
                          </p>
                        ) : null}
                      </div>
                      <p className="archive-meta shrink-0">
                        Resource
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-5 grid gap-2">
              {captures.length ? (
                captures.map((capture) => (
                  <article
                    key={`${capture.label}-${capture.id}`}
                    className="grid grid-cols-[88px_1fr_auto] items-center gap-4 border-b border-[var(--line)] py-3.5"
                  >
                    <p className="archive-label text-[10px]">
                      {capture.label}
                    </p>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium">
                        {capture.title}
                      </h3>
                      {capture.detail ? (
                        <p className="archive-meta mt-1 line-clamp-1">
                          {capture.detail}
                        </p>
                      ) : null}
                    </div>
                    <p className="archive-meta hidden sm:block">
                      {formatDate(capture.created_at)}
                    </p>
                  </article>
                ))
              ) : (
                <p className="archive-panel max-w-md p-5 text-sm leading-6 text-[var(--muted)]">
                  Recent captures will appear here as the archive starts to take shape.
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--line)] pt-6">
            <p className="archive-label">
              Toolkit collections
            </p>
            <div className="mt-5 grid gap-3">
              {collections.length ? (
                collections.map((collection) => (
                  <article
                    key={collection.id}
                    className="archive-card flex items-center justify-between gap-4 p-4"
                  >
                    <div>
                      <h3 className="text-sm font-medium">{collection.title}</h3>
                      {collection.description ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                          {collection.description}
                        </p>
                      ) : null}
                    </div>
                    <p className="archive-meta shrink-0">
                      {collection.source_ids?.length ?? 0} items
                    </p>
                  </article>
                ))
              ) : (
                <p className="archive-panel max-w-md p-5 text-sm leading-6 text-[var(--muted)]">
                  Create reusable sets like Landing Page Toolkit, 3D Design Stack,
                  Typography Resources, or Lookbook References.
                </p>
              )}
            </div>
          </div>

          <form
            onSubmit={createCollection}
            className="archive-panel p-5"
          >
            <div className="archive-label flex items-center gap-2">
              <Layers size={13} />
              New toolkit collection
            </div>
            <input
              name="title"
              required
              placeholder="Landing Page Toolkit"
              className="premium-focus archive-field mt-5 h-11 w-full px-3 text-sm"
            />
            <textarea
              name="description"
              rows={3}
              placeholder="Optional note"
              className="premium-focus archive-field mt-3 w-full resize-none px-3 py-3 text-sm leading-6"
            />
            <button
              type="submit"
              className="archive-button mt-3 h-10 px-4 text-sm"
            >
              Save collection
            </button>
          </form>
        </section>

        <p className="mt-10 text-xs text-[var(--muted)]">
          {websites.length} resources saved across the archive.
        </p>
      </motion.main>
    </>
  );
}
