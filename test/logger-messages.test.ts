import { describe, expect, it, vi } from "vitest";

import { OutputChannelLogger, toErrorMetadata } from "../src/logger";
import { getCompatibilityMessage, getErrorFeedback, getErrorMessage } from "../src/messages";
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
    const error = new CodexLauncherError("CODEX_COMMAND_MISSING", "missing", details, new Error("command missing"));

    expect(getErrorMessage(error)).toContain("OpenAI ChatGPT extension");
    expect(getErrorMessage(error)).toContain("chatgpt.newCodexPanel");
    expect(getErrorMessage(error)).toContain("0.4.76");
    expect(getErrorMessage(error)).toContain("command missing");
  });

  it("returns a generic message for unknown errors", () => {
    expect(getErrorMessage(new Error("unexpected"))).toContain("Open Codex output");
    expect(getErrorMessage(new Error("unexpected"))).toContain("unexpected");
  });

  it("includes retry and copy actions for unknown errors", () => {
    const feedback = getErrorFeedback(new Error("unexpected"));

    expect(feedback.actions).toEqual(["Retry", "Open Output", "Copy Error Details"]);
    expect(feedback.details).toContain("unexpected");
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

    expect(getCompatibilityMessage(okResult)).toContain("OpenAI ChatGPT extension");
    expect(getCompatibilityMessage(okResult)).toContain("chatgpt.newCodexPanel");
    expect(getCompatibilityMessage(failedResult)).toContain("Install or enable");
  });

  it("gives actionable guidance for execution failures", () => {
    const error = new CodexLauncherError("CODEX_COMMAND_EXEC_FAILED", "exec failed", details, new Error("launch failed"));

    expect(getErrorMessage(error)).toContain("reload VS Code");
    expect(getErrorMessage(error)).toContain("Open Codex output");
    expect(getErrorMessage(error)).toContain("launch failed");
  });

  it("includes a concise reason in compatibility failures when a cause exists", () => {
    const error = new CodexLauncherError("CODEX_ACTIVATION_FAILED", "activation failed", details, new Error("extension host timeout"));

    expect(getErrorMessage(error)).toContain("extension host timeout");
    expect(getErrorMessage(error)).toContain("Reload VS Code");
  });

  it("tailors command execution failures when the command disappears", () => {
    const error = new CodexLauncherError(
      "CODEX_COMMAND_EXEC_FAILED",
      "exec failed",
      details,
      new Error("command 'chatgpt.newCodexPanel' not found")
    );

    expect(getErrorMessage(error)).toContain("stopped exposing");
    expect(getErrorMessage(error)).toContain("chatgpt.newCodexPanel");
  });

  it("includes structured diagnostic details for launcher errors", () => {
    const error = new CodexLauncherError("CODEX_COMMAND_MISSING", "missing", details, new Error("command missing"));
    const feedback = getErrorFeedback(error);

    expect(feedback.actions).toContain("Copy Error Details");
    expect(feedback.actions).toContain("Retry");
    expect(feedback.details).toContain("Open Codex error code: CODEX_COMMAND_MISSING");
    expect(feedback.details).toContain("OpenAI extension version: 0.4.76");
  });
});
