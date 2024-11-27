import * as vscode from 'vscode';
import { CommentNodeMetadata } from '../types';

export class CommentNode extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public metadata: CommentNodeMetadata
    ) {
        super(label, collapsibleState);
        this.tooltip = metadata.description || label;
        this.description = metadata.description;
        this.contextValue = metadata.type;
        
        if (metadata.iconPath) {
            this.iconPath = metadata.iconPath;
        }

        if (metadata.type === 'comment' && metadata.comment) {
            this.command = {
                command: 'project-comment-gatherer.openComment',
                title: 'Open Comment',
                arguments: [metadata.comment]
            };
        }
    }
}
