import * as vscode from "vscode";

import { openNewCodexChat } from "./compat";
import type { Logger } from "./logger";
import { OutputChannelLogger, toErrorMetadata } from "./logger";
import { getErrorMessage } from "./messages";
import { CodexSidebarActionProvider } from "./sidebarActionView";
import { OPEN_NEW_CODEX_CHAT_COMMAND, OUTPUT_CHANNEL_NAME } from "./types";

interface ExtensionDependencies {
  logger: Logger;
  outputChannel: vscode.OutputChannel;
  sidebarViewProvider: CodexSidebarActionProvider;
  vscodeApi: typeof vscode;
}

export const activate = (context: vscode.ExtensionContext): void => {
  const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  const logger = new OutputChannelLogger(outputChannel);
  const sidebarViewProvider = new CodexSidebarActionProvider();

  context.subscriptions.push(outputChannel);
  context.subscriptions.push(
    ...registerExtension(context, { logger, outputChannel, sidebarViewProvider, vscodeApi: vscode })
  );
};

export const deactivate = (): void => {};

export const registerExtension = (
  context: Pick<vscode.ExtensionContext, "subscriptions">,
  deps: ExtensionDependencies
): vscode.Disposable[] => {
  const { logger, outputChannel, sidebarViewProvider, vscodeApi } = deps;

  const openCommand = vscodeApi.commands.registerCommand(OPEN_NEW_CODEX_CHAT_COMMAND, async () => {
    logger.info("Open New Codex Chat invoked.", { vscodeVersion: vscodeApi.version });

    try {
      await openNewCodexChat(vscodeApi, logger);
      return true;
    } catch (error) {
      logger.error("Open New Codex Chat failed.", toErrorMetadata(error));
      outputChannel.show(true);
      await vscodeApi.window.showErrorMessage(getErrorMessage(error));
      return false;
    }
  });

  const sidebarView = vscodeApi.window.createTreeView(CodexSidebarActionProvider.viewType, {
    treeDataProvider: sidebarViewProvider,
    showCollapseAll: false
  });

  context.subscriptions.push(sidebarView);

  return [openCommand];
};
