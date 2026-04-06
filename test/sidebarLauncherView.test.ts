import { describe, expect, it, vi } from "vitest";

import * as vscode from "vscode";

import { SidebarLauncherViewProvider } from "../src/sidebarLauncherView";

describe("SidebarLauncherViewProvider", () => {
  it("closes the sidebar after the launcher button successfully opens Codex", async () => {
    const executeCommand = vi
      .spyOn(vscode.commands, "executeCommand")
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(undefined);
    const globalState = {
      get: vi.fn((key: string, defaultValue: boolean) =>
        key === "codexLauncher.autoCloseSidebarOnSuccess" ? true : defaultValue
      ),
      update: vi.fn().mockResolvedValue(undefined)
    };
    let onDidReceiveMessageHandler: ((message: unknown) => Promise<void>) | undefined;

    const provider = new SidebarLauncherViewProvider(vscode.Uri.file("/test-extension"), globalState as never);

    provider.resolveWebviewView({
      webview: {
        asWebviewUri: vi.fn(uri => uri),
        cspSource: "vscode-webview-resource:",
        html: "",
        onDidReceiveMessage: vi.fn(handler => {
          onDidReceiveMessageHandler = handler;
          return { dispose: vi.fn() };
        }),
        options: {}
      }
    } as never);

    if (!onDidReceiveMessageHandler) {
      throw new Error("Webview message handler was not registered.");
    }

    await onDidReceiveMessageHandler({ type: "open-codex" });

    expect(executeCommand).toHaveBeenNthCalledWith(1, "codexLauncher.openNewCodexChat");
    expect(executeCommand).toHaveBeenNthCalledWith(2, "workbench.action.closeSidebar");

    executeCommand.mockRestore();
  });

  it("keeps the sidebar open when opening Codex fails or is cancelled", async () => {
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(false);
    const globalState = {
      get: vi.fn((key: string, defaultValue: boolean) =>
        key === "codexLauncher.autoCloseSidebarOnSuccess" ? true : defaultValue
      ),
      update: vi.fn().mockResolvedValue(undefined)
    };
    let onDidReceiveMessageHandler: ((message: unknown) => Promise<void>) | undefined;

    const provider = new SidebarLauncherViewProvider(vscode.Uri.file("/test-extension"), globalState as never);

    provider.resolveWebviewView({
      webview: {
        asWebviewUri: vi.fn(uri => uri),
        cspSource: "vscode-webview-resource:",
        html: "",
        onDidReceiveMessage: vi.fn(handler => {
          onDidReceiveMessageHandler = handler;
          return { dispose: vi.fn() };
        }),
        options: {}
      }
    } as never);

    if (!onDidReceiveMessageHandler) {
      throw new Error("Webview message handler was not registered.");
    }

    await onDidReceiveMessageHandler({ type: "open-codex" });

    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith("codexLauncher.openNewCodexChat");

    executeCommand.mockRestore();
  });

  it("stores the auto-close setting and keeps the sidebar open when unchecked", async () => {
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(true);
    const globalState = {
      get: vi.fn((key: string, defaultValue: boolean) =>
        key === "codexLauncher.autoCloseSidebarOnSuccess" ? true : defaultValue
      ),
      update: vi.fn().mockResolvedValue(undefined)
    };
    let onDidReceiveMessageHandler: ((message: unknown) => Promise<void>) | undefined;

    const provider = new SidebarLauncherViewProvider(vscode.Uri.file("/test-extension"), globalState as never);

    provider.resolveWebviewView({
      webview: {
        asWebviewUri: vi.fn(uri => uri),
        cspSource: "vscode-webview-resource:",
        html: "",
        onDidReceiveMessage: vi.fn(handler => {
          onDidReceiveMessageHandler = handler;
          return { dispose: vi.fn() };
        }),
        options: {}
      }
    } as never);

    if (!onDidReceiveMessageHandler) {
      throw new Error("Webview message handler was not registered.");
    }

    await onDidReceiveMessageHandler({ type: "set-auto-close", enabled: false });
    await onDidReceiveMessageHandler({ type: "open-codex" });

    expect(globalState.update).toHaveBeenCalledWith("codexLauncher.autoCloseSidebarOnSuccess", false);
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith("codexLauncher.openNewCodexChat");

    executeCommand.mockRestore();
  });

  it("stores the experimental multi-tab setting", async () => {
    const executeCommand = vi.spyOn(vscode.commands, "executeCommand").mockResolvedValue(true);
    const globalState = {
      get: vi.fn((key: string, defaultValue: boolean) =>
        key === "codexLauncher.autoCloseSidebarOnSuccess" ? true : defaultValue
      ),
      update: vi.fn().mockResolvedValue(undefined)
    };
    let onDidReceiveMessageHandler: ((message: unknown) => Promise<void>) | undefined;

    const provider = new SidebarLauncherViewProvider(vscode.Uri.file("/test-extension"), globalState as never);

    provider.resolveWebviewView({
      webview: {
        asWebviewUri: vi.fn(uri => uri),
        cspSource: "vscode-webview-resource:",
        html: "",
        onDidReceiveMessage: vi.fn(handler => {
          onDidReceiveMessageHandler = handler;
          return { dispose: vi.fn() };
        }),
        options: {}
      }
    } as never);

    if (!onDidReceiveMessageHandler) {
      throw new Error("Webview message handler was not registered.");
    }

    await onDidReceiveMessageHandler({ type: "set-experimental-multi-tab", enabled: true });

    expect(globalState.update).toHaveBeenCalledWith("codexLauncher.experimentalMultiTab", true);

    executeCommand.mockRestore();
  });
});
