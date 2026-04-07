import type * as vscode from "vscode";

import {
  activateCodexExtension,
  createEnvironmentDetails,
  ensureCodexCommandAvailable,
  findCodexExtension,
  launchCodexChat,
  launchCodexChatViaUniqueUri,
  launchSavedCodexSession
} from "./codexBridge";
import type { Logger } from "./logger";
import { toErrorMetadata } from "./logger";
import { CodexLauncherError, type CodexCompatibilityResult } from "./types";

interface OpenNewCodexChatOptions {
  useExperimentalMultiTab?: boolean;
}

export const checkCodexCompatibility = async (
  vscodeApi: typeof vscode,
  logger: Logger
): Promise<CodexCompatibilityResult> => {
  const extension = findCodexExtension(vscodeApi);
  const details = createEnvironmentDetails(vscodeApi, extension);

  logger.info("Checking Codex extension availability.", details);

  if (!extension) {
    logger.warn("Codex extension is not installed.", details);
    return {
      details,
      errorCode: "CODEX_NOT_INSTALLED",
      ok: false
    };
  }

  try {
    await activateCodexExtension(extension, details);
    logger.info("Codex extension activated.", details);
  } catch (error) {
    logger.error("Codex extension activation failed.", toErrorMetadata(error));
    return {
      details,
      errorCode: "CODEX_ACTIVATION_FAILED",
      ok: false
    };
  }

  const commandAvailable = await ensureCodexCommandAvailable(vscodeApi, details);
  if (!commandAvailable) {
    logger.warn("Codex open chat command is missing.", details);
    return {
      details,
      errorCode: "CODEX_COMMAND_MISSING",
      ok: false
    };
  }

  logger.info("Codex command is available.", details);
  return {
    details,
    ok: true
  };
};

export const openNewCodexChat = async (
  vscodeApi: typeof vscode,
  logger: Logger,
  options?: OpenNewCodexChatOptions
): Promise<void> => {
  const extension = findCodexExtension(vscodeApi);
  const details = createEnvironmentDetails(vscodeApi, extension);
  const useExperimentalMultiTab = options?.useExperimentalMultiTab ?? false;

  logger.info("Opening a new Codex chat.", details);

  if (!extension) {
    throw new CodexLauncherError(
      "CODEX_NOT_INSTALLED",
      "Codex extension is not installed.",
      details
    );
  }

  try {
    await activateCodexExtension(extension, details);
  } catch (error) {
    logger.error("Codex extension activation failed.", toErrorMetadata(error));
    throw error;
  }

  details.commandAvailable = await ensureCodexCommandAvailable(vscodeApi, details);

  if (!details.commandAvailable) {
    throw new CodexLauncherError(
      "CODEX_COMMAND_MISSING",
      "Codex open chat command is missing.",
      details
    );
  }

  if (!useExperimentalMultiTab) {
    await launchCodexChat(vscodeApi, details);
    logger.info("Opened a new Codex chat via the public command.", details);
    return;
  }

  try {
    await launchCodexChatViaUniqueUri(vscodeApi, details);
    logger.info("Opened a new Codex editor via a unique URI.", details);
    return;
  } catch (error) {
    logger.warn("Unique Codex URI launch failed. Falling back to public command if available.", toErrorMetadata(error));
  }

  await launchCodexChat(vscodeApi, details);
  logger.info("Opened a new Codex chat via the public command fallback.", details);
};

export const resumeSavedCodexChat = async (vscodeApi: typeof vscode, logger: Logger, resource: string): Promise<void> => {
  const extension = findCodexExtension(vscodeApi);
  const details = createEnvironmentDetails(vscodeApi, extension);

  logger.info("Reopening a saved Codex session.", {
    ...details,
    resource
  });

  if (!extension) {
    throw new CodexLauncherError("CODEX_NOT_INSTALLED", "Codex extension is not installed.", details);
  }

  try {
    await activateCodexExtension(extension, details);
  } catch (error) {
    logger.error("Codex extension activation failed.", toErrorMetadata(error));
    throw error;
  }

  const targetUri = vscodeApi.Uri.parse(resource);
  await launchSavedCodexSession(vscodeApi, details, targetUri);
  logger.info("Reopened a saved Codex session.", details);
};
