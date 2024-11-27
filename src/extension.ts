import * as vscode from 'vscode';
import { CommentTreeProvider } from './providers/CommentTreeProvider';
import { CommentParser } from './services/CommentParser';
import { generateMarkdownReport } from './utils/reportGenerator';
import { CommentInfo, FileStats } from './types';

export async function activate(context: vscode.ExtensionContext) {
    const commentTreeProvider = new CommentTreeProvider();
    const treeView = vscode.window.createTreeView('commentList', {
        treeDataProvider: commentTreeProvider,
        showCollapseAll: true
    });

    let disposable = vscode.commands.registerCommand('project-comment-gatherer.gatherComments', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const progress = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Gathering comments...",
            cancellable: true
        }, async (progress, token) => {
            const allComments: CommentInfo[] = [];
            const stats: FileStats = {
                totalComments: 0,
                singleLineComments: 0,
                multiLineComments: 0,
                docComments: 0
            };

            for (const folder of workspaceFolders) {
                const files = await vscode.workspace.findFiles('**/*.*', '**/node_modules/**');
                
                for (const file of files) {
                    if (token.isCancellationRequested) {
                        return;
                    }

                    if (commentTreeProvider.isFileIgnored(file.fsPath)) {
                        continue;
                    }

                    progress.report({ message: `Processing ${file.fsPath}` });
                    
                    const comments = await CommentParser.parseFile(file.fsPath);
                    allComments.push(...comments);
                    
                    // Update stats
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
                }
            }

            commentTreeProvider.refresh(allComments);
            return stats;
        });

        if (progress) {
            const report = generateMarkdownReport(progress);
            const doc = await vscode.workspace.openTextDocument({
                content: report,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc, { preview: true });
        }
    });

    context.subscriptions.push(
        disposable,
        vscode.commands.registerCommand('project-comment-gatherer.sortByFile', () => {
            commentTreeProvider.setSortOrder('file');
        }),
        vscode.commands.registerCommand('project-comment-gatherer.sortByType', () => {
            commentTreeProvider.setSortOrder('type');
        }),
        vscode.commands.registerCommand('project-comment-gatherer.filterComments', async () => {
            const filter = await vscode.window.showInputBox({
                prompt: 'Enter text to filter comments',
                placeHolder: 'Filter text'
            });
            if (filter !== undefined) {
                commentTreeProvider.setFilter(filter);
            }
        }),
        vscode.commands.registerCommand('project-comment-gatherer.openComment', (comment: CommentInfo) => {
            vscode.workspace.openTextDocument(comment.file).then(doc => {
                vscode.window.showTextDocument(doc).then(editor => {
                    const position = new vscode.Position(comment.line, 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(
                        new vscode.Range(position, position),
                        vscode.TextEditorRevealType.InCenter
                    );
                });
            });
        }),
        treeView
    );

    // Initial comment gathering
    vscode.commands.executeCommand('project-comment-gatherer.gatherComments');
}

export function deactivate() {}
