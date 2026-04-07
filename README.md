# Open Codex

<p align="center">
  <img src="media/codex-launcher.png" alt="Open Codex icon" width="96" />
</p>

Open Codex is a minimal VS Code extension that opens fresh Codex tabs from the sidebar, status bar, or command palette. It delegates to the installed OpenAI ChatGPT extension instead of implementing its own chat UI.

## Features

- Restores an `Open Codex` icon in the VS Code activity bar with a single modern launcher button
- Adds an `Open Codex` button to the VS Code status bar
- Provides an `Open Codex: Open New Codex` command in the command palette
- Calls the OpenAI extension command `chatgpt.newCodexPanel`
- Writes launch failures to the `Open Codex` output channel

## Requirements

- VS Code `^1.96.0`
- The `openai.chatgpt` extension must be installed and enabled
- The installed OpenAI extension must expose the `chatgpt.newCodexPanel` command

> [!NOTE]
> This project is a lightweight launcher only. It does not manage Codex sessions, read Codex storage, or replace the official Codex UI.

## Installation

You can package and install the extension locally:

```bash
npm install
npx @vscode/vsce package
code --install-extension chent.open-codex
```

For local `.vsix` installation, replace the Marketplace identifier with the generated package filename. If you use Cursor or another VS Code-compatible editor, replace `code` with the corresponding CLI command.

For local development, you can also use the one-click script to build, package, install, and reload the editor window:

```bash
npm run install:reload
```

Optional flags:

- `bash ./scripts/install-and-reload.sh --cli cursor`
- `bash ./scripts/install-and-reload.sh --no-reload`
- `bash ./scripts/install-and-reload.sh --skip-npm-install`

## Usage

1. Install and enable the OpenAI ChatGPT extension.
2. Click the `Open Codex` activity bar icon and press `Open New Codex`, click the `Open Codex` status bar button, or run `Open Codex: Open New Codex` from the command palette.
3. A fresh Codex tab is opened by the OpenAI extension.

## Development

```bash
npm install
npm run lint
npm run build
npm test
```

Key files:

- `src/extension.ts`: extension activation, sidebar view, and command registration
- `src/compat.ts`: compatibility checks and launch flow
- `src/sidebarLauncherView.ts`: minimal sidebar launcher item

## Repository

- Repository: `https://github.com/chent1024/vscode-codex-launcher.git`
- Issues: `https://github.com/chent1024/vscode-codex-launcher/issues`
