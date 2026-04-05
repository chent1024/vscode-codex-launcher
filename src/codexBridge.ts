import type * as vscode from "vscode";

import { CodexLauncherError, CODEX_COMMAND_ID, CODEX_EXTENSION_ID, type CodexEnvironmentDetails } from "./types";

export const findCodexExtension = (
  vscodeApi: typeof vscode
): vscode.Extension<unknown> | undefined => vscodeApi.extensions.getExtension(CODEX_EXTENSION_ID);

export const createEnvironmentDetails = (
  vscodeApi: typeof vscode,
  extension: vscode.Extension<unknown> | undefined
): CodexEnvironmentDetails => ({
  commandAvailable: false,
  commandId: CODEX_COMMAND_ID,
  extensionId: CODEX_EXTENSION_ID,
  extensionVersion: getExtensionVersion(extension),
  vscodeVersion: vscodeApi.version
});

export const activateCodexExtension = async (
  extension: vscode.Extension<unknown>,
  details: CodexEnvironmentDetails
): Promise<void> => {
  try {
    await extension.activate();
  } catch (error) {
    throw new CodexLauncherError(
      "CODEX_ACTIVATION_FAILED",
      "Failed to activate the Codex extension.",
      details,
      error
    );
  }
};

export const ensureCodexCommandAvailable = async (
  vscodeApi: typeof vscode,
  details: CodexEnvironmentDetails
): Promise<boolean> => {
  const commands = await vscodeApi.commands.getCommands(true);
  const commandAvailable = commands.includes(CODEX_COMMAND_ID);
  details.commandAvailable = commandAvailable;
  return commandAvailable;
};

export const launchCodexChat = async (
  vscodeApi: typeof vscode,
  details: CodexEnvironmentDetails
): Promise<void> => {
  try {
    await vscodeApi.commands.executeCommand(CODEX_COMMAND_ID);
  } catch (error) {
    throw new CodexLauncherError(
      "CODEX_COMMAND_EXEC_FAILED",
      "Failed to execute the Codex chat command.",
      details,
      error
    );
  }
};

const getExtensionVersion = (extension: vscode.Extension<unknown> | undefined): string | null => {
  const version = extension?.packageJSON && "version" in extension.packageJSON ? extension.packageJSON.version : undefined;
  return typeof version === "string" ? version : null;
};
