import * as fs from 'fs';
import * as path from 'path';
import { CommentInfo } from '../types';

type CommentConfig = {
    single: string;
    multi: string[];
    doc: string[];
};

type LanguageConfigs = {
    [key: string]: CommentConfig;
};

export class CommentParser {
    private static readonly languageConfigs: LanguageConfigs = {
        'js': { single: '//', multi: ['/*', '*/'], doc: ['/**', '*/'] },
        'ts': { single: '//', multi: ['/*', '*/'], doc: ['/**', '*/'] },
        'jsx': { single: '//', multi: ['/*', '*/'], doc: ['/**', '*/'] },
        'tsx': { single: '//', multi: ['/*', '*/'], doc: ['/**', '*/'] },
        'py': { single: '#', multi: ['"""', '"""'], doc: ['"""', '"""'] },
        'java': { single: '//', multi: ['/*', '*/'], doc: ['/**', '*/'] },
        'c': { single: '//', multi: ['/*', '*/'], doc: ['/**', '*/'] },
        'cpp': { single: '//', multi: ['/*', '*/'], doc: ['/**', '*/'] },
        'php': { single: '//', multi: ['/*', '*/'], doc: ['/**', '*/'] },
        'go': { single: '//', multi: ['/*', '*/'], doc: ['/**', '*/'] },
        'rs': { single: '//', multi: ['/*', '*/'], doc: ['/**', '*/'] },
        'swift': { single: '//', multi: ['/*', '*/'], doc: ['/**', '*/'] },
        'kt': { single: '//', multi: ['/*', '*/'], doc: ['/**', '*/'] },
        'rb': { single: '#', multi: ['=begin', '=end'], doc: ['=begin', '=end'] },
        'cs': { single: '//', multi: ['/*', '*/'], doc: ['/**', '*/'] }
    };

    private static readonly ignoredFiles = [
        '.gitignore',
        '.npmignore',
        '.eslintignore',
        'package-lock.json',
        'yarn.lock',
        '.DS_Store',
        '.env',
        '.env.local',
        '.env.development',
        '.env.test',
        '.env.production'
    ];

    private static readonly ignoredDirectories = [
        'node_modules',
        '.git',
        'dist',
        'build',
        'out',
        'coverage',
        '.vscode',
        '.idea',
        '.vs',
        'tmp',
        'temp'
    ];

    public static async parseFile(filePath: string): Promise<CommentInfo[]> {
        try {
            // Check if file should be ignored
            const fileName = path.basename(filePath);
            if (this.ignoredFiles.includes(fileName)) {
                return [];
            }

            // Check if file is in ignored directory
            const normalizedPath = filePath.replace(/\\/g, '/');
            if (this.ignoredDirectories.some(dir => normalizedPath.includes(`/${dir}/`))) {
                return [];
            }

            const fileType = path.extname(filePath).slice(1);
            const config = this.languageConfigs[fileType];

            // Skip files without comment configuration
            if (!config) {
                return [];
            }

            const content = await fs.promises.readFile(filePath, 'utf8');
            const lines = content.split('\n');
            const comments: CommentInfo[] = [];
            let inMultiLineComment = false;
            let multiLineStart = 0;
            let multiLineType: 'multi' | 'doc' = 'multi';
            let multiLineContent: string[] = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                if (!inMultiLineComment) {
                    // Check for single-line comments
                    if (line.startsWith(config.single)) {
                        comments.push({
                            file: filePath,
                            line: i,
                            text: line.substring(config.single.length).trim(),
                            type: 'single',
                            fileType
                        });
                        continue;
                    }

                    // Check for start of multi-line or doc comments
                    if (line.startsWith(config.doc[0])) {
                        inMultiLineComment = true;
                        multiLineStart = i;
                        multiLineType = 'doc';
                        multiLineContent = [line];
                    } else if (line.startsWith(config.multi[0])) {
                        inMultiLineComment = true;
                        multiLineStart = i;
                        multiLineType = 'multi';
                        multiLineContent = [line];
                    }
                } else {
                    multiLineContent.push(line);
                    
                    // Check for end of multi-line comment
                    const currentConfig = multiLineType === 'doc' ? config.doc : config.multi;
                    if (line.endsWith(currentConfig[1])) {
                        inMultiLineComment = false;
                        comments.push({
                            file: filePath,
                            line: multiLineStart,
                            text: multiLineContent.join('\n'),
                            type: multiLineType,
                            fileType
                        });
                        multiLineContent = [];
                    }
                }
            }

            return comments;
        } catch (error) {
            console.error(`Error parsing file ${filePath}:`, error);
            return [];
        }
    }
}
