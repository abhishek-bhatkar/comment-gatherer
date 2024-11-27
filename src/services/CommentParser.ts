import * as vscode from 'vscode';
import * as path from 'path';
import { CommentInfo } from '../types';

export class CommentParser {
    private static readonly SINGLE_LINE_COMMENT_MARKERS: { [key: string]: string[] } = {
        'javascript': ['//'],
        'typescript': ['//'],
        'python': ['#'],
        'ruby': ['#'],
        'php': ['//'],
        'java': ['//'],
        'c': ['//'],
        'cpp': ['//'],
        'csharp': ['//'],
        'go': ['//'],
        'rust': ['//'],
        'swift': ['//'],
        'kotlin': ['//', '///'],
    };

    private static readonly MULTI_LINE_COMMENT_MARKERS: { [key: string]: { start: string; end: string }[] } = {
        'javascript': [{ start: '/*', end: '*/' }],
        'typescript': [{ start: '/*', end: '*/' }],
        'python': [{ start: '"""', end: '"""' }, { start: "'''", end: "'''" }],
        'php': [{ start: '/*', end: '*/' }],
        'java': [{ start: '/*', end: '*/' }],
        'c': [{ start: '/*', end: '*/' }],
        'cpp': [{ start: '/*', end: '*/' }],
        'csharp': [{ start: '/*', end: '*/' }],
        'go': [{ start: '/*', end: '*/' }],
        'rust': [{ start: '/*', end: '*/' }],
        'swift': [{ start: '/*', end: '*/' }],
        'kotlin': [{ start: '/*', end: '*/' }],
    };

    private static readonly DOC_COMMENT_MARKERS: { [key: string]: { start: string; end?: string }[] } = {
        'javascript': [{ start: '/**', end: '*/' }],
        'typescript': [{ start: '/**', end: '*/' }],
        'python': [{ start: '"""' }, { start: "'''" }],
        'java': [{ start: '/**', end: '*/' }],
        'php': [{ start: '/**', end: '*/' }],
        'go': [{ start: '//' }],
        'rust': [{ start: '///' }],
        'swift': [{ start: '///' }],
        'kotlin': [{ start: '///' }],
    };

    static async parseFile(filePath: string): Promise<CommentInfo[]> {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const fileType = this.getFileType(document);
            const comments: CommentInfo[] = [];

            let inMultiLineComment = false;
            let multiLineCommentStart = 0;
            let currentMultiLineMarker: { start: string; end: string } | undefined;

            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i).text.trim();

                if (!inMultiLineComment) {
                    // Check for single-line comments
                    const singleLineComment = this.parseSingleLineComment(line, fileType, i, filePath);
                    if (singleLineComment) {
                        comments.push(singleLineComment);
                        continue;
                    }

                    // Check for start of multi-line comment
                    const multiLineMarker = this.findMultiLineCommentStart(line, fileType);
                    if (multiLineMarker) {
                        inMultiLineComment = true;
                        multiLineCommentStart = i;
                        currentMultiLineMarker = multiLineMarker;
                    }
                } else if (currentMultiLineMarker) {
                    // Check for end of multi-line comment
                    if (line.includes(currentMultiLineMarker.end)) {
                        const comment = this.extractMultiLineComment(
                            document,
                            multiLineCommentStart,
                            i,
                            currentMultiLineMarker,
                            filePath,
                            fileType
                        );
                        if (comment) {
                            comments.push(comment);
                        }
                        inMultiLineComment = false;
                        currentMultiLineMarker = undefined;
                    }
                }
            }

            return comments;
        } catch (error) {
            console.error(`Error parsing file ${filePath}:`, error);
            return [];
        }
    }

    private static getFileType(document: vscode.TextDocument): string {
        return document.languageId;
    }

    private static parseSingleLineComment(
        line: string,
        fileType: string,
        lineNumber: number,
        filePath: string
    ): CommentInfo | null {
        const markers = this.SINGLE_LINE_COMMENT_MARKERS[fileType] || [];
        
        for (const marker of markers) {
            if (line.startsWith(marker)) {
                const comment = line.substring(marker.length).trim();
                if (comment) {
                    return {
                        file: filePath,
                        line: lineNumber,
                        comment,
                        type: 'single',
                        fileType
                    };
                }
            }
        }
        
        return null;
    }

    private static findMultiLineCommentStart(line: string, fileType: string): { start: string; end: string } | undefined {
        const markers = this.MULTI_LINE_COMMENT_MARKERS[fileType] || [];
        return markers.find(marker => line.includes(marker.start));
    }

    private static extractMultiLineComment(
        document: vscode.TextDocument,
        startLine: number,
        endLine: number,
        marker: { start: string; end: string },
        filePath: string,
        fileType: string
    ): CommentInfo | null {
        const lines: string[] = [];
        
        for (let i = startLine; i <= endLine; i++) {
            let line = document.lineAt(i).text.trim();
            
            if (i === startLine) {
                line = line.substring(line.indexOf(marker.start) + marker.start.length);
            }
            if (i === endLine) {
                line = line.substring(0, line.indexOf(marker.end));
            }
            
            // Remove common comment markers like * at the start of lines
            line = line.replace(/^\s*\*\s?/, '');
            
            if (line) {
                lines.push(line);
            }
        }
        
        const comment = lines.join('\n').trim();
        if (!comment) {
            return null;
        }

        const isDocComment = this.isDocumentationComment(document.lineAt(startLine).text, fileType);
        
        return {
            file: filePath,
            line: startLine,
            comment,
            type: isDocComment ? 'doc' : 'multi',
            fileType
        };
    }

    private static isDocumentationComment(line: string, fileType: string): boolean {
        const docMarkers = this.DOC_COMMENT_MARKERS[fileType] || [];
        return docMarkers.some(marker => line.includes(marker.start));
    }
}
