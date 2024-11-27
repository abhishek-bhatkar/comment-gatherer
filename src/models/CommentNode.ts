import * as vscode from 'vscode';

export class CommentNode extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        resourceUri: string,
        description?: string,
        iconPath?: vscode.ThemeIcon
    ) {
        super(label, collapsibleState);
        this.contextValue = contextValue;
        this.resourceUri = vscode.Uri.file(resourceUri);
        this.description = description;
        this.iconPath = iconPath;
    }
}
