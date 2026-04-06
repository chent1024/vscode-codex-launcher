import { randomUUID } from "node:crypto";
import type * as vscode from "vscode";

import {
  CodexLauncherError,
  CODEX_COMMAND_ID,
  CODEX_CUSTOM_EDITOR_VIEW_TYPE,
  CODEX_EXTENSION_ID,
  CODEX_NEW_PANEL_PATH,
  CODEX_URI_AUTHORITY,
  CODEX_URI_SCHEME,
  type CodexEnvironmentDetails
} from "./types";

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

export const launchCodexChatViaUniqueUri = async (
  vscodeApi: typeof vscode,
  details: CodexEnvironmentDetails
): Promise<void> => {
  const targetUri = createUniqueCodexPanelUri(vscodeApi);

  try {
    await vscodeApi.commands.executeCommand("vscode.openWith", targetUri, CODEX_CUSTOM_EDITOR_VIEW_TYPE, {
      preserveFocus: false,
      preview: false
    });
  } catch (error) {
    throw new CodexLauncherError(
      "CODEX_COMMAND_EXEC_FAILED",
      "Failed to open a unique Codex editor resource.",
      details,
      error
    );
  }
};

export const createUniqueCodexPanelUri = (vscodeApi: Pick<typeof vscode, "Uri">): vscode.Uri =>
  vscodeApi.Uri.file(CODEX_NEW_PANEL_PATH).with({
    authority: CODEX_URI_AUTHORITY,
    query: `launcherSession=${randomUUID()}`,
    scheme: CODEX_URI_SCHEME
  });

const getExtensionVersion = (extension: vscode.Extension<unknown> | undefined): string | null => {
  const version = extension?.packageJSON && "version" in extension.packageJSON ? extension.packageJSON.version : undefined;
  return typeof version === "string" ? version : null;
};
