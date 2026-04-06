export const CODEX_EXTENSION_ID = "openai.chatgpt";
export const CODEX_COMMAND_ID = "chatgpt.newCodexPanel";
export const CODEX_CUSTOM_EDITOR_VIEW_TYPE = "chatgpt.conversationEditor";
export const CODEX_URI_AUTHORITY = "route";
export const CODEX_NEW_PANEL_PATH = "/extension/panel/new";
export const CODEX_URI_SCHEME = "openai-codex";
export const OPEN_NEW_CODEX_CHAT_COMMAND = "codexLauncher.openNewCodexChat";
export const SIDEBAR_VIEW_ID = "codexLauncher.sidebarView";
export const OUTPUT_CHANNEL_NAME = "Open Codex";
export const AUTO_CLOSE_SIDEBAR_SETTING_KEY = "codexLauncher.autoCloseSidebarOnSuccess";
export const EXPERIMENTAL_MULTI_TAB_SETTING_KEY = "codexLauncher.experimentalMultiTab";

export type CodexErrorCode =
  | "CODEX_NOT_INSTALLED"
  | "CODEX_ACTIVATION_FAILED"
  | "CODEX_COMMAND_MISSING"
  | "CODEX_COMMAND_EXEC_FAILED";

export interface CodexEnvironmentDetails {
  vscodeVersion: string;
  extensionId: string;
  extensionVersion: string | null;
  commandId: string;
  commandAvailable: boolean;
}

export type ErrorActionLabel =
  | "Open Output"
  | "Reload Window"
  | "Find OpenAI ChatGPT Extension"
  | "Retry"
  | "Copy Error Details";

export interface ErrorFeedback {
  actions: ErrorActionLabel[];
  details: string;
  message: string;
  openOutputByDefault: boolean;
}

export type CodexCompatibilityResult =
  | {
      details: CodexEnvironmentDetails;
      ok: true;
    }
  | {
      details: CodexEnvironmentDetails;
      errorCode: CodexErrorCode;
      ok: false;
    };

export class CodexLauncherError extends Error {
  public readonly code: CodexErrorCode;
  public readonly details: CodexEnvironmentDetails;
  public readonly cause: unknown;

  public constructor(code: CodexErrorCode, message: string, details: CodexEnvironmentDetails, cause?: unknown) {
    super(message);
    this.name = "CodexLauncherError";
    this.code = code;
    this.details = details;
    this.cause = cause;
  }
}
