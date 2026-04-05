# Codex Launcher

Codex Launcher is a lightweight VS Code extension bridge. It opens a new Codex chat window by delegating to the installed OpenAI ChatGPT extension.

## What It Does

- Adds a dedicated `Codex Launcher` entry in the left activity bar
- Shows a single explicit `Open New Codex Chat` action in the sidebar
- Opens a fresh Codex chat only when that launcher action is clicked
- Writes diagnostic logs to the `Codex Launcher` output channel when launch fails

## Requirements

- VS Code `^1.96.0`
- The `openai.chatgpt` extension must be installed and enabled
- The installed OpenAI extension must expose the `chatgpt.newCodexPanel` command

## Limitations

- This extension does not implement its own chat UI
- It does not read or modify Codex internal storage
- It intentionally keeps the sidebar to a single launcher action
- Compatibility depends on the OpenAI extension continuing to expose the required command

## Usage

1. Install the OpenAI ChatGPT extension.
2. Click the `Codex Launcher` icon in the left activity bar.
3. Click `Open New Codex Chat` in the sidebar.
4. The extension opens a fresh Codex chat.

## Development

```bash
npm install
npm run lint
npm run build
npm test
```

The extension entry point is `src/extension.ts`.
