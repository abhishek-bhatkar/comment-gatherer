import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

export class GitIgnoreManager {
    private gitIgnore: ReturnType<typeof ignore> | undefined;

    constructor() {
        this.init();
    }

    init(): void {
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
}
