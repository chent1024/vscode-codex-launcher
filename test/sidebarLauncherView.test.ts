import { afterEach, describe, expect, it, vi } from "vitest";

import * as vscode from "vscode";

import { SidebarLauncherViewProvider } from "../src/sidebarLauncherView";

const createGlobalState = (overrides?: Record<string, boolean>) => {
  const state = { ...(overrides ?? {}) };

  return {
    get: vi.fn((key: string, defaultValue: boolean) => state[key] ?? defaultValue),
    update: vi.fn(async (key: string, value: boolean) => {
      state[key] = value;
    })
  };
};

const createSessionStore = (
  sessions: Array<{
    createdAt: string;
    openedAt: string;
    resource: string;
    status: "Completed" | "In Progress" | "Failed";
    title: string;
    updatedAt: string;
    workspaceLabel?: string;
  }> = []
) => ({
  list: vi.fn().mockReturnValue(sessions),
  remove: vi.fn().mockResolvedValue(undefined),
  upsert: vi.fn()
});

const createResolvedView = () => {
  let onDidChangeVisibilityHandler: (() => void) | undefined;
  let onDidDisposeHandler: (() => void) | undefined;
  let onDidReceiveMessageHandler: ((message: unknown) => Promise<void>) | undefined;
  const webview = {
    asWebviewUri: vi.fn((uri) => uri),
    cspSource: "vscode-webview-resource:",
    html: "",
    onDidReceiveMessage: vi.fn((handler) => {
      onDidReceiveMessageHandler = handler;
      return { dispose: vi.fn() };
    }),
    options: {}
  };
  const view = {
    onDidChangeVisibility: vi.fn((handler) => {
      onDidChangeVisibilityHandler = handler;
      return { dispose: vi.fn() };
    }),
    onDidDispose: vi.fn((handler) => {
      onDidDisposeHandler = handler;
      return { dispose: vi.fn() };
    }),
    visible: true,
    webview
  };

  return {
    fireDispose: () => onDidDisposeHandler?.(),
    fireVisibilityChange: () => onDidChangeVisibilityHandler?.(),
    getHandler: () => onDidReceiveMessageHandler,
    view
  };
};

afterEach(() => {
  vi.useRealTimers();
});

