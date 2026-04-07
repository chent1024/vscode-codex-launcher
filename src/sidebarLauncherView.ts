import * as vscode from "vscode";

import type { SavedCodexSession, SavedCodexSessionStore } from "./history";
import {
  AUTO_CLOSE_SIDEBAR_SETTING_KEY,
  EXPERIMENTAL_MULTI_TAB_SETTING_KEY,
  OPEN_NEW_CODEX_CHAT_COMMAND,
  RESUME_SAVED_CODEX_SESSION_COMMAND
} from "./types";

const SESSION_SYNC_POLL_INTERVAL_MS = 1500;

export class SidebarLauncherViewProvider implements vscode.WebviewViewProvider {
  private currentView: vscode.WebviewView | undefined;
  private sessionSyncInterval: ReturnType<typeof setInterval> | undefined;
  private sessionSignature = "[]";

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly globalState: vscode.Memento,
    private readonly sessionStore: SavedCodexSessionStore
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.currentView = webviewView;
    this.sessionSignature = this.createSessionSignature(this.sessionStore.list());
    webviewView.onDidDispose(() => {
      if (this.currentView === webviewView) {
        this.currentView = undefined;
        this.stopSessionSync();
      }
    });
    webviewView.onDidChangeVisibility(() => {
      if (this.currentView !== webviewView) {
        return;
      }

      if (webviewView.visible) {
        this.syncSessionsFromStore();
        this.startSessionSync();
      } else {
        this.stopSessionSync();
      }
    });

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    this.render(webviewView);
    if (webviewView.visible) {
      this.startSessionSync();
    }
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (!message || typeof message !== "object" || !("type" in message)) {
        return;
      }

      if (message.type === "set-auto-close") {
        const enabled = "enabled" in message && typeof message.enabled === "boolean" ? message.enabled : true;
        await this.globalState.update(AUTO_CLOSE_SIDEBAR_SETTING_KEY, enabled);
        return;
      }

      if (message.type === "set-experimental-multi-tab") {
        const enabled = "enabled" in message && typeof message.enabled === "boolean" ? message.enabled : false;
        await this.globalState.update(EXPERIMENTAL_MULTI_TAB_SETTING_KEY, enabled);
        return;
      }

      if (message.type === "open-codex") {
        await this.runCommandAndMaybeClose(OPEN_NEW_CODEX_CHAT_COMMAND);
        return;
      }

