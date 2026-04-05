import { CodexLauncherError, type CodexCompatibilityResult, type CodexErrorCode } from "./types";

const ERROR_MESSAGES: Record<CodexErrorCode, string> = {
  CODEX_ACTIVATION_FAILED: "Codex extension activation failed. Reload VS Code and try again.",
  CODEX_COMMAND_EXEC_FAILED: "Failed to open a new Codex chat window. Try again in a moment.",
  CODEX_COMMAND_MISSING: "This Codex extension version does not support opening a new chat window.",
  CODEX_NOT_INSTALLED: "Codex extension was not detected. Install the OpenAI ChatGPT extension first."
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof CodexLauncherError) {
    return ERROR_MESSAGES[error.code];
  }

  return "Codex Launcher failed unexpectedly. Check the output panel for details.";
};

export const getCompatibilityMessage = (result: CodexCompatibilityResult): string =>
  result.ok
    ? `Codex is available. VS Code ${result.details.vscodeVersion}, extension ${result.details.extensionVersion ?? "unknown"}, command ${result.details.commandId}.`
    : ERROR_MESSAGES[result.errorCode];
