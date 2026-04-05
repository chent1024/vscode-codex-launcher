import { describe, expect, it, vi } from "vitest";

import { OutputChannelLogger, toErrorMetadata } from "../src/logger";
import { getCompatibilityMessage, getErrorMessage } from "../src/messages";
import { CodexLauncherError, type CodexCompatibilityResult } from "../src/types";

describe("OutputChannelLogger", () => {
  it("writes log lines for each level", () => {
    const channel = {
      appendLine: vi.fn()
    };
    const logger = new OutputChannelLogger(channel as never);

    logger.info("info message", { ok: true });
    logger.warn("warn message");
    logger.error("error message");

    expect(channel.appendLine).toHaveBeenCalledTimes(3);
    expect(channel.appendLine.mock.calls[0][0]).toContain("[info] info message");
    expect(channel.appendLine.mock.calls[1][0]).toContain("[warn] warn message");
    expect(channel.appendLine.mock.calls[2][0]).toContain("[error] error message");
  });

  it("stringifies non-serializable metadata safely", () => {
    const channel = {
      appendLine: vi.fn()
    };
    const logger = new OutputChannelLogger(channel as never);
    const circular: { self?: unknown } = {};
    circular.self = circular;

    logger.info("circular", circular);

    expect(channel.appendLine).toHaveBeenCalledTimes(1);
    expect(channel.appendLine.mock.calls[0][0]).toContain("circular");
  });
});

describe("toErrorMetadata", () => {
  it("extracts details from an Error instance", () => {
    const metadata = toErrorMetadata(new Error("boom"));

    expect(metadata.name).toBe("Error");
    expect(metadata.message).toBe("boom");
  });

  it("converts non-error values to strings", () => {
    expect(toErrorMetadata("boom")).toEqual({ message: "boom" });
  });
});

describe("messages", () => {
  const details = {
    commandAvailable: true,
    commandId: "chatgpt.newCodexPanel",
    extensionId: "openai.chatgpt",
    extensionVersion: "0.4.76",
    vscodeVersion: "1.99.0"
  };

  it("maps known launcher errors to user-facing messages", () => {
    const error = new CodexLauncherError("CODEX_COMMAND_MISSING", "missing", details);

    expect(getErrorMessage(error)).toContain("does not support");
  });

  it("returns a generic message for unknown errors", () => {
    expect(getErrorMessage(new Error("unexpected"))).toContain("unexpectedly");
  });

  it("summarizes compatibility checks", () => {
    const okResult: CodexCompatibilityResult = {
      details,
      ok: true
    };
    const failedResult: CodexCompatibilityResult = {
      details: {
        ...details,
        commandAvailable: false
      },
      errorCode: "CODEX_NOT_INSTALLED",
      ok: false
    };

    expect(getCompatibilityMessage(okResult)).toContain("Codex is available");
    expect(getCompatibilityMessage(failedResult)).toContain("was not detected");
  });
});