      if (message.type === "resume-codex-session") {
        const resource = "resource" in message && typeof message.resource === "string" ? message.resource : "";
        await this.runCommandAndMaybeClose(RESUME_SAVED_CODEX_SESSION_COMMAND, { resource });
      }
    });
  }

  public refresh(): void {
    if (this.currentView) {
      this.sessionSignature = this.createSessionSignature(this.sessionStore.list());
      this.render(this.currentView);
    }
  }

  private startSessionSync(): void {
    if (this.sessionSyncInterval) {
      return;
    }

    this.sessionSyncInterval = setInterval(() => {
      this.syncSessionsFromStore();
    }, SESSION_SYNC_POLL_INTERVAL_MS);
  }

  private stopSessionSync(): void {
    if (!this.sessionSyncInterval) {
      return;
    }

    clearInterval(this.sessionSyncInterval);
    this.sessionSyncInterval = undefined;
  }

  private syncSessionsFromStore(): void {
    if (!this.currentView || !this.currentView.visible) {
      return;
    }

    const sessions = this.sessionStore.list();
    const nextSignature = this.createSessionSignature(sessions);
    if (nextSignature === this.sessionSignature) {
      return;
    }

    this.sessionSignature = nextSignature;
    this.render(this.currentView);
  }

  private createSessionSignature(sessions: SavedCodexSession[]): string {
    return JSON.stringify(
      sessions.map((session) => ({
        openedAt: session.openedAt,
        resource: session.resource,
        status: session.status,
        title: session.title,
        updatedAt: session.updatedAt
      }))
    );
  }

  private async runCommandAndMaybeClose(command: string, payload?: { resource: string }): Promise<void> {
    const autoCloseSidebar = this.globalState.get<boolean>(AUTO_CLOSE_SIDEBAR_SETTING_KEY, true);
    const opened = await vscode.commands.executeCommand<boolean>(command, payload);

    if (opened && autoCloseSidebar) {
      await vscode.commands.executeCommand("workbench.action.closeSidebar");
    }
  }

  private render(webviewView: vscode.WebviewView): void {
    const cspSource = webviewView.webview.cspSource;
    const nonce = getNonce();
    const autoCloseSidebar = this.globalState.get<boolean>(AUTO_CLOSE_SIDEBAR_SETTING_KEY, true);
    const experimentalMultiTab = this.globalState.get<boolean>(EXPERIMENTAL_MULTI_TAB_SETTING_KEY, false);

    webviewView.webview.html = this.getHtml(
      cspSource,
      nonce,
      autoCloseSidebar,
      experimentalMultiTab,
      this.sessionStore.list()
    );
  }

  private getHtml(
    cspSource: string,
    nonce: string,
    autoCloseSidebar: boolean,
    experimentalMultiTab: boolean,
    sessions: SavedCodexSession[]
  ): string {
    const sessionMarkup =
      sessions.length > 0
        ? sessions
            .map((session) => {
              const title = escapeHtml(session.title);
              const time = escapeHtml(formatRelativeTime(session.updatedAt));
              const resource = escapeAttribute(session.resource);

              return `<li>
                <button class="session-item" type="button" data-session-resource="${resource}">
                  <span class="session-copy">
                    <span class="session-title">${title}</span>
                    <span class="session-status">${escapeHtml(session.status)}</span>
                  </span>
                  <span class="session-meta">
                    <span class="session-time">${time}</span>
                  </span>
                </button>
              </li>`;
            })
            .join("")
        : `<li class="session-empty">Send one message in Codex and it will appear here.</li>`;

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${cspSource} data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        color-scheme: light dark;
      }

      html {
        height: 100%;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        height: 100%;
        font-family: var(--vscode-font-family);
        background: var(--vscode-sideBar-background);
        color: var(--vscode-foreground);
      }

      .container {
        position: fixed;
        inset: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 14px 0;
        overflow: hidden;
      }

      .launcher {
        padding: 0 14px;
      }

      .button {
        width: 100%;
        border: 1px solid color-mix(in srgb, var(--vscode-button-background) 80%, white 16%);
        border-radius: 8px;
        padding: 10px 16px;
        font: inherit;
        font-size: 14px;
        font-weight: 500;
        color: var(--vscode-button-foreground);
        background: color-mix(in srgb, var(--vscode-button-background) 94%, #0078d4 6%);
        cursor: pointer;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        transition: background-color 140ms ease, border-color 140ms ease, filter 140ms ease;
      }

      .button:hover {
        background: color-mix(in srgb, var(--vscode-button-hoverBackground) 92%, #0078d4 8%);
        border-color: color-mix(in srgb, var(--vscode-button-hoverBackground) 74%, white 18%);
      }

      .button:active {
        filter: brightness(0.98);
      }

      .button:focus-visible,
      .session-item:focus-visible {
        outline: 2px solid var(--vscode-focusBorder);
        outline-offset: 2px;
      }

      .section-title {
        margin: 0;
        padding: 0 14px;
        font-size: 13px;
        font-weight: 700;
        color: var(--vscode-foreground);
      }

      .sessions-panel {
        min-height: 0;
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .session-list-wrap {
        flex: 1 1 auto;
        margin: 0 8px;
        min-height: 0;
        overflow-y: auto;
      }

      .session-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .session-item {
        width: 100%;
        border: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px 10px;
        align-items: start;
        padding: 8px 10px;
        border-radius: 6px;
        font: inherit;
        text-align: left;
        color: inherit;
        background: transparent;
        cursor: pointer;
      }

      .session-item:hover {
        background: color-mix(in srgb, var(--vscode-list-hoverBackground) 70%, transparent);
      }

      .session-copy {
        display: grid;
        min-width: 0;
        gap: 2px;
      }

      .session-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 13px;
        line-height: 1.3;
        font-weight: 600;
        color: var(--vscode-foreground);
      }

      .session-status {
        font-size: 11px;
        line-height: 1.25;
        color: var(--vscode-descriptionForeground);
      }

      .session-meta {
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
        color: var(--vscode-descriptionForeground);
      }

      .session-time {
        font-size: 11px;
        line-height: 1.25;
      }

      .session-empty {
        padding: 4px 10px 0;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }

      .settings {
        display: grid;
        gap: 10px;
        padding: 0 14px 2px;
      }

      .toggle {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 12px;
        line-height: 1.35;
        color: var(--vscode-descriptionForeground);
        user-select: none;
      }

      .toggle input {
        margin: 0;
        width: 16px;
        height: 16px;
        flex: 0 0 16px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="launcher">
        <button class="button" id="open-codex" type="button">Open New Codex</button>
      </div>
      <div class="sessions-panel">
        <h2 class="section-title">Sessions</h2>
        <div class="session-list-wrap">
          <ul class="session-list">${sessionMarkup}</ul>
        </div>
      </div>
      <div class="settings">
        <label class="toggle" for="auto-close">
          <input id="auto-close" type="checkbox" ${autoCloseSidebar ? "checked" : ""} />
          <span>Success then close sidebar</span>
        </label>
        <label class="toggle" for="experimental-multi-tab">
          <input id="experimental-multi-tab" type="checkbox" ${experimentalMultiTab ? "checked" : ""} />
          <span>Experimental multiple tabs</span>
        </label>
      </div>
    </div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const button = document.getElementById('open-codex');
      const autoClose = document.getElementById('auto-close');
      const experimentalMultiTab = document.getElementById('experimental-multi-tab');
      const sessionButtons = document.querySelectorAll('[data-session-resource]');

      button?.addEventListener('click', () => {
        vscode.postMessage({ type: 'open-codex' });
      });

      sessionButtons.forEach(buttonElement => {
        buttonElement.addEventListener('click', () => {
          const resource = buttonElement.getAttribute('data-session-resource') ?? '';
          vscode.postMessage({
            type: 'resume-codex-session',
            resource
          });
        });
      });

      autoClose?.addEventListener('change', event => {
        const target = event.target;
        vscode.postMessage({
          type: 'set-auto-close',
          enabled: Boolean(target && 'checked' in target && target.checked)
        });
      });

      experimentalMultiTab?.addEventListener('change', event => {
        const target = event.target;
        vscode.postMessage({
          type: 'set-experimental-multi-tab',
          enabled: Boolean(target && 'checked' in target && target.checked)
        });
      });
    </script>
  </body>
</html>`;
  }
}

const formatRelativeTime = (timestamp: string): string => {
  const parsedDate = new Date(timestamp);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const diffMs = Date.now() - parsedDate.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} d`;
};

const escapeAttribute = (value: string): string =>
  escapeHtml(value).replaceAll('"', "&quot;");

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const getNonce = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";

  for (let index = 0; index < 32; index += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return value;
};
