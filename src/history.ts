import type * as vscode from "vscode";

import { CODEX_CUSTOM_EDITOR_VIEW_TYPE, CODEX_URI_AUTHORITY, CODEX_URI_SCHEME } from "./types";

export type SavedCodexSessionStatus = "Completed" | "In Progress" | "Failed";

export interface SavedCodexSession {
  createdAt: string;
  openedAt: string;
  resource: string;
  status: SavedCodexSessionStatus;
  title: string;
  updatedAt: string;
  workspaceLabel?: string;
}

export interface SavedCodexSessionSnapshot {
  createdAt?: string;
  openedAt?: string;
  resource: string;
  status?: SavedCodexSessionStatus;
  title?: string;
  updatedAt?: string;
  workspaceLabel?: string;
}

export interface SavedCodexSessionStore {
  list(): SavedCodexSession[];
  remove(resource: string): Promise<void>;
  upsert(snapshot: SavedCodexSessionSnapshot): Promise<SavedCodexSession>;
}

const HISTORY_KEY = "codexLauncher.savedSessions";
const MAX_SESSION_COUNT = 50;
const DEFAULT_TITLE = "Codex Session";
const DEFAULT_STATUS: SavedCodexSessionStatus = "Completed";

export class GlobalStateSavedCodexSessionStore implements SavedCodexSessionStore {
  public constructor(private readonly globalState: vscode.Memento) {}

  public list(): SavedCodexSession[] {
    return sanitizeSessions(this.globalState.get<SavedCodexSession[]>(HISTORY_KEY, []));
  }

  public async remove(resource: string): Promise<void> {
    const normalizedResource = normalizeResource(resource);
    const nextSessions = this.list().filter((session) => session.resource !== normalizedResource);
    await this.globalState.update(HISTORY_KEY, nextSessions);
  }

  public async upsert(snapshot: SavedCodexSessionSnapshot): Promise<SavedCodexSession> {
    const resource = normalizeResource(snapshot.resource);
    const createdAt = normalizeDate(snapshot.createdAt);
    const openedAt = normalizeDate(snapshot.openedAt);
    const updatedAt = normalizeDate(snapshot.updatedAt);
    const status = normalizeStatus(snapshot.status);
    const title = normalizeTitle(snapshot.title);
    const workspaceLabel = normalizeWorkspaceLabel(snapshot.workspaceLabel);
    const now = new Date().toISOString();
    const previousSessions = this.list();
    const existingSession = previousSessions.find((session) => session.resource === resource);
    const nextSession: SavedCodexSession = existingSession
      ? {
          ...existingSession,
          createdAt: createdAt ?? existingSession.createdAt,
          openedAt: openedAt ?? existingSession.openedAt,
          status,
          title,
          updatedAt: updatedAt ?? now,
          workspaceLabel: workspaceLabel ?? existingSession.workspaceLabel
        }
      : {
          createdAt: createdAt ?? now,
          openedAt: openedAt ?? updatedAt ?? createdAt ?? now,
          resource,
          status,
          title,
          updatedAt: updatedAt ?? createdAt ?? now,
          workspaceLabel
        };

    const remainingSessions = previousSessions.filter((session) => session.resource !== resource);
    const nextSessions = [nextSession, ...remainingSessions].slice(0, MAX_SESSION_COUNT);
    await this.globalState.update(HISTORY_KEY, nextSessions);
    return nextSession;
  }
}

export const createSavedCodexSessionSnapshotFromTab = (
  tab: vscode.Tab,
  options: { openedAt?: string; workspaceLabel?: string } = {}
): SavedCodexSessionSnapshot | null => {
  const input = tab.input;
  if (!isCodexCustomEditorInput(input)) {
    return null;
  }

  if (!isCodexSessionUri(input.uri)) {
    return null;
  }

  return {
    openedAt: options.openedAt,
    resource: input.uri.toString(),
    title: tab.label,
    workspaceLabel: options.workspaceLabel
  };
};

export const isCodexSessionResource = (resource: string): boolean => {
  try {
    const uri = new URL(resource);
    if (uri.protocol !== `${CODEX_URI_SCHEME}:`) {
      return false;
    }

    if (uri.hostname !== CODEX_URI_AUTHORITY) {
      return false;
    }

    const [scope, id] = uri.pathname.split("/").filter(Boolean);
    return (scope === "local" || scope === "remote") && typeof id === "string" && id.length > 0;
  } catch {
    return false;
  }
};

const isCodexCustomEditorInput = (
  input: vscode.Tab["input"]
): input is { uri: vscode.Uri; viewType: string } =>
  typeof input === "object" &&
  input !== null &&
  "uri" in input &&
  "viewType" in input &&
  typeof input.viewType === "string" &&
  input.viewType === CODEX_CUSTOM_EDITOR_VIEW_TYPE;

const isCodexSessionUri = (uri: vscode.Uri): boolean => isCodexSessionResource(uri.toString());

const sanitizeSessions = (sessions: SavedCodexSession[]): SavedCodexSession[] =>
  sessions
    .filter(
      (session) =>
        typeof session?.createdAt === "string" &&
        typeof session?.updatedAt === "string" &&
        typeof session?.resource === "string" &&
        isCodexSessionResource(session.resource)
    )
    .map((session) => {
      const createdAt = normalizeDate(session.createdAt) ?? new Date(0).toISOString();
      const updatedAt = normalizeDate(session.updatedAt) ?? createdAt;
      const openedAt =
        normalizeDate("openedAt" in session ? session.openedAt : undefined) ??
        updatedAt ??
        createdAt;

      return {
        createdAt,
        openedAt,
        resource: normalizeResource(session.resource),
        status: normalizeStatus(session.status),
        title: normalizeTitle(session.title),
        updatedAt,
        workspaceLabel: normalizeWorkspaceLabel("workspaceLabel" in session ? session.workspaceLabel : undefined)
      };
    })
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

const normalizeResource = (resource: string): string => resource.trim();

const normalizeDate = (value?: string): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return Number.isFinite(Date.parse(trimmed)) ? trimmed : undefined;
};

const normalizeStatus = (status?: string): SavedCodexSessionStatus => {
  switch (status) {
    case "Completed":
    case "In Progress":
    case "Failed":
      return status;
    default:
      return DEFAULT_STATUS;
  }
};

const normalizeTitle = (title?: string): string => {
  const normalized = stripCorruptedTitleSuffix(title?.replace(/\s+/g, " ").trim() ?? "");
  return normalized.length > 0 ? normalized : DEFAULT_TITLE;
};

const normalizeWorkspaceLabel = (workspaceLabel?: string): string | undefined => {
  if (typeof workspaceLabel !== "string") {
    return undefined;
  }

  const normalized = workspaceLabel.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
};

const stripCorruptedTitleSuffix = (title: string): string => {
  const trailingNoise = title.match(/[\[\]{}'",:]+$/);
  if (!trailingNoise || trailingNoise[0].length < 4) {
    return title;
  }

  return title.slice(0, -trailingNoise[0].length).trimEnd();
};
