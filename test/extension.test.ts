import { describe, expect, it, vi } from "vitest";

import * as vscodeModule from "vscode";

import { activate, deactivate, registerExtension } from "../src/extension";
import type { Logger } from "../src/logger";

const createLogger = (): Logger => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn()
});

const createContext = () => ({
  extensionUri: {
    fsPath: "/test-extension",
    path: "/test-extension",
    scheme: "file"
  },
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

const createEnv = () => ({
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
});

const createUriApi = () => ({
  file: (path: string) => ({
    authority: "",
    fsPath: path,
    path,
    query: "",
    scheme: "file",
    with: ({ authority, query, scheme }: { authority?: string; query?: string; scheme?: string }) => ({
      authority: authority ?? "",
      fsPath: path,
      path,
      query: query ?? "",
      scheme: scheme ?? "file"
    })
  })
});

describe("registerExtension", () => {
  it("registers only the open-chat command", () => {
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
      Uri: createUriApi(),
      version: "1.99.0",
      window: {
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn()
      }
    };
    const disposables = registerExtension({
      logger: createLogger(),
      outputChannel: createOutputChannel() as never,
      vscodeApi: vscodeApi as never
    });

    expect(disposables).toHaveLength(1);
    expect(registeredCommands).toEqual(["codexLauncher.openNewCodexChat"]);
  });

  it("shows an error and output channel when opening a chat fails", async () => {
    const callbacks = new Map<string, () => Promise<void>>();
    const outputChannel = createOutputChannel();
    const executeCommand = vi.fn().mockRejectedValue(new Error("launch failed"));
    const vscodeApi = {
      commands: {
        executeCommand,
        getCommands: vi.fn().mockResolvedValue(["chatgpt.newCodexPanel"]),
        registerCommand: vi.fn((commandId: string, callback: () => Promise<void>) => {
          callbacks.set(commandId, callback);
          return {
            dispose: vi.fn()
          };
        })
      },
      env: createEnv(),
      extensions: {
        getExtension: vi.fn().mockReturnValue({
          activate: vi.fn().mockResolvedValue(undefined),
          packageJSON: {
            version: "0.4.76"
          }
        })
      },
      Uri: createUriApi(),
      version: "1.99.0",
      window: {
        showErrorMessage: vi.fn().mockResolvedValue(undefined),
        showInformationMessage: vi.fn().mockResolvedValue(undefined)
      }
    };

    registerExtension({
      logger: createLogger(),
      outputChannel: outputChannel as never,
      vscodeApi: vscodeApi as never
    });

    const openCommand = callbacks.get("codexLauncher.openNewCodexChat");
    if (!openCommand) {
      throw new Error("Open command was not registered.");
    }

    await openCommand();

    expect(outputChannel.show).toHaveBeenCalledWith(true);
    expect(vscodeApi.window.showErrorMessage).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledTimes(1);
  });

  it("opens the extension search when the dependency is missing and the user picks the install guidance action", async () => {
    const callbacks = new Map<string, () => Promise<void>>();
    const outputChannel = createOutputChannel();
    const executeCommand = vi.fn();
    const vscodeApi = {
      commands: {
        executeCommand,
        getCommands: vi.fn().mockResolvedValue([]),
        registerCommand: vi.fn((commandId: string, callback: () => Promise<void>) => {
          callbacks.set(commandId, callback);
          return {
            dispose: vi.fn()
          };
        })
      },
      env: createEnv(),
      extensions: {
        getExtension: vi.fn().mockReturnValue(undefined)
      },
      Uri: createUriApi(),
      version: "1.99.0",
      window: {
        showErrorMessage: vi.fn().mockResolvedValue("Find OpenAI ChatGPT Extension"),
        showInformationMessage: vi.fn().mockResolvedValue(undefined)
      }
    };

    registerExtension({
      logger: createLogger(),
      outputChannel: outputChannel as never,
      vscodeApi: vscodeApi as never
    });

    const openCommand = callbacks.get("codexLauncher.openNewCodexChat");
    if (!openCommand) {
      throw new Error("Open command was not registered.");
    }

    await openCommand();

    expect(vscodeApi.window.showErrorMessage).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith("workbench.extensions.search", "openai.chatgpt");
    expect(outputChannel.show).not.toHaveBeenCalled();
  });

  it("reloads the window when the user selects the reload action from an execution failure", async () => {
    const callbacks = new Map<string, () => Promise<void>>();
    const outputChannel = createOutputChannel();
    const executeCommand = vi
      .fn()
      .mockImplementation(async (commandId: string) => {
        if (commandId === "vscode.openWith" || commandId === "chatgpt.newCodexPanel") {
          throw new Error("launch failed");
        }
        return undefined;
      });
    const vscodeApi = {
      commands: {
        executeCommand,
        getCommands: vi.fn().mockResolvedValue(["chatgpt.newCodexPanel"]),
        registerCommand: vi.fn((commandId: string, callback: () => Promise<void>) => {
          callbacks.set(commandId, callback);
          return {
            dispose: vi.fn()
          };
        })
      },
      env: createEnv(),
      extensions: {
        getExtension: vi.fn().mockReturnValue({
          activate: vi.fn().mockResolvedValue(undefined),
          packageJSON: {
            version: "0.4.76"
          }
        })
      },
      Uri: createUriApi(),
      version: "1.99.0",
      window: {
        showErrorMessage: vi.fn().mockResolvedValue("Reload Window"),
        showInformationMessage: vi.fn().mockResolvedValue(undefined)
      }
    };

    registerExtension({
      logger: createLogger(),
      outputChannel: outputChannel as never,
      vscodeApi: vscodeApi as never
    });

    const openCommand = callbacks.get("codexLauncher.openNewCodexChat");
    if (!openCommand) {
      throw new Error("Open command was not registered.");
    }

    await openCommand();

    expect(outputChannel.show).toHaveBeenCalledWith(true);
    expect(executeCommand).toHaveBeenCalledWith("workbench.action.reloadWindow");
  });

  it("opens a new Codex chat when the launcher command runs", async () => {
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
      env: createEnv(),
      extensions: {
        getExtension: vi.fn().mockReturnValue({
          activate: vi.fn().mockResolvedValue(undefined),
          packageJSON: {
            version: "0.4.76"
          }
        })
      },
      Uri: createUriApi(),
      version: "1.99.0",
      window: {
        showErrorMessage: vi.fn().mockResolvedValue(undefined),
        showInformationMessage: vi.fn().mockResolvedValue(undefined)
      }
    };

    registerExtension({
      logger: createLogger(),
      outputChannel: createOutputChannel() as never,
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

  it("retries opening a chat when the user selects Retry", async () => {
    const callbacks = new Map<string, () => Promise<void>>();
    const outputChannel = createOutputChannel();
    const executeCommand = vi
      .fn()
      .mockRejectedValueOnce(new Error("openWith failed"))
      .mockRejectedValueOnce(new Error("launch timed out"))
      .mockResolvedValueOnce(undefined);
    const vscodeApi = {
      commands: {
        executeCommand,
        getCommands: vi.fn().mockResolvedValue(["chatgpt.newCodexPanel"]),
        registerCommand: vi.fn((commandId: string, callback: () => Promise<void>) => {
          callbacks.set(commandId, callback);
          return {
            dispose: vi.fn()
          };
        })
      },
      env: createEnv(),
      extensions: {
        getExtension: vi.fn().mockReturnValue({
          activate: vi.fn().mockResolvedValue(undefined),
          packageJSON: {
            version: "0.4.76"
          }
        })
      },
      Uri: createUriApi(),
      version: "1.99.0",
      window: {
        showErrorMessage: vi.fn().mockResolvedValue("Retry"),
        showInformationMessage: vi.fn().mockResolvedValue(undefined)
      }
    };

    registerExtension({
      logger: createLogger(),
      outputChannel: outputChannel as never,
      vscodeApi: vscodeApi as never
    });

    const openCommand = callbacks.get("codexLauncher.openNewCodexChat");
    if (!openCommand) {
      throw new Error("Open command was not registered.");
    }

    await openCommand();

    expect(executeCommand).toHaveBeenCalledTimes(3);
    expect(vscodeApi.window.showErrorMessage).toHaveBeenCalledTimes(2);
  });

  it("copies structured error details when the user selects the copy action", async () => {
    const callbacks = new Map<string, () => Promise<void>>();
    const outputChannel = createOutputChannel();
    const clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined)
    };
    const vscodeApi = {
      commands: {
        executeCommand: vi.fn(),
        getCommands: vi.fn().mockResolvedValue([]),
        registerCommand: vi.fn((commandId: string, callback: () => Promise<void>) => {
          callbacks.set(commandId, callback);
          return {
            dispose: vi.fn()
          };
        })
      },
      env: {
        clipboard
      },
      extensions: {
        getExtension: vi.fn().mockReturnValue(undefined)
      },
      Uri: createUriApi(),
      version: "1.99.0",
      window: {
        showErrorMessage: vi.fn().mockResolvedValue("Copy Error Details"),
        showInformationMessage: vi.fn().mockResolvedValue(undefined)
      }
    };

    registerExtension({
      logger: createLogger(),
      outputChannel: outputChannel as never,
      vscodeApi: vscodeApi as never
    });

    const openCommand = callbacks.get("codexLauncher.openNewCodexChat");
    if (!openCommand) {
      throw new Error("Open command was not registered.");
    }

    await openCommand();

    expect(clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(clipboard.writeText.mock.calls[0][0]).toContain("Open Codex error code: CODEX_NOT_INSTALLED");
    expect(vscodeApi.window.showInformationMessage).toHaveBeenCalledWith(
      "Open Codex copied the latest error details to your clipboard."
    );
  });

  it("can trigger the OpenAI command five times without local throttling", async () => {
    const callbacks = new Map<string, () => Promise<void>>();
    const executeCommand = vi.fn().mockResolvedValue(undefined);
    const vscodeApi = {
      commands: {
        executeCommand,
        getCommands: vi.fn().mockResolvedValue(["chatgpt.newCodexPanel"]),
        registerCommand: vi.fn((commandId: string, callback: () => Promise<void>) => {
          callbacks.set(commandId, callback);
          return {
            dispose: vi.fn()
          };
        })
      },
      env: createEnv(),
      extensions: {
        getExtension: vi.fn().mockReturnValue({
          activate: vi.fn().mockResolvedValue(undefined),
          packageJSON: {
            version: "0.4.76"
          }
        })
      },
      Uri: createUriApi(),
      version: "1.99.0",
      window: {
        showErrorMessage: vi.fn().mockResolvedValue(undefined),
        showInformationMessage: vi.fn().mockResolvedValue(undefined)
      }
    };

    registerExtension({
      logger: createLogger(),
      outputChannel: createOutputChannel() as never,
      vscodeApi: vscodeApi as never
    });

    const openCommand = callbacks.get("codexLauncher.openNewCodexChat");
    if (!openCommand) {
      throw new Error("Open command was not registered.");
    }

    for (let index = 0; index < 5; index += 1) {
      await openCommand();
    }

    expect(executeCommand).toHaveBeenCalledTimes(5);
    expect(executeCommand).toHaveBeenNthCalledWith(1, "chatgpt.newCodexPanel");
    expect(executeCommand).toHaveBeenNthCalledWith(5, "chatgpt.newCodexPanel");
  });

  it("uses the experimental multi-tab route when the toggle is enabled", async () => {
    const callbacks = new Map<string, () => Promise<void>>();
    const executeCommand = vi.fn().mockResolvedValue(undefined);
    const vscodeApi = {
      commands: {
        executeCommand,
        getCommands: vi.fn().mockResolvedValue(["chatgpt.newCodexPanel"]),
        registerCommand: vi.fn((commandId: string, callback: () => Promise<void>) => {
          callbacks.set(commandId, callback);
          return {
            dispose: vi.fn()
          };
        })
      },
      env: createEnv(),
      extensions: {
        getExtension: vi.fn().mockReturnValue({
          activate: vi.fn().mockResolvedValue(undefined),
          packageJSON: {
            version: "0.4.76"
          }
        })
      },
      Uri: createUriApi(),
      version: "1.99.0",
      window: {
        showErrorMessage: vi.fn().mockResolvedValue(undefined),
        showInformationMessage: vi.fn().mockResolvedValue(undefined)
      }
    };

    registerExtension({
      getExperimentalMultiTabEnabled: () => true,
      logger: createLogger(),
      outputChannel: createOutputChannel() as never,
      vscodeApi: vscodeApi as never
    });

    const openCommand = callbacks.get("codexLauncher.openNewCodexChat");
    if (!openCommand) {
      throw new Error("Open command was not registered.");
    }

    await openCommand();

    expect(executeCommand).toHaveBeenCalledWith(
      "vscode.openWith",
      expect.objectContaining({
        authority: "route",
        path: "/extension/panel/new",
        query: expect.stringMatching(/^launcherSession=/),
        scheme: "openai-codex"
      }),
      "chatgpt.conversationEditor",
      expect.objectContaining({
        preserveFocus: false,
        preview: false
      })
    );
  });
});

describe("activate", () => {
  it("creates the output channel, status bar entry, and subscriptions", () => {
    const outputChannel = createOutputChannel();
    const webviewRegistration = {
      dispose: vi.fn()
    };
    const statusBarItem = {
      command: "",
      dispose: vi.fn(),
      show: vi.fn(),
      text: "",
      tooltip: ""
    };
    const createOutputChannelSpy = vi
      .spyOn(vscodeModule.window, "createOutputChannel")
      .mockReturnValue(outputChannel as never);
    const createStatusBarItemSpy = vi
      .spyOn(vscodeModule.window, "createStatusBarItem")
      .mockReturnValue(statusBarItem as never);
    const registerWebviewViewProviderSpy = vi
      .spyOn(vscodeModule.window, "registerWebviewViewProvider")
      .mockReturnValue(webviewRegistration as never);
    const registerCommandSpy = vi
      .spyOn(vscodeModule.commands, "registerCommand")
      .mockImplementation(() => ({ dispose: vi.fn() }) as never);
    const context = createContext();

    activate(context as never);
    deactivate();

    expect(createOutputChannelSpy).toHaveBeenCalledWith("Open Codex");
    expect(createStatusBarItemSpy).toHaveBeenCalledTimes(1);
    expect(registerWebviewViewProviderSpy).toHaveBeenCalledWith(
      "codexLauncher.sidebarView",
      expect.any(Object)
    );
    expect(statusBarItem.command).toBe("codexLauncher.openNewCodexChat");
    expect(statusBarItem.text).toBe("$(sparkle) Open Codex");
    expect(statusBarItem.tooltip).toBe("Open a new Codex tab");
    expect(statusBarItem.show).toHaveBeenCalledTimes(1);
    expect(registerCommandSpy).toHaveBeenCalledTimes(1);
    expect(context.subscriptions.length).toBeGreaterThanOrEqual(3);

    createOutputChannelSpy.mockRestore();
    createStatusBarItemSpy.mockRestore();
    registerWebviewViewProviderSpy.mockRestore();
    registerCommandSpy.mockRestore();
  });
});
