import { CodexLauncherError, type CodexCompatibilityResult, type CodexErrorCode, type ErrorActionLabel, type ErrorFeedback } from "./types";

export const getErrorMessage = (error: unknown): string => {
  return getErrorFeedback(error).message;
};

export const getErrorFeedback = (error: unknown): ErrorFeedback => {
  if (error instanceof CodexLauncherError) {
    return getLauncherErrorFeedback(error);
  }

  return {
    actions: ["Retry", "Open Output", "Copy Error Details"],
    details: createUnknownErrorDetails(error),
    message: withReason(
      "Open Codex failed unexpectedly. Check the Open Codex output channel for details.",
      error
    ),
    openOutputByDefault: true
  };
};

export const getCompatibilityMessage = (result: CodexCompatibilityResult): string =>
  result.ok
    ? `OpenAI ChatGPT extension ${formatExtensionVersion(result.details.extensionVersion)} is available in VS Code ${result.details.vscodeVersion} and exposes ${result.details.commandId}.`
    : getCompatibilityFailureMessage(result.errorCode, result.details);

const getLauncherErrorFeedback = (error: CodexLauncherError): ErrorFeedback => {
  const { code, details } = error;
  const extensionName = getExtensionLabel(details.extensionId, details.extensionVersion);
  const reason = getReasonText(error.cause);
  const errorDetails = createLauncherErrorDetails(error);

  switch (code) {
    case "CODEX_NOT_INSTALLED":
      return createFeedback(
        withReason(
          `${extensionName} was not detected. Install or enable the OpenAI ChatGPT extension, then try again.`,
          reason
        ),
        ["Find OpenAI ChatGPT Extension", "Copy Error Details"],
        errorDetails,
        false
      );
    case "CODEX_ACTIVATION_FAILED":
      return createFeedback(
        withReason(
          `${extensionName} was found but could not be activated. Reload VS Code, make sure the extension is enabled, then try again.`,
          reason
        ),
        ["Reload Window", "Retry", "Open Output", "Copy Error Details"],
        errorDetails,
        true
      );
    case "CODEX_COMMAND_MISSING":
      return createFeedback(
        createCommandMissingMessage(details.commandId, extensionName, reason),
        ["Find OpenAI ChatGPT Extension", "Retry", "Open Output", "Copy Error Details"],
        errorDetails,
        true
      );
    case "CODEX_COMMAND_EXEC_FAILED":
      return createFeedback(
        createCommandExecFailedMessage(details.commandId, extensionName, reason),
        ["Retry", "Reload Window", "Open Output", "Copy Error Details"],
        errorDetails,
        true
      );
  }
};

const getCompatibilityFailureMessage = (code: CodexErrorCode, details: CodexCompatibilityResult["details"]): string => {
  const extensionName = getExtensionLabel(details.extensionId, details.extensionVersion);

  switch (code) {
    case "CODEX_NOT_INSTALLED":
      return `${extensionName} was not detected. Install or enable the OpenAI ChatGPT extension, then try again.`;
    case "CODEX_ACTIVATION_FAILED":
      return `${extensionName} is installed but could not be activated. Reload VS Code and verify the extension is enabled.`;
    case "CODEX_COMMAND_MISSING":
      return `${extensionName} is installed, but ${details.commandId} is missing. Update the OpenAI ChatGPT extension or verify that Codex is supported in this version.`;
    case "CODEX_COMMAND_EXEC_FAILED":
      return `${extensionName} is installed and exposes ${details.commandId}, but opening a chat failed. Try again and check the Open Codex output channel if the problem persists.`;
  }
};

const getExtensionLabel = (extensionId: string, extensionVersion: string | null): string =>
  `OpenAI ChatGPT extension (${extensionId}, version ${formatExtensionVersion(extensionVersion)})`;

const formatExtensionVersion = (extensionVersion: string | null): string => extensionVersion ?? "unknown";

const createFeedback = (
  message: string,
  actions: ErrorActionLabel[],
  details: string,
  openOutputByDefault: boolean
): ErrorFeedback => ({
  actions,
  details,
  message,
  openOutputByDefault
});

const createCommandMissingMessage = (commandId: string, extensionName: string, reason?: string): string => {
  if (reason && mentionsCommandLoss(reason, commandId)) {
    return withReason(
      `${extensionName} looks installed, but ${commandId} is not available right now. Reload or update the OpenAI ChatGPT extension, then try again.`,
      reason
    );
  }

  return withReason(
    `${extensionName} does not expose ${commandId}. Update the OpenAI ChatGPT extension or verify that your installed version supports Codex.`,
    reason
  );
};

const createCommandExecFailedMessage = (commandId: string, extensionName: string, reason?: string): string => {
  if (reason && mentionsCommandLoss(reason, commandId)) {
    return withReason(
      `${extensionName} stopped exposing ${commandId} while Open Codex was trying to start a chat. Reload or update the OpenAI ChatGPT extension, then retry.`,
      reason
    );
  }

  if (reason && mentionsTimeout(reason)) {
    return withReason(
      `Open Codex could not open a new chat through ${extensionName} because the request timed out. Retry first, then reload VS Code if it keeps failing.`,
      reason
    );
  }

  return withReason(
    `Open Codex could not open a new chat through ${extensionName}. Try again, reload VS Code if it keeps failing, and check the Open Codex output channel for details.`,
    reason
  );
};

const withReason = (message: string, source: unknown): string => {
  const reason = typeof source === "string" ? source : getReasonText(source);
  return reason ? `${message} Reason: ${reason}.` : message;
};

const getReasonText = (value: unknown): string | undefined => {
  if (value instanceof Error) {
    return sanitizeReason(value.message);
  }

  if (typeof value === "string") {
    return sanitizeReason(value);
  }

  return undefined;
};

const sanitizeReason = (value: string): string | undefined => {
  const compact = value.replaceAll(/\s+/g, " ").trim();
  if (!compact) {
    return undefined;
  }

  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
};

const createLauncherErrorDetails = (error: CodexLauncherError): string => {
  const { code, details } = error;
  const reason = getReasonText(error.cause);

  return [
    `Open Codex error code: ${code}`,
    `VS Code version: ${details.vscodeVersion}`,
    `OpenAI extension: ${details.extensionId}`,
    `OpenAI extension version: ${formatExtensionVersion(details.extensionVersion)}`,
    `Codex command: ${details.commandId}`,
    `Command detected: ${details.commandAvailable ? "yes" : "no"}`,
    reason ? `Reason: ${reason}` : undefined
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
};

const createUnknownErrorDetails = (error: unknown): string => {
  const reason = getReasonText(error);
  if (reason) {
    return `Open Codex unexpected error\nReason: ${reason}`;
  }

  return "Open Codex unexpected error";
};

const mentionsCommandLoss = (reason: string, commandId: string): boolean => {
  const normalizedReason = reason.toLowerCase();
  return normalizedReason.includes(commandId.toLowerCase()) || normalizedReason.includes("command") || normalizedReason.includes("not found");
};

const mentionsTimeout = (reason: string): boolean => {
  const normalizedReason = reason.toLowerCase();
  return normalizedReason.includes("timeout") || normalizedReason.includes("timed out");
};
