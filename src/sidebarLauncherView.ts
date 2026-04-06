import * as vscode from "vscode";

import {
  AUTO_CLOSE_SIDEBAR_SETTING_KEY,
  EXPERIMENTAL_MULTI_TAB_SETTING_KEY,
  OPEN_NEW_CODEX_CHAT_COMMAND
} from "./types";

export class SidebarLauncherViewProvider implements vscode.WebviewViewProvider {
  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly globalState: vscode.Memento
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    const cspSource = webviewView.webview.cspSource;
    const nonce = getNonce();
    let autoCloseSidebar = this.globalState.get<boolean>(AUTO_CLOSE_SIDEBAR_SETTING_KEY, true);
    let experimentalMultiTab = this.globalState.get<boolean>(EXPERIMENTAL_MULTI_TAB_SETTING_KEY, false);

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = this.getHtml(cspSource, nonce, autoCloseSidebar, experimentalMultiTab);
    webviewView.webview.onDidReceiveMessage(async message => {
      if (!message || typeof message !== "object" || !("type" in message)) {
        return;
      }

      if (message.type === "set-auto-close") {
        const enabled = "enabled" in message && typeof message.enabled === "boolean" ? message.enabled : true;
        autoCloseSidebar = enabled;
        await this.globalState.update(AUTO_CLOSE_SIDEBAR_SETTING_KEY, enabled);
        return;
      }

      if (message.type === "set-experimental-multi-tab") {
        const enabled = "enabled" in message && typeof message.enabled === "boolean" ? message.enabled : false;
        experimentalMultiTab = enabled;
        await this.globalState.update(EXPERIMENTAL_MULTI_TAB_SETTING_KEY, enabled);
        return;
      }

      if (message.type === "open-codex") {
        const opened = await vscode.commands.executeCommand<boolean>(OPEN_NEW_CODEX_CHAT_COMMAND);
        if (opened && autoCloseSidebar) {
          await vscode.commands.executeCommand("workbench.action.closeSidebar");
        }
      }
    });
  }

  private getHtml(
    cspSource: string,
    nonce: string,
    autoCloseSidebar: boolean,
    experimentalMultiTab: boolean
  ): string {
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

      body {
        margin: 0;
        padding: 16px;
        font-family: var(--vscode-font-family);
        background: var(--vscode-sideBar-background);
        color: var(--vscode-foreground);
      }

      .container {
        display: grid;
        gap: 12px;
      }

      .button {
        width: 100%;
        border: 0;
        border-radius: 14px;
        padding: 14px 16px;
        font: inherit;
        font-weight: 700;
        color: var(--vscode-button-foreground);
        background:
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--vscode-button-background) 82%, black 18%) 0%,
            color-mix(in srgb, var(--vscode-button-background) 96%, black 4%) 100%
          );
        cursor: pointer;
        box-shadow:
          0 10px 20px color-mix(in srgb, var(--vscode-button-background) 18%, transparent),
          inset 0 1px 0 rgba(255, 255, 255, 0.1);
        transition:
          transform 140ms ease,
          box-shadow 140ms ease,
          filter 140ms ease;
      }

      .button:hover {
        transform: translateY(-1px);
        filter: brightness(1.02);
      }

      .button:active {
        transform: translateY(0);
        box-shadow:
          0 6px 14px color-mix(in srgb, var(--vscode-button-background) 14%, transparent),
          inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }

      .button:focus-visible {
        outline: 2px solid var(--vscode-focusBorder);
        outline-offset: 2px;
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
      <button class="button" id="open-codex" type="button">Open New Codex</button>
      <label class="toggle" for="auto-close">
        <input id="auto-close" type="checkbox" ${autoCloseSidebar ? "checked" : ""} />
        <span>Success then close sidebar</span>
      </label>
      <label class="toggle" for="experimental-multi-tab">
        <input id="experimental-multi-tab" type="checkbox" ${experimentalMultiTab ? "checked" : ""} />
        <span>Experimental multiple tabs</span>
      </label>
    </div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const button = document.getElementById('open-codex');
      const autoClose = document.getElementById('auto-close');
      const experimentalMultiTab = document.getElementById('experimental-multi-tab');
      button?.addEventListener('click', () => {
        vscode.postMessage({ type: 'open-codex' });
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

const getNonce = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";

  for (let index = 0; index < 32; index += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return value;
};
