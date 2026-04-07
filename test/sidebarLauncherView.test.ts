import { describe, expect, it, vi } from "vitest";

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
    resource: string;
    status: "Completed" | "In Progress" | "Failed";
    title: string;
    updatedAt: string;
  }> = []
) => ({
  list: vi.fn().mockReturnValue(sessions),
  upsert: vi.fn()
});

const createResolvedView = () => {
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
    onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
    webview
  };

  return {
    getHandler: () => onDidReceiveMessageHandler,
    view
  };
};

describe("SidebarLauncherViewProvider", () => {
  it("renders the button and saved Codex sessions list", () => {
    const globalState = createGlobalState({
      "codexLauncher.autoCloseSidebarOnSuccess": true,
      "codexLauncher.experimentalMultiTab": false
    });
    const sessionStore = createSessionStore([
      {
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        resource: "openai-codex://route/local/thread-1",
        status: "Completed",
        title: "Fix prompt handling",
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
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
    expect(view.webview.html).toContain("Completed");
    expect(view.webview.html).toContain("data-session-resource=\"openai-codex://route/local/thread-1\"");
    expect(view.webview.html).toContain("session-list-wrap");
    expect(view.webview.html).toContain("max-height: min(280px, 42vh)");
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
});
