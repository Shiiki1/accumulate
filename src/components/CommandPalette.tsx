"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "motion/react";
import {
  ImagePlus,
  Lightbulb,
  type LucideIcon,
  PanelsTopLeft,
  PlusCircle,
  Wrench,
  X,
} from "lucide-react";
import {
  type CommandAction,
  commandActions,
  dispatchCommandAction,
  queueCommandAction,
} from "@/lib/commandActions";

const actions = [
  {
    label: "Add Media",
    hint: "Capture image or URL",
    href: "/app/media",
    action: commandActions.addMedia,
    icon: ImagePlus,
  },
  {
    label: "Add Resource",
    hint: "Save website, source, or reference",
    href: "/app/tools",
    action: commandActions.addTool,
    icon: Wrench,
  },
  {
    label: "Add Idea or Reference",
    hint: "Write a note or index reference",
    href: "/app/ideas",
    action: commandActions.addIdea,
    icon: Lightbulb,
  },
  {
    label: "Create Indicator",
    hint: "Add a project marker",
    href: null,
    action: commandActions.createIndicator,
    icon: PlusCircle,
  },
  {
    label: "Switch Project",
    hint: "Open project chooser",
    href: "/app",
    action: commandActions.switchProject,
    icon: PanelsTopLeft,
  },
] satisfies {
  label: string;
  hint: string;
  href: string | null;
  action: CommandAction;
  icon: LucideIcon;
}[];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((value) => !value);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function runAction(action: CommandAction, href: string | null) {
    setIsOpen(false);

    if (!href || pathname === href) {
      window.requestAnimationFrame(() => dispatchCommandAction(action));
      return;
    }

    queueCommandAction(action);
    router.push(href);
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[80] bg-[rgb(18_14_10_/_0.18)] px-4 pt-[18vh] backdrop-blur-md"
          onMouseDown={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 8, filter: "blur(8px)" }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-lg border border-[var(--line)] bg-[var(--background)] shadow-[var(--shadow-soft)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Command label="Accumulate command palette">
              <div className="flex items-center border-b border-[var(--line)] px-3">
                <Command.Input
                  autoFocus
                  placeholder="Capture or switch..."
                  className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
                />
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="grid size-8 place-items-center text-[var(--muted)] transition hover:text-[var(--foreground)]"
                  aria-label="Close command palette"
                >
                  <X size={15} />
                </button>
              </div>
              <Command.List className="max-h-[320px] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-sm text-[var(--muted)]">
                  No matching action.
                </Command.Empty>
                <Command.Group>
                  {actions.map((item) => {
                    const Icon = item.icon;

                    return (
                      <Command.Item
                        key={item.action}
                        value={`${item.label} ${item.hint}`}
                        onSelect={() => runAction(item.action, item.href)}
                        className="flex cursor-pointer items-center gap-3 px-3 py-3 text-sm outline-none transition data-[selected=true]:bg-[var(--surface-soft)]"
                      >
                        <span className="grid size-8 place-items-center border border-[var(--line)] text-[var(--muted)]">
                          <Icon size={15} />
                        </span>
                        <span className="flex-1">
                          <span className="block text-[var(--foreground)]">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-[var(--muted)]">
                            {item.hint}
                          </span>
                        </span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
