import * as vscode from "vscode";

import { openNewCodexChat } from "./compat";
import type { Logger } from "./logger";
import { OutputChannelLogger, toErrorMetadata } from "./logger";
import { getErrorFeedback } from "./messages";
import { SidebarLauncherViewProvider } from "./sidebarLauncherView";
import type { ErrorActionLabel } from "./types";
import {
  EXPERIMENTAL_MULTI_TAB_SETTING_KEY,
  OPEN_NEW_CODEX_CHAT_COMMAND,
  OUTPUT_CHANNEL_NAME,
  SIDEBAR_VIEW_ID
} from "./types";

interface ExtensionDependencies {
  getExperimentalMultiTabEnabled?: () => boolean;
  logger: Logger;
  outputChannel: vscode.OutputChannel;
  vscodeApi: typeof vscode;
}

export const activate = (context: vscode.ExtensionContext): void => {
  const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  const logger = new OutputChannelLogger(outputChannel);
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  const sidebarViewProvider = new SidebarLauncherViewProvider(context.extensionUri, context.globalState);
  const sidebarViewRegistration = vscode.window.registerWebviewViewProvider(SIDEBAR_VIEW_ID, sidebarViewProvider);
  statusBarItem.command = OPEN_NEW_CODEX_CHAT_COMMAND;
  statusBarItem.text = "$(sparkle) Open Codex";
  statusBarItem.tooltip = "Open a new Codex tab";
  statusBarItem.show();

  context.subscriptions.push(outputChannel);
  context.subscriptions.push(sidebarViewRegistration);
  context.subscriptions.push(statusBarItem);
  context.subscriptions.push(
    ...registerExtension({
      getExperimentalMultiTabEnabled: () =>
        context.globalState.get<boolean>(EXPERIMENTAL_MULTI_TAB_SETTING_KEY, false),
      logger,
      outputChannel,
      vscodeApi: vscode
    })
  );
};

export const deactivate = (): void => {};

export const registerExtension = (deps: ExtensionDependencies): vscode.Disposable[] => {
  const { getExperimentalMultiTabEnabled, logger, outputChannel, vscodeApi } = deps;

  const runOpenNewCodexChat = async (): Promise<boolean> => {
    logger.info("Open New Codex Chat invoked.", { vscodeVersion: vscodeApi.version });

    for (;;) {
      try {
        await openNewCodexChat(vscodeApi, logger, {
          useExperimentalMultiTab: getExperimentalMultiTabEnabled?.() ?? false
        });
        return true;
      } catch (error) {
        logger.error("Open New Codex Chat failed.", toErrorMetadata(error));
        const feedback = getErrorFeedback(error);
        if (feedback.openOutputByDefault) {
          outputChannel.show(true);
        }
        const selectedAction = await vscodeApi.window.showErrorMessage(feedback.message, ...feedback.actions);
        const shouldRetry = await handleErrorAction(selectedAction, feedback.details, outputChannel, vscodeApi);
        if (!shouldRetry) {
          return false;
        }
      }
    }
  };

  const openCommand = vscodeApi.commands.registerCommand(OPEN_NEW_CODEX_CHAT_COMMAND, runOpenNewCodexChat);

  return [openCommand];
};

const handleErrorAction = async (
  action: ErrorActionLabel | undefined,
  details: string,
  outputChannel: vscode.OutputChannel,
  vscodeApi: typeof vscode
): Promise<boolean> => {
  switch (action) {
    case "Retry":
      return true;
    case "Copy Error Details":
      await vscodeApi.env.clipboard.writeText(details);
      await vscodeApi.window.showInformationMessage("Open Codex copied the latest error details to your clipboard.");
      return false;
    case "Open Output":
      outputChannel.show(true);
      return false;
    case "Reload Window":
      await vscodeApi.commands.executeCommand("workbench.action.reloadWindow");
      return false;
    case "Find OpenAI ChatGPT Extension":
      await vscodeApi.commands.executeCommand("workbench.extensions.search", "openai.chatgpt");
      return false;
    default:
      return false;
  }
};