describe("SidebarLauncherViewProvider", () => {
  it("renders the button and saved Codex sessions list", () => {
    const globalState = createGlobalState({
      "codexLauncher.autoCloseSidebarOnSuccess": true,
      "codexLauncher.experimentalMultiTab": false
    });
    const sessionStore = createSessionStore([
      {
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        openedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        resource: "openai-codex://route/local/thread-1",
        status: "Completed",
        title: "Fix prompt handling",
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        workspaceLabel: "open-codex"
      }
    ]);
    const { view } = createResolvedView();
    const provider = new SidebarLauncherViewProvider(
      vscode.Uri.file("/test-extension"),
      globalState as never,
      sessionStore as never
    );

    provider.resolveWebviewView(view as never);

    expect(view.webview.html).toContain("Open New Codex");
    expect(view.webview.html).toContain("Sessions");
    expect(view.webview.html).toContain("Fix prompt handling");
    expect(view.webview.html).toContain("open-codex");
    expect(view.webview.html).toContain("data-session-resource=\"openai-codex://route/local/thread-1\"");
    expect(view.webview.html).toContain("session-list-wrap");
    expect(view.webview.html).toContain("position: fixed");
    expect(view.webview.html).toContain("flex-direction: column");
    expect(view.webview.html).toContain("sessions-panel");
    expect(view.webview.html).toContain("flex: 1 1 auto");
    expect(view.webview.html).toContain("session-delete");
    expect(view.webview.html).toContain("session-workspace");
    expect(view.webview.html).toContain("session-main");
    expect(view.webview.html).toContain("padding-top: 20px");
    expect(view.webview.html).toContain("top: 8px");
    expect(view.webview.html).toContain("font-size: 14px");
    expect(view.webview.html).toContain("justify-self: end");
    expect(view.webview.html).toContain("data-delete-session-resource=\"openai-codex://route/local/thread-1\"");
    expect(view.webview.html).not.toContain("session-status");
    expect(view.webview.html).not.toContain(">Completed<");
    expect(view.webview.html).not.toContain("session-icon");
    expect(view.webview.html).not.toContain("session-dot");
  });

  it("reopens a saved session from the list", async () => {
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(true);
    const globalState = createGlobalState({
      "codexLauncher.autoCloseSidebarOnSuccess": false
    });
    const sessionStore = createSessionStore();
    const { getHandler, view } = createResolvedView();
    const provider = new SidebarLauncherViewProvider(
      vscode.Uri.file("/test-extension"),
      globalState as never,
      sessionStore as never
    );

    provider.resolveWebviewView(view as never);

    const handler = getHandler();
    if (!handler) {
      throw new Error("Webview message handler was not registered.");
    }

    await handler({ resource: "openai-codex://route/local/thread-1", type: "resume-codex-session" });

    expect(executeCommand).toHaveBeenCalledWith("codexLauncher.resumeSavedCodexSession", {
      resource: "openai-codex://route/local/thread-1"
    });

    executeCommand.mockRestore();
  });

  it("closes the sidebar after a successful resume when auto-close is enabled", async () => {
    const executeCommand = vi
      .spyOn(vscode.commands, "executeCommand")
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(undefined);
    const globalState = createGlobalState({
      "codexLauncher.autoCloseSidebarOnSuccess": true
    });
    const sessionStore = createSessionStore();
    const { getHandler, view } = createResolvedView();
    const provider = new SidebarLauncherViewProvider(
      vscode.Uri.file("/test-extension"),
      globalState as never,
      sessionStore as never
    );

    provider.resolveWebviewView(view as never);

    const handler = getHandler();
    if (!handler) {
      throw new Error("Webview message handler was not registered.");
    }

    await handler({ resource: "openai-codex://route/local/thread-1", type: "resume-codex-session" });

    expect(executeCommand).toHaveBeenNthCalledWith(1, "codexLauncher.resumeSavedCodexSession", {
      resource: "openai-codex://route/local/thread-1"
    });
    expect(executeCommand).toHaveBeenNthCalledWith(2, "workbench.action.closeSidebar");

    executeCommand.mockRestore();
  });

  it("stores the auto-close and experimental multi-tab settings", async () => {
    const globalState = createGlobalState();
    const sessionStore = createSessionStore();
    const { getHandler, view } = createResolvedView();
    const provider = new SidebarLauncherViewProvider(
      vscode.Uri.file("/test-extension"),
      globalState as never,
      sessionStore as never
    );

    provider.resolveWebviewView(view as never);

    const handler = getHandler();
    if (!handler) {
      throw new Error("Webview message handler was not registered.");
    }

    await handler({ enabled: false, type: "set-auto-close" });
    await handler({ enabled: true, type: "set-experimental-multi-tab" });

    expect(globalState.update).toHaveBeenCalledWith("codexLauncher.autoCloseSidebarOnSuccess", false);
    expect(globalState.update).toHaveBeenCalledWith("codexLauncher.experimentalMultiTab", true);
  });

  it("deletes a saved session from the list", async () => {
    const globalState = createGlobalState();
    const sessionStore = createSessionStore();
    const { getHandler, view } = createResolvedView();
    const provider = new SidebarLauncherViewProvider(
      vscode.Uri.file("/test-extension"),
      globalState as never,
      sessionStore as never
    );

    provider.resolveWebviewView(view as never);

    const handler = getHandler();
    if (!handler) {
      throw new Error("Webview message handler was not registered.");
    }

    await handler({ resource: "openai-codex://route/local/thread-1", type: "delete-codex-session" });

    expect(sessionStore.remove).toHaveBeenCalledWith("openai-codex://route/local/thread-1");
  });

  it("refreshes the session list when another window updates the shared history", async () => {
    vi.useFakeTimers();

    const globalState = createGlobalState({
      "codexLauncher.autoCloseSidebarOnSuccess": true,
      "codexLauncher.experimentalMultiTab": false
    });
    const initialSession = {
      createdAt: "2026-04-07T00:00:00.000Z",
      openedAt: "2026-04-07T00:00:00.000Z",
      resource: "openai-codex://route/local/thread-1",
      status: "Completed" as const,
      title: "First session",
      updatedAt: "2026-04-07T00:00:00.000Z"
    };
    const updatedSession = {
      createdAt: "2026-04-07T00:05:00.000Z",
      openedAt: "2026-04-07T00:05:00.000Z",
      resource: "openai-codex://route/local/thread-2",
      status: "Completed" as const,
      title: "Second session",
      updatedAt: "2026-04-07T00:05:00.000Z"
    };
    let sessions = [initialSession];
    const sessionStore = {
      list: vi.fn(() => sessions),
      upsert: vi.fn()
    };
    const { fireDispose, view } = createResolvedView();
    const provider = new SidebarLauncherViewProvider(
      vscode.Uri.file("/test-extension"),
      globalState as never,
      sessionStore as never
    );

    provider.resolveWebviewView(view as never);
    expect(view.webview.html).toContain("First session");
    expect(view.webview.html).not.toContain("Second session");

    sessions = [updatedSession, initialSession];
    await vi.advanceTimersByTimeAsync(1600);

    expect(view.webview.html).toContain("Second session");

    fireDispose();
  });
});
