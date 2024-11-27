import * as vscode from 'vscode';

export interface CommentInfo {
    file: string;
    line: number;
    text: string;
    type: 'single' | 'multi' | 'doc';
    fileType: string;
}

export type FileStats = {
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
