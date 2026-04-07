import * as vscode from "vscode";

import { openNewCodexChat, resumeSavedCodexChat } from "./compat";
import { createSavedCodexSessionSnapshotFromTab, GlobalStateSavedCodexSessionStore, type SavedCodexSessionStore } from "./history";
import type { Logger } from "./logger";
import { OutputChannelLogger, toErrorMetadata } from "./logger";
import { getErrorFeedback } from "./messages";
import { OpenAICodexSessionSync, type CodexSessionSync } from "./openaiIpcClient";
import { SidebarLauncherViewProvider } from "./sidebarLauncherView";
import type { ErrorActionLabel } from "./types";
import {
  EXPERIMENTAL_MULTI_TAB_SETTING_KEY,
  OPEN_NEW_CODEX_CHAT_COMMAND,
  OUTPUT_CHANNEL_NAME,
  RESUME_SAVED_CODEX_SESSION_COMMAND,
  SIDEBAR_VIEW_ID
} from "./types";

interface ExtensionDependencies {
  getExperimentalMultiTabEnabled?: () => boolean;
  logger: Logger;
  outputChannel: vscode.OutputChannel;
  vscodeApi: typeof vscode;
}

interface ActivateDependencies {
  createSessionSync?: (
    sessionStore: SavedCodexSessionStore,
    sidebarViewProvider: SidebarLauncherViewProvider,
    logger: Logger
  ) => CodexSessionSync;
}

export interface ResumeSavedCodexChatRequest {
  resource: string;
}

export const activate = (context: vscode.ExtensionContext, deps: ActivateDependencies = {}): void => {
  const outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  const logger = new OutputChannelLogger(outputChannel);
  const sessionStore = new GlobalStateSavedCodexSessionStore(context.globalState);
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  const sidebarViewProvider = new SidebarLauncherViewProvider(context.extensionUri, context.globalState, sessionStore);
  const sessionSync = (deps.createSessionSync ?? createSessionSync)(sessionStore, sidebarViewProvider, logger);
  const sidebarViewRegistration = vscode.window.registerWebviewViewProvider(SIDEBAR_VIEW_ID, sidebarViewProvider);
  statusBarItem.command = OPEN_NEW_CODEX_CHAT_COMMAND;
  statusBarItem.text = "$(sparkle) Open Codex";
  statusBarItem.tooltip = "Open a new Codex tab";
  statusBarItem.show();

  context.subscriptions.push(outputChannel);
  context.subscriptions.push(sidebarViewRegistration);
  context.subscriptions.push(statusBarItem);
  context.subscriptions.push(sessionSync);
  context.subscriptions.push(
    vscode.window.tabGroups.onDidChangeTabs((event) => {
      void captureCodexSessionTabs(event.opened, sessionStore, sidebarViewProvider, logger);
      void captureCodexSessionTabs(event.changed, sessionStore, sidebarViewProvider, logger);
    })
  );
  context.subscriptions.push(
    ...registerExtension({
      getExperimentalMultiTabEnabled: () =>
        context.globalState.get<boolean>(EXPERIMENTAL_MULTI_TAB_SETTING_KEY, false),
      logger,
      outputChannel,
      vscodeApi: vscode
    })
  );

  void captureCodexSessionTabs(
    vscode.window.tabGroups.all.flatMap((group) => [...group.tabs]),
    sessionStore,
    sidebarViewProvider,
      logger
  );
  sessionSync.start();
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

  const runResumeSavedCodexChat = async (request?: ResumeSavedCodexChatRequest): Promise<boolean> => {
    logger.info("Resume Saved Codex Chat invoked.", { resource: request?.resource, vscodeVersion: vscodeApi.version });

    if (!request?.resource) {
      await vscodeApi.window.showErrorMessage("Open Codex could not reopen this entry because its session URI is missing.");
      return false;
    }

    for (;;) {
      try {
        await resumeSavedCodexChat(vscodeApi, logger, request.resource);
        return true;
      } catch (error) {
        logger.error("Resume Saved Codex Chat failed.", toErrorMetadata(error));
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
  const resumeCommand = vscodeApi.commands.registerCommand(RESUME_SAVED_CODEX_SESSION_COMMAND, runResumeSavedCodexChat);

  return [openCommand, resumeCommand];
};

const captureCodexSessionTabs = async (
  tabs: readonly vscode.Tab[],
  sessionStore: SavedCodexSessionStore,
  sidebarViewProvider: SidebarLauncherViewProvider,
  logger: Logger
): Promise<void> => {
  let captured = false;

  for (const tab of tabs) {
    const snapshot = createSavedCodexSessionSnapshotFromTab(tab);
    if (!snapshot) {
      continue;
    }

    try {
      await sessionStore.upsert(snapshot);
      captured = true;
    } catch (error) {
      logger.warn("Failed to capture a Codex session tab.", toErrorMetadata(error));
    }
  }

  if (captured) {
    sidebarViewProvider.refresh();
  }
};

const createSessionSync = (
  sessionStore: SavedCodexSessionStore,
  sidebarViewProvider: SidebarLauncherViewProvider,
  logger: Logger
): CodexSessionSync =>
  new OpenAICodexSessionSync(logger, {
    onSessionSnapshot: async (snapshot) => {
      await sessionStore.upsert(snapshot);
      sidebarViewProvider.refresh();
    }
  });

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
