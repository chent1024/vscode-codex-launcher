# Open Codex

<p align="center">
  <img src="media/codex-launcher.png" alt="Open Codex icon" width="96" />
</p>

Open Codex is a minimal VS Code extension that adds a launcher for opening a fresh Codex chat from the sidebar. It delegates to the installed OpenAI ChatGPT extension instead of implementing its own chat UI.

## Features

- Adds an `Open Codex` entry to the VS Code activity bar
- Provides a single `Open New Codex Chat` action in the sidebar
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

## Usage

1. Install and enable the OpenAI ChatGPT extension.
2. Open the `Open Codex` icon in the activity bar.
3. Click `Open New Codex Chat`.
4. A fresh Codex panel is opened by the OpenAI extension.

## Development

```bash
npm install
npm run lint
npm run build
npm test
```

Key files:

- `src/extension.ts`: extension activation and command registration
- `src/compat.ts`: compatibility checks and launch flow
- `src/sidebarActionView.ts`: minimal sidebar action view

## Repository

- Repository: `https://github.com/chent1024/vscode-codex-launcher.git`
- Issues: `https://github.com/chent1024/vscode-codex-launcher/issues`
