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
npm run package:vsix
code --install-extension .tmp/chent.open-codex-0.0.1.vsix --force
```

If you use Cursor or another VS Code-compatible editor, replace `code` with the corresponding CLI command.

For local development, the generated `.vsix` file is versioned, for example:

```bash
.tmp/chent.open-codex-0.0.1.vsix
```

## GitHub Releases

If the extension is not available on the VS Code Marketplace yet, attach the generated `.vsix` file to each GitHub Release.

Recommended release flow:

```bash
npm install
npm run package:vsix
```

Then upload the generated file from `.tmp/`, for example:

```bash
.tmp/chent.open-codex-0.0.1.vsix
```

Manual install instructions for release notes:

```bash
code --install-extension chent.open-codex-0.0.1.vsix --force
```

If the user downloaded the file to another location, replace the filename with the actual local path.

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
