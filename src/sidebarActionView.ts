import type * as vscode from "vscode";

import { SIDEBAR_VIEW_ID } from "./types";

export class CodexSidebarActionProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  public static readonly viewType = SIDEBAR_VIEW_ID;

  public getTreeItem(treeItem: vscode.TreeItem): vscode.TreeItem {
    return treeItem;
  }

  public getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
    if (element) {
      return [];
    }

    return [];
  }
}
