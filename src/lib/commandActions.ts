"use client";

export const PENDING_COMMAND_ACTION_KEY = "accumulate.pendingCommandAction";
export const PENDING_COMMAND_DRAFT_KEY = "accumulate.pendingCommandDraft";

export const commandActions = {
  addMedia: "accumulate:add-media",
  addTool: "accumulate:add-tool",
  addIdea: "accumulate:add-idea",
  createIndicator: "accumulate:create-indicator",
  switchProject: "accumulate:switch-project",
} as const;

export type CommandAction =
  (typeof commandActions)[keyof typeof commandActions];

export function dispatchCommandAction(action: CommandAction) {
  window.dispatchEvent(new Event(action));
}

export function queueCommandAction(action: CommandAction) {
  window.sessionStorage.setItem(PENDING_COMMAND_ACTION_KEY, action);
}

export function queueCommandDraft<T>(action: CommandAction, draft: T) {
  window.sessionStorage.setItem(PENDING_COMMAND_ACTION_KEY, action);
  window.sessionStorage.setItem(
    PENDING_COMMAND_DRAFT_KEY,
    JSON.stringify({ action, draft }),
  );
}

export function consumeQueuedCommandAction(action: CommandAction) {
  if (window.sessionStorage.getItem(PENDING_COMMAND_ACTION_KEY) !== action) {
    return false;
  }

  window.sessionStorage.removeItem(PENDING_COMMAND_ACTION_KEY);
  return true;
}

export function consumeQueuedCommandDraft<T>(action: CommandAction) {
  try {
    const value = window.sessionStorage.getItem(PENDING_COMMAND_DRAFT_KEY);
    if (!value) return null;

    const parsed = JSON.parse(value) as { action?: CommandAction; draft?: T };
    if (parsed.action !== action) return null;

    window.sessionStorage.removeItem(PENDING_COMMAND_DRAFT_KEY);
    window.sessionStorage.removeItem(PENDING_COMMAND_ACTION_KEY);
    return parsed.draft ?? null;
  } catch {
    window.sessionStorage.removeItem(PENDING_COMMAND_DRAFT_KEY);
    return null;
  }
}
