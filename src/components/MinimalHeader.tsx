"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { IndicatorDialog } from "@/components/IndicatorDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  commandActions,
  consumeQueuedCommandAction,
} from "@/lib/commandActions";
import {
  archiveEvents,
  readActiveProjectId,
  readProjects,
} from "@/lib/localArchive";

const navItems = [
  { href: "/app", label: "Projects" },
  { href: "/app/moodboard", label: "Moodboard" },
  { href: "/app/media", label: "Media" },
  { href: "/app/tools", label: "Resources" },
  { href: "/app/ideas", label: "Ideas & References" },
  { href: "/app/3d", label: "3D" },
];

export function MinimalHeader() {
  const pathname = usePathname();
  const [isIndicatorDialogOpen, setIsIndicatorDialogOpen] = useState(false);
  const [activeProjectTitle, setActiveProjectTitle] = useState("");

  useEffect(() => {
    function openIndicatorDialog() {
      setIsIndicatorDialogOpen(true);
    }

    window.addEventListener(commandActions.createIndicator, openIndicatorDialog);
    if (consumeQueuedCommandAction(commandActions.createIndicator)) {
      openIndicatorDialog();
    }

    return () =>
      window.removeEventListener(
        commandActions.createIndicator,
        openIndicatorDialog,
      );
  }, []);

  useEffect(() => {
    function syncProjectTitle() {
      const activeId = readActiveProjectId();
      setActiveProjectTitle(
        readProjects().find((project) => project.id === activeId)?.title ?? "",
      );
    }

    const frame = window.requestAnimationFrame(syncProjectTitle);
    window.addEventListener(archiveEvents.projects, syncProjectTitle);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(archiveEvents.projects, syncProjectTitle);
    };
  }, []);

  const isWorkspaceRoute = pathname.startsWith("/app/") && pathname !== "/app";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[color-mix(in_srgb,var(--line)_72%,transparent)] bg-[var(--surface-glass)] px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/app"
            className="text-sm font-medium tracking-[0.2em] uppercase"
          >
            Accumulate
          </Link>
          {isWorkspaceRoute && activeProjectTitle ? (
            <div className="hidden min-w-0 flex-1 text-xs text-[var(--muted)] lg:block">
              <span className="uppercase tracking-[0.22em]">Project</span>
              <span className="mx-2 text-[var(--line)]">/</span>
              <span className="text-[var(--foreground)]">
                {activeProjectTitle}
              </span>
            </div>
          ) : null}
          <div className="flex items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <nav className="flex gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/app"
                    ? pathname === "/app"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`shrink-0 border px-3.5 py-2 text-xs transition duration-300 ${
                      isActive
                        ? "border-[color-mix(in_srgb,var(--foreground)_42%,var(--line))] text-[var(--foreground)]"
                        : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={() => setIsIndicatorDialogOpen(true)}
              className="archive-button ml-1 inline-flex h-9 shrink-0 items-center gap-2 px-3 text-xs"
            >
              <Plus size={14} />
              Indicator
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <IndicatorDialog
        isOpen={isIndicatorDialogOpen}
        onClose={() => setIsIndicatorDialogOpen(false)}
      />
    </>
  );
}
