import type * as vscode from "vscode";

export interface LaunchHistoryEntry {
  id: string;
  openedAt: string;
}

export interface LaunchHistoryStore {
  addLaunch(): Promise<LaunchHistoryEntry>;
  clear(): Promise<void>;
  list(): LaunchHistoryEntry[];
}

const HISTORY_KEY = "codexLauncher.launchHistory";
const MAX_HISTORY_ENTRIES = 12;

export class GlobalStateLaunchHistoryStore implements LaunchHistoryStore {
  private readonly globalState: vscode.Memento;

  public constructor(globalState: vscode.Memento) {
    this.globalState = globalState;
  }

  public list(): LaunchHistoryEntry[] {
    return sanitizeEntries(this.globalState.get<LaunchHistoryEntry[]>(HISTORY_KEY, []));
  }

  public async addLaunch(): Promise<LaunchHistoryEntry> {
    const nextEntry: LaunchHistoryEntry = {
      id: createHistoryId(),
      openedAt: new Date().toISOString()
    };
    const nextEntries = [nextEntry, ...this.list()].slice(0, MAX_HISTORY_ENTRIES);
    await this.globalState.update(HISTORY_KEY, nextEntries);
    return nextEntry;
  }

  public async clear(): Promise<void> {
    await this.globalState.update(HISTORY_KEY, []);
  }
}

const sanitizeEntries = (entries: LaunchHistoryEntry[]): LaunchHistoryEntry[] =>
  entries.filter((entry) => typeof entry.id === "string" && typeof entry.openedAt === "string");

const createHistoryId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
