import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';
import { CommentNode } from '../models/CommentNode';
import { CommentInfo, SortOrder } from '../types';
import { GitIgnoreManager } from '../utils/GitIgnoreManager';

export class CommentTreeProvider implements vscode.TreeDataProvider<CommentNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<CommentNode | undefined | null | void> = new vscode.EventEmitter<CommentNode | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CommentNode | undefined | null | void> = this._onDidChangeTreeData.event;

    private comments: Map<string, CommentInfo[]> = new Map();
    private sortOrder: SortOrder = 'file';
    private filterText: string = '';
    private gitIgnoreManager: GitIgnoreManager;

    constructor() {
        this.gitIgnoreManager = new GitIgnoreManager();
        this.initializeWatchers();
    }

    private initializeWatchers(): void {
        // Watch for file changes
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.*');
        watcher.onDidChange(() => this.refresh());
        watcher.onDidCreate(() => this.refresh());
        watcher.onDidDelete(() => this.refresh());
        
        // Watch for .gitignore changes
        const gitIgnoreWatcher = vscode.workspace.createFileSystemWatcher('**/.gitignore');
        gitIgnoreWatcher.onDidChange(() => this.gitIgnoreManager.init());
        gitIgnoreWatcher.onDidCreate(() => this.gitIgnoreManager.init());
        gitIgnoreWatcher.onDidDelete(() => this.gitIgnoreManager.init());
    }

    isFileIgnored(filePath: string): boolean {
        return this.gitIgnoreManager.isFileIgnored(filePath);
    }

    refresh(newComments?: CommentInfo[]): void {
        if (newComments) {
            // Group comments by file
            this.comments.clear();
            newComments.forEach(comment => {
                const file = comment.file;
                if (!this.comments.has(file)) {
                    this.comments.set(file, []);
                }
                this.comments.get(file)!.push(comment);
            });
        }
        this._onDidChangeTreeData.fire();
    }

    setSortOrder(order: SortOrder): void {
        this.sortOrder = order;
        this._onDidChangeTreeData.fire();
    }

    setFilter(text: string): void {
        this.filterText = text.toLowerCase();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CommentNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CommentNode): Thenable<CommentNode[]> {
        if (!element) {
            return this.getRootNodes();
        }
        return this.getChildNodes(element);
    }

    private getRootNodes(): Promise<CommentNode[]> {
        if (this.sortOrder === 'file') {
            return this.getFileBasedRootNodes();
        } else {
            return this.getTypeBasedRootNodes();
        }
    }

    private getFileBasedRootNodes(): Promise<CommentNode[]> {
        const nodes: CommentNode[] = [];
        this.comments.forEach((comments, file) => {
            if (this.filterText && !file.toLowerCase().includes(this.filterText)) {
                return;
            }
            nodes.push(new CommentNode(
                path.basename(file),
                vscode.TreeItemCollapsibleState.Collapsed,
                { type: 'file', description: file }
            ));
        });
        return Promise.resolve(nodes);
    }

    private getTypeBasedRootNodes(): Promise<CommentNode[]> {
        const types = ['single', 'multi', 'doc'];
        return Promise.resolve(types.map(type => 
            new CommentNode(
                type.charAt(0).toUpperCase() + type.slice(1) + ' Line Comments',
                vscode.TreeItemCollapsibleState.Collapsed,
                { type: 'category' }
            )
        ));
    }

    private getChildNodes(element: CommentNode): Promise<CommentNode[]> {
        if (element.metadata.type === 'file') {
            return this.getFileChildNodes(element);
        } else if (element.metadata.type === 'category') {
            return this.getCategoryChildNodes(element);
        }
        return Promise.resolve([]);
    }

    private getFileChildNodes(element: CommentNode): Promise<CommentNode[]> {
        const file = element.metadata.description as string;
        const comments = this.comments.get(file) || [];
        return Promise.resolve(comments
            .filter(comment => !this.filterText || comment.comment.toLowerCase().includes(this.filterText))
            .map(comment => new CommentNode(
                comment.comment,
                vscode.TreeItemCollapsibleState.None,
                { type: 'comment', comment }
            ))
        );
    }

    private getCategoryChildNodes(element: CommentNode): Promise<CommentNode[]> {
        const type = (element.label as string).split(' ')[0].toLowerCase() as 'single' | 'multi' | 'doc';
        const nodes: CommentNode[] = [];
        this.comments.forEach((comments, file) => {
            comments
                .filter(comment => comment.type === type)
                .filter(comment => !this.filterText || comment.comment.toLowerCase().includes(this.filterText))
                .forEach(comment => {
                    nodes.push(new CommentNode(
                        comment.comment,
                        vscode.TreeItemCollapsibleState.None,
                        { type: 'comment', comment, description: file }
                    ));
                });
        });
        return Promise.resolve(nodes);
    }
}
