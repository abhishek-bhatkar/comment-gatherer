import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

interface CommentInfo {
    file: string;
    line: number;
    comment: string;
    type: 'single' | 'multi' | 'doc';
    fileType: string;
}

interface FileStats {
    totalComments: number;
    singleLineComments: number;
    multiLineComments: number;
    docComments: number;
}

class CommentTreeProvider implements vscode.TreeDataProvider<CommentNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<CommentNode | undefined | null | void> = new vscode.EventEmitter<CommentNode | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CommentNode | undefined | null | void> = this._onDidChangeTreeData.event;

    private comments: Map<string, CommentInfo[]> = new Map();
    private sortOrder: 'file' | 'type' = 'file';
    private filterText: string = '';
    private gitIgnore: ReturnType<typeof ignore> | undefined;

    constructor() {
        // Initialize gitignore
        this.initGitIgnore();
        
        // Watch for file changes
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.*');
        watcher.onDidChange(() => this.refresh());
        watcher.onDidCreate(() => this.refresh());
        watcher.onDidDelete(() => this.refresh());
        
        // Watch for .gitignore changes
        const gitIgnoreWatcher = vscode.workspace.createFileSystemWatcher('**/.gitignore');
        gitIgnoreWatcher.onDidChange(() => this.initGitIgnore());
        gitIgnoreWatcher.onDidCreate(() => this.initGitIgnore());
        gitIgnoreWatcher.onDidDelete(() => this.initGitIgnore());
    }

    private initGitIgnore(): void {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const gitIgnorePath = path.join(rootPath, '.gitignore');

        if (fs.existsSync(gitIgnorePath)) {
            const gitIgnoreContent = fs.readFileSync(gitIgnorePath, 'utf8');
            this.gitIgnore = ignore().add(gitIgnoreContent);
        } else {
            this.gitIgnore = undefined;
        }
    }

    isFileIgnored(filePath: string): boolean {
        if (!this.gitIgnore) {
            return false;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return false;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const relativePath = path.relative(rootPath, filePath);
        
        return this.gitIgnore.ignores(relativePath);
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

    setSortOrder(order: 'file' | 'type'): void {
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
            // Root level - show files
            return Promise.resolve(
                Array.from(this.comments.entries())
                    .filter(([file, comments]) => 
                        !this.isFileIgnored(file) &&
                        (this.filterText === '' || 
                        comments.some(c => c.comment.toLowerCase().includes(this.filterText)) ||
                        file.toLowerCase().includes(this.filterText))
                    )
                    .map(([file, comments]) => new CommentNode(
                        path.basename(file),
                        vscode.TreeItemCollapsibleState.Expanded,
                        {
                            file,
                            type: 'file',
                            iconPath: this.getFileIcon(file),
                            description: `${comments.length} comments`
                        }
                    ))
            );
        } else if (element.contextValue === 'file') {
            // File level - show comments
            const fileComments = this.comments.get(element.metadata.file) || [];
            return Promise.resolve(
                fileComments
                    .filter(comment => 
                        this.filterText === '' || 
                        comment.comment.toLowerCase().includes(this.filterText)
                    )
                    .map(comment => new CommentNode(
                        `#${comment.line}`,
                        vscode.TreeItemCollapsibleState.None,
                        {
                            comment,
                            type: 'comment',
                            description: comment.comment
                        }
                    ))
            );
        }
        return Promise.resolve([]);
    }

    private getFileIcon(filePath: string): vscode.ThemeIcon {
        const extension = path.extname(filePath).toLowerCase();
        switch (extension) {
            case '.ts':
            case '.tsx':
                return new vscode.ThemeIcon('typescript');
            case '.js':
            case '.jsx':
                return new vscode.ThemeIcon('javascript');
            case '.py':
                return new vscode.ThemeIcon('python');
            case '.java':
                return new vscode.ThemeIcon('java');
            default:
                return new vscode.ThemeIcon('file-code');
        }
    }

    getStats(): FileStats {
        let stats: FileStats = {
            totalComments: 0,
            singleLineComments: 0,
            multiLineComments: 0,
            docComments: 0
        };

        this.comments.forEach(comments => {
            comments.forEach(comment => {
                stats.totalComments++;
                switch (comment.type) {
                    case 'single':
                        stats.singleLineComments++;
                        break;
                    case 'multi':
                        stats.multiLineComments++;
                        break;
                    case 'doc':
                        stats.docComments++;
                        break;
                }
            });
        });

        return stats;
    }
}

class CommentNode extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public metadata: any
    ) {
        super(label, collapsibleState);
        this.tooltip = metadata.description || label;
        this.description = metadata.description;
        this.contextValue = metadata.type;
        
        if (metadata.iconPath) {
            this.iconPath = metadata.iconPath;
        }

        if (metadata.type === 'comment') {
            this.command = {
                command: 'project-comment-gatherer.openComment',
                title: 'Open Comment',
                arguments: [metadata.comment]
            };
        }
    }
}

