import { FileStats } from '../types';

export function generateMarkdownReport(stats: FileStats): string {
    return `# Comment Analysis Report

## Summary
- Total Comments: ${stats.totalComments}
- Single Line Comments: ${stats.singleLineComments}
- Multi-line Comments: ${stats.multiLineComments}
- Documentation Comments: ${stats.docComments}

## Distribution
- Single Line Comments: ${Math.round((stats.singleLineComments / stats.totalComments) * 100)}%
- Multi-line Comments: ${Math.round((stats.multiLineComments / stats.totalComments) * 100)}%
- Documentation Comments: ${Math.round((stats.docComments / stats.totalComments) * 100)}%
`;
}
