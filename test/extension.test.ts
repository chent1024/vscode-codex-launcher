import { describe, expect, it, vi } from "vitest";

import * as vscodeModule from "vscode";

import { activate, deactivate, registerExtension } from "../src/extension";
import type { Logger } from "../src/logger";
import { CodexSidebarActionProvider } from "../src/sidebarActionView";

const createLogger = (): Logger => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn()
});

const createContext = () => ({
  globalState: {
    get: vi.fn().mockReturnValue([]),
    update: vi.fn().mockResolvedValue(undefined)
  },
  subscriptions: [] as { dispose: () => void }[]
});

const createOutputChannel = () => ({
  appendLine: vi.fn(),
  dispose: vi.fn(),
  show: vi.fn()
});

const createSidebarProvider = () => new CodexSidebarActionProvider();

describe("registerExtension", () => {
  it("registers only the open-chat command and a single tree view", () => {
    const registeredCommands: string[] = [];
    const vscodeApi = {
      commands: {
        registerCommand: vi.fn((commandId: string, callback: () => Promise<void>) => {
          registeredCommands.push(commandId);
          return {
            callback,
            dispose: vi.fn()
          };
        })
      },
      version: "1.99.0",
      window: {
        createTreeView: vi.fn(() => ({
          dispose: vi.fn(),
          visible: false
        })),
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn()
      }
    };
    const context = createContext();

    const disposables = registerExtension(context as never, {
      logger: createLogger(),
      outputChannel: createOutputChannel() as never,
      sidebarViewProvider: createSidebarProvider(),
      vscodeApi: vscodeApi as never
    });

    expect(disposables).toHaveLength(1);
    expect(registeredCommands).toEqual(["codexLauncher.openNewCodexChat"]);
    expect(vscodeApi.window.createTreeView).toHaveBeenCalledTimes(1);
    expect(context.subscriptions).toHaveLength(1);
  });

  it("shows an error and output channel when opening a chat fails", async () => {
    const callbacks = new Map<string, () => Promise<void>>();
    const outputChannel = createOutputChannel();
    const vscodeApi = {
      commands: {
        executeCommand: vi.fn().mockRejectedValue(new Error("launch failed")),
        getCommands: vi.fn().mockResolvedValue(["chatgpt.newCodexPanel"]),
        registerCommand: vi.fn((commandId: string, callback: () => Promise<void>) => {
          callbacks.set(commandId, callback);
          return {
            dispose: vi.fn()
          };
        })
      },
      extensions: {
        getExtension: vi.fn().mockReturnValue({
          activate: vi.fn().mockResolvedValue(undefined),
          packageJSON: {
            version: "0.4.76"
          }
        })
      },
      version: "1.99.0",
      window: {
        createTreeView: vi.fn(() => ({
          dispose: vi.fn(),
          onDidChangeVisibility: vi.fn(() => ({ dispose: vi.fn() })),
          visible: false
        })),
        showErrorMessage: vi.fn().mockResolvedValue(undefined),
        showInformationMessage: vi.fn().mockResolvedValue(undefined)
      }
    };

    registerExtension(createContext() as never, {
      logger: createLogger(),
      outputChannel: outputChannel as never,
      sidebarViewProvider: createSidebarProvider(),
      vscodeApi: vscodeApi as never
    });

    const openCommand = callbacks.get("codexLauncher.openNewCodexChat");
    if (!openCommand) {
      throw new Error("Open command was not registered.");
    }

    await openCommand();

    expect(outputChannel.show).toHaveBeenCalledWith(true);
    expect(vscodeApi.window.showErrorMessage).toHaveBeenCalledTimes(1);
  });

  it("opens a new Codex chat when the single sidebar action command runs", async () => {
    const callbacks = new Map<string, () => Promise<void>>();
    const vscodeApi = {
      commands: {
        executeCommand: vi.fn().mockResolvedValue(undefined),
        getCommands: vi.fn().mockResolvedValue(["chatgpt.newCodexPanel"]),
        registerCommand: vi.fn((commandId: string, callback: () => Promise<void>) => {
          callbacks.set(commandId, callback);
          return {
            dispose: vi.fn()
          };
        })
      },
      extensions: {
        getExtension: vi.fn().mockReturnValue({
          activate: vi.fn().mockResolvedValue(undefined),
          packageJSON: {
            version: "0.4.76"
          }
        })
      },
      version: "1.99.0",
      window: {
        createTreeView: vi.fn(() => ({
          dispose: vi.fn(),
          onDidChangeVisibility: vi.fn(() => ({ dispose: vi.fn() })),
          visible: false
        })),
        showErrorMessage: vi.fn().mockResolvedValue(undefined),
        showInformationMessage: vi.fn().mockResolvedValue(undefined)
      }
    };

    registerExtension(createContext() as never, {
      logger: createLogger(),
      outputChannel: createOutputChannel() as never,
      sidebarViewProvider: createSidebarProvider(),
      vscodeApi: vscodeApi as never
    });

    const openCommand = callbacks.get("codexLauncher.openNewCodexChat");
    if (!openCommand) {
      throw new Error("Open command was not registered.");
    }

    await openCommand();

    expect(vscodeApi.commands.executeCommand).toHaveBeenCalledWith("chatgpt.newCodexPanel");
    expect(vscodeApi.window.showErrorMessage).not.toHaveBeenCalled();
  });

});

describe("activate", () => {
  it("creates the output channel and subscriptions", () => {
    const outputChannel = createOutputChannel();
    const createOutputChannelSpy = vi
      .spyOn(vscodeModule.window, "createOutputChannel")
      .mockReturnValue(outputChannel as never);
    const registerCommandSpy = vi
      .spyOn(vscodeModule.commands, "registerCommand")
      .mockImplementation(() => ({ dispose: vi.fn() }) as never);
    const createTreeViewSpy = vi.spyOn(vscodeModule.window, "createTreeView").mockReturnValue({
      dispose: vi.fn(),
      visible: false
    } as never);
    const context = createContext();

    activate(context as never);
    deactivate();

    expect(createOutputChannelSpy).toHaveBeenCalledWith("Codex Launcher");
    expect(registerCommandSpy).toHaveBeenCalledTimes(1);
    expect(createTreeViewSpy).toHaveBeenCalledTimes(1);
    expect(context.subscriptions.length).toBeGreaterThanOrEqual(3);

    createOutputChannelSpy.mockRestore();
    registerCommandSpy.mockRestore();
    createTreeViewSpy.mockRestore();
  });
});
