export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2
}

export class ThemeIcon {
  public constructor(public readonly id: string) {}
}

export class TreeItem {
  public command?: { command: string; title: string };
  public description?: string;
  public iconPath?: ThemeIcon;

  public constructor(
    public readonly label: string,
    public readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None
  ) {}
}

export const commands = {
  executeCommand: async () => undefined,
  getCommands: async () => [],
  registerCommand: () => ({
    dispose: () => undefined
  })
};

export const extensions = {
  getExtension: () => undefined
};

export const version = "test";

export const window = {
  createOutputChannel: () => ({
    appendLine: () => undefined,
    dispose: () => undefined,
    show: () => undefined
  }),
  createTreeView: () => ({
    dispose: () => undefined,
    onDidChangeVisibility: () => ({
      dispose: () => undefined
    }),
    visible: false
  }),
  showErrorMessage: async () => undefined,
  showInformationMessage: async () => undefined
};
