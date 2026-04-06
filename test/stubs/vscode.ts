export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2
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

export const Uri = {
  file: (path: string) => ({
    authority: "",
    fsPath: path,
    path,
    query: "",
    scheme: "file",
    with: ({ authority, query, scheme }: { authority?: string; query?: string; scheme?: string }) => ({
      authority: authority ?? "",
      fsPath: path,
      path,
      query: query ?? "",
      scheme: scheme ?? "file"
    })
  }),
  joinPath: (base: { path: string; scheme?: string }, ...paths: string[]) => ({
    authority: "",
    fsPath: [base.path, ...paths].join("/").replace(/\/+/g, "/"),
    path: [base.path, ...paths].join("/").replace(/\/+/g, "/"),
    query: "",
    scheme: base.scheme ?? "file"
  })
};

export const extensions = {
  getExtension: () => undefined
};

export const version = "test";

export const env = {
  clipboard: {
    writeText: async () => undefined
  }
};

export const window = {
  createOutputChannel: () => ({
    appendLine: () => undefined,
    dispose: () => undefined,
    show: () => undefined
  }),
  createStatusBarItem: () => ({
    command: "",
    dispose: () => undefined,
    show: () => undefined,
    text: "",
    tooltip: ""
  }),
  registerWebviewViewProvider: () => ({
    dispose: () => undefined
  }),
  showErrorMessage: async () => undefined,
  showInformationMessage: async () => undefined
};
