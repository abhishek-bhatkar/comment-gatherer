import * as vscode from 'vscode';
import * as path from 'path';
import { CommentInfo } from '../types';
import { CommentNode } from '../models/CommentNode';

export class CommentTreeProvider implements vscode.TreeDataProvider<CommentNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<CommentNode | undefined | void> = new vscode.EventEmitter<CommentNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<CommentNode | undefined | void> = this._onDidChangeTreeData.event;

    private comments: CommentInfo[] = [];
    private sortOrder: 'file' | 'type' = 'file';
    private filter: string = '';

    refresh(comments: CommentInfo[]): void {
        this.comments = comments;
        this._onDidChangeTreeData.fire();
    }

    setSortOrder(order: 'file' | 'type'): void {
        this.sortOrder = order;
        this._onDidChangeTreeData.fire();
    }

    setFilter(filter: string): void {
        this.filter = filter.toLowerCase();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CommentNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CommentNode): Thenable<CommentNode[]> {
        if (!element) {
            // Root level
            if (this.sortOrder === 'file') {
                return Promise.resolve(this.getFileNodes());
            } else {
                return Promise.resolve(this.getTypeNodes());
            }
        } else if (element.contextValue === 'file' || element.contextValue === 'type') {
            // Show comments under file or type
            return Promise.resolve(this.getCommentNodes(element));
        }
        return Promise.resolve([]);
    }

    private getFileNodes(): CommentNode[] {
        const fileMap = new Map<string, CommentInfo[]>();
        
        this.comments.forEach(comment => {
            if (this.matchesFilter(comment)) {
                const file = comment.file;
                if (!fileMap.has(file)) {
                    fileMap.set(file, []);
                }
                fileMap.get(file)!.push(comment);
            }
        });

        return Array.from(fileMap.entries()).map(([file, comments]) => {
            const label = path.basename(file);
            return new CommentNode(
                label,
                vscode.TreeItemCollapsibleState.Collapsed,
                'file',
                file,
                `${comments.length} comment${comments.length === 1 ? '' : 's'}`,
                new vscode.ThemeIcon('file')
            );
        });
    }

    private getTypeNodes(): CommentNode[] {
        const typeMap = new Map<string, CommentInfo[]>();
        const typeLabels = {
            'single': 'Single-line Comments',
            'multi': 'Multi-line Comments',
            'doc': 'Documentation Comments'
        };

        this.comments.forEach(comment => {
            if (this.matchesFilter(comment)) {
                if (!typeMap.has(comment.type)) {
                    typeMap.set(comment.type, []);
                }
                typeMap.get(comment.type)!.push(comment);
            }
        });

        return Array.from(typeMap.entries()).map(([type, comments]) => {
            return new CommentNode(
                typeLabels[type as keyof typeof typeLabels],
                vscode.TreeItemCollapsibleState.Collapsed,
                'type',
                type,
                `${comments.length} comment${comments.length === 1 ? '' : 's'}`,
                new vscode.ThemeIcon('comment-discussion')
            );
        });
    }

    private getCommentNodes(parent: CommentNode): CommentNode[] {
        let filteredComments = this.comments.filter(comment => {
            if (!this.matchesFilter(comment)) return false;

            if (parent.contextValue === 'file') {
                return vscode.Uri.file(comment.file).fsPath === parent.resourceUri?.fsPath;
            } else if (parent.contextValue === 'type') {
                return comment.type === parent.resourceUri?.fsPath;
            }
            return false;
        });

        return filteredComments.map(comment => {
            const label = `[${comment.line + 1}] ${comment.text.split('\n')[0]}`;
            const tooltip = new vscode.MarkdownString();
            tooltip.appendCodeblock(comment.text);
            
            const node = new CommentNode(
                label,
                vscode.TreeItemCollapsibleState.None,
                'comment',
                comment.file,
                undefined,
                new vscode.ThemeIcon('comment')
            );
            
            node.tooltip = tooltip;
            node.command = {
                command: 'project-comment-gatherer.openComment',
                title: 'Open Comment',
                arguments: [comment]
            };
            
            return node;
        });
    }

    private matchesFilter(comment: CommentInfo): boolean {
        if (!this.filter) return true;
        return comment.text.toLowerCase().includes(this.filter);
    }

    isFileIgnored(filePath: string): boolean {
        // Add logic to check if file should be ignored (e.g., node_modules, .git)
        const ignoredPatterns = [
            'node_modules',
            '.git',
            'dist',
            'build',
            'out'
        ];
        return ignoredPatterns.some(pattern => filePath.includes(pattern));
    }
}