export async function activate(context: vscode.ExtensionContext) {
    const commentProvider = new CommentTreeProvider();
    const treeView = vscode.window.createTreeView('commentList', {
        treeDataProvider: commentProvider,
        showCollapseAll: true
    });

    // Function to gather comments
    async function gatherComments() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const comments: CommentInfo[] = [];

        const supportedExtensions = [
            '.js', '.ts', '.jsx', '.tsx', '.py', '.java', 
            '.cpp', '.c', '.h', '.hpp', '.cs', '.go', 
            '.rb', '.php', '.swift', '.kt', '.scala', '.rs'
        ];

        function findComments(dir: string) {
            const files = fs.readdirSync(dir);
            
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                    findComments(filePath);
                } else if (stat.isFile() && supportedExtensions.includes(path.extname(filePath).toLowerCase())) {
                    if (!commentProvider.isFileIgnored(filePath)) {
                        extractCommentsFromFile(filePath, comments);
                    }
                }
            }
        }

        function extractCommentsFromFile(filePath: string, comments: CommentInfo[]) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const lines = content.split('\n');
                let inMultiLineComment = false;
                let multiLineBuffer = '';
                let multiLineStart = 0;
                
                lines.forEach((line, index) => {
                    const fileType = path.extname(filePath);
                    
                    if (!inMultiLineComment) {
                        // Check for single-line comments
                        const singleLineMatch = line.match(/^\s*(\/\/|#)(.*)/);
                        if (singleLineMatch) {
                            comments.push({
                                file: filePath,
                                line: index + 1,
                                comment: singleLineMatch[2].trim(),
                                type: 'single',
                                fileType
                            });
                        }

                        // Check for documentation comments
                        const docCommentMatch = line.match(/^\s*\/\*\*(.*)/);
                        if (docCommentMatch) {
                            inMultiLineComment = true;
                            multiLineBuffer = docCommentMatch[1];
                            multiLineStart = index + 1;
                            return;
                        }

                        // Check for multi-line comments
                        const multiLineMatch = line.match(/^\s*\/\*(.*)/);
                        if (multiLineMatch) {
                            inMultiLineComment = true;
                            multiLineBuffer = multiLineMatch[1];
                            multiLineStart = index + 1;
                            return;
                        }
                    }

                    if (inMultiLineComment) {
                        const endMatch = line.match(/.*\*\/(.*)/);
                        if (endMatch) {
                            inMultiLineComment = false;
                            multiLineBuffer += ' ' + endMatch[1];
                            comments.push({
                                file: filePath,
                                line: multiLineStart,
                                comment: multiLineBuffer.replace(/\*/g, '').trim(),
                                type: multiLineBuffer.startsWith('*') ? 'doc' : 'multi',
                                fileType
                            });
                        } else {
                            multiLineBuffer += ' ' + line.replace(/^\s*\*?\s?/, '');
                        }
                    }
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Error reading file ${filePath}: ${error}`);
            }
        }

        findComments(rootPath);
        commentProvider.refresh(comments);
        
        const stats = commentProvider.getStats();
        vscode.window.showInformationMessage(
            `Found ${stats.totalComments} comments: ` +
            `${stats.singleLineComments} single-line, ` +
            `${stats.multiLineComments} multi-line, ` +
            `${stats.docComments} documentation`
        );
    }

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('project-comment-gatherer.gatherComments', gatherComments),
        
        vscode.commands.registerCommand('project-comment-gatherer.openComment', async (comment: CommentInfo) => {
            const document = await vscode.workspace.openTextDocument(comment.file);
            const editor = await vscode.window.showTextDocument(document);
            const position = new vscode.Position(comment.line - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }),

        vscode.commands.registerCommand('project-comment-gatherer.sortByFile', () => {
            commentProvider.setSortOrder('file');
        }),

        vscode.commands.registerCommand('project-comment-gatherer.sortByType', () => {
            commentProvider.setSortOrder('type');
        }),

        vscode.commands.registerCommand('project-comment-gatherer.filterComments', async () => {
            const filter = await vscode.window.showInputBox({
                prompt: 'Enter text to filter comments',
                placeHolder: 'Filter text...'
            });
            if (filter !== undefined) {
                commentProvider.setFilter(filter);
            }
        }),

        vscode.commands.registerCommand('project-comment-gatherer.exportComments', async () => {
            const stats = commentProvider.getStats();
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;

            const exportPath = path.join(workspaceFolders[0].uri.fsPath, 'comments-export.md');
            const content = generateMarkdownReport(commentProvider, stats);
            
            fs.writeFileSync(exportPath, content);
            vscode.window.showInformationMessage(`Comments exported to ${exportPath}`);
        })
    );

    // Automatically gather comments when the extension activates
    setTimeout(gatherComments, 1000);
}

function generateMarkdownReport(provider: CommentTreeProvider, stats: FileStats): string {
    const now = new Date().toLocaleString();
    return `# Project Comments Report
Generated: ${now}

## Statistics
- Total Comments: ${stats.totalComments}
- Single-line Comments: ${stats.singleLineComments}
- Multi-line Comments: ${stats.multiLineComments}
- Documentation Comments: ${stats.docComments}

## Comments by File
${Array.from(provider['comments'].entries()).map(([file, comments]) => `
### ${file}
${comments.map(c => `- Line ${c.line}: ${c.comment}`).join('\n')}`).join('\n')}
`;
}

export function deactivate() {}
