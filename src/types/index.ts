import * as vscode from 'vscode';

export interface CommentInfo {
    file: string;
    line: number;
    comment: string;
    type: 'single' | 'multi' | 'doc';
    fileType: string;
}

export interface FileStats {
    totalComments: number;
    singleLineComments: number;
    multiLineComments: number;
    docComments: number;
}

export interface CommentNodeMetadata {
    description?: string;
    type?: string;
    iconPath?: string;
    comment?: CommentInfo;
}

export type SortOrder = 'file' | 'type';
