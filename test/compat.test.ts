import { describe, expect, it, vi } from "vitest";

import { checkCodexCompatibility, openNewCodexChat } from "../src/compat";
import type { Logger } from "../src/logger";

const createLogger = (): Logger => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn()
});

const createVscodeApi = (options?: {
  activate?: () => Promise<void>;
  commandList?: string[];
  executeCommand?: (commandId: string) => Promise<void>;
  extensionPresent?: boolean;
  extensionVersion?: string;
}) => {
  const extensionPresent = options?.extensionPresent ?? true;
  const activate = options?.activate ?? vi.fn().mockResolvedValue(undefined);
  const commandList = options?.commandList ?? ["chatgpt.newCodexPanel"];
  const executeCommand = options?.executeCommand ?? vi.fn().mockResolvedValue(undefined);

  return {
    commands: {
      executeCommand: vi.fn(executeCommand),
      getCommands: vi.fn().mockResolvedValue(commandList)
    },
    extensions: {
      getExtension: vi.fn().mockReturnValue(
        extensionPresent
          ? {
              activate,
              packageJSON: {
                version: options?.extensionVersion ?? "0.4.76"
              }
            }
          : undefined
      )
    },
    version: "1.99.0"
  };
};

describe("checkCodexCompatibility", () => {
  it("returns not installed when the OpenAI extension is missing", async () => {
    const logger = createLogger();
    const vscodeApi = createVscodeApi({ extensionPresent: false });

    const result = await checkCodexCompatibility(vscodeApi as never, logger);

    expect(result).toEqual({
      details: {
        commandAvailable: false,
        commandId: "chatgpt.newCodexPanel",
        extensionId: "openai.chatgpt",
        extensionVersion: null,
        vscodeVersion: "1.99.0"
      },
      errorCode: "CODEX_NOT_INSTALLED",
      ok: false
    });
  });

  it("returns command missing when the command is unavailable", async () => {
    const logger = createLogger();
    const vscodeApi = createVscodeApi({ commandList: [] });

    const result = await checkCodexCompatibility(vscodeApi as never, logger);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected an incompatible result.");
    }
    expect(result.errorCode).toBe("CODEX_COMMAND_MISSING");
    expect(result.details.commandAvailable).toBe(false);
  });

  it("returns activation failed when the extension activation throws", async () => {
    const logger = createLogger();
    const vscodeApi = createVscodeApi({
      activate: vi.fn().mockRejectedValue(new Error("boom"))
    });

    const result = await checkCodexCompatibility(vscodeApi as never, logger);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected an incompatible result.");
    }
    expect(result.errorCode).toBe("CODEX_ACTIVATION_FAILED");
  });
});

describe("openNewCodexChat", () => {
  it("executes the Codex command when compatibility checks pass", async () => {
    const logger = createLogger();
    const executeCommand = vi.fn().mockResolvedValue(undefined);
    const vscodeApi = createVscodeApi({ executeCommand });

    await openNewCodexChat(vscodeApi as never, logger);

    expect(vscodeApi.commands.executeCommand).toHaveBeenCalledWith("chatgpt.newCodexPanel");
  });

  it("throws a wrapped execution error when command execution fails", async () => {
    const logger = createLogger();
    const vscodeApi = createVscodeApi({
      executeCommand: vi.fn().mockRejectedValue(new Error("launch failed"))
    });

    await expect(openNewCodexChat(vscodeApi as never, logger)).rejects.toMatchObject({
      code: "CODEX_COMMAND_EXEC_FAILED",
      name: "CodexLauncherError"
    });
  });
});
