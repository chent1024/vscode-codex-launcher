import type * as vscode from "vscode";

import { activateCodexExtension, createEnvironmentDetails, ensureCodexCommandAvailable, findCodexExtension, launchCodexChat } from "./codexBridge";
import type { Logger } from "./logger";
import { toErrorMetadata } from "./logger";
import { CodexLauncherError, type CodexCompatibilityResult } from "./types";

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

export const openNewCodexChat = async (vscodeApi: typeof vscode, logger: Logger): Promise<void> => {
  const compatibility = await checkCodexCompatibility(vscodeApi, logger);
  if (!compatibility.ok) {
    throw new CodexLauncherError(
      compatibility.errorCode,
      "Codex compatibility check failed.",
      compatibility.details
    );
  }

  await launchCodexChat(vscodeApi, compatibility.details);
  logger.info("Opened a new Codex chat window.", compatibility.details);
};
