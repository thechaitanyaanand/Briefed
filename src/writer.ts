import * as fs from 'fs';
import * as path from 'path';
import { BriefedConfig, ContextEntry } from './types.js';

/**
 * Robustly renames a file with multiple retry attempts on Windows systems
 * to gracefully handle brief EPERM, EBUSY, or EACCES handle locks.
 */
function robustRename(from: string, to: string): void {
  const maxAttempts = 15;
  let lastError: any;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (err: any) {
      lastError = err;
      if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') {
        const start = Date.now();
        while (Date.now() - start < 15) {
          // busy wait 15ms
        }
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

/**
 * Reads the content within the <!-- BRIEFED_START --> and <!-- BRIEFED_END --> markers.
 * Parses each entry from the block. Each entry begins with a header like:
 * ## [ISO_DATE] COMMIT_HASH or ## [ISO_DATE] COMMIT_HASH (BRANCH_NAME).
 * Extracts date, commitHash, sourceBranch, structured categories (summary), and filesChanged (from FILES: line).
 */
export function parseEntries(content: string): ContextEntry[] {
  const startMarker = '<!-- BRIEFED_START -->';
  const endMarker = '<!-- BRIEFED_END -->';

  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return [];
  }

  const blockContent = content.substring(startIndex + startMarker.length, endIndex).trim();
  if (!blockContent) {
    return [];
  }

  const headerRegex = /^##\s+\[([^\]]+)\]\s+(\S+)(?:\s+\(([^)]+)\))?\s*$/gm;
  const matches: { index: number; date: string; commitHash: string; sourceBranch?: string; length: number }[] = [];
  
  let match;
  headerRegex.lastIndex = 0;
  while ((match = headerRegex.exec(blockContent)) !== null) {
    matches.push({
      index: match.index,
      date: match[1].trim(),
      commitHash: match[2].trim(),
      sourceBranch: match[3] ? match[3].trim() : undefined,
      length: match[0].length,
    });
  }

  const entries: ContextEntry[] = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const bodyStart = current.index + current.length;
    const bodyEnd = (i + 1 < matches.length) ? matches[i + 1].index : blockContent.length;
    const body = blockContent.substring(bodyStart, bodyEnd).trim();

    const lines = body.split(/\r?\n/);
    const filesChanged: string[] = [];
    const summaryLines: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (/^FILES:/i.test(trimmedLine)) {
        const filesPart = trimmedLine.replace(/^FILES:\s*/i, '').trim();
        if (filesPart) {
          let parsed: string[] = [];
          if (filesPart.includes(',')) {
            parsed = filesPart.split(',').map(f => f.trim()).filter(Boolean);
          } else {
            parsed = filesPart.split(/\s+/).map(f => f.trim()).filter(Boolean);
          }
          filesChanged.push(...parsed);
        }
      } else {
        summaryLines.push(line);
      }
    }

    const summary = summaryLines.join('\n').trim();

    entries.push({
      date: current.date,
      commitHash: current.commitHash,
      sourceBranch: current.sourceBranch,
      summary,
      filesChanged,
    });
  }

  return entries;
}

/**
 * Read the target context file from config.target.
 * If it doesn't exist, create it with a default markdown header.
 * Find markers. If missing, append them.
 * Perform deduplication, prepending, pruning (by age and entries), and write back.
 */
export function writeEntry(entry: ContextEntry, config: BriefedConfig): void {
  const startMarker = '<!-- BRIEFED_START -->';
  const endMarker = '<!-- BRIEFED_END -->';

  const dir = path.dirname(config.target);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const lockPath = `${config.target}.lock`;
  let acquired = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.writeFileSync(lockPath, process.pid.toString(), { flag: 'wx' });
      acquired = true;
      break;
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        const start = Date.now();
        while (Date.now() - start < 50) {
          // busy wait
        }
      } else {
        break;
      }
    }
  }
  if (!acquired) {
    console.warn(`Warning: Could not acquire lock on ${lockPath} after 5 attempts. Proceeding...`);
  }

  try {
    let fileContent = '';
    if (!fs.existsSync(config.target)) {
      fileContent = `# AI Context\n\nManaged by Briefed.\n\n${startMarker}\n${endMarker}`;
      const tmpPath = `${config.target}.tmp`;
      fs.writeFileSync(tmpPath, fileContent, 'utf-8');
      robustRename(tmpPath, config.target);
    } else {
      fileContent = fs.readFileSync(config.target, 'utf-8');
    }

    let startIdx = fileContent.indexOf(startMarker);
    let endIdx = fileContent.indexOf(endMarker);

    const hasStart = startIdx !== -1;
    const hasEnd = endIdx !== -1;
    const isReversed = hasStart && hasEnd && startIdx >= endIdx;
    const isCorrupted = (hasStart && !hasEnd) || (!hasStart && hasEnd) || isReversed;

    if (isCorrupted || !hasStart || !hasEnd) {
      if (isCorrupted) {
        console.warn('Warning: Markers are reversed or corrupted. Cleaning and appending to bottom.');
      }
      fileContent = fileContent
        .replace(new RegExp(startMarker, 'g'), '')
        .replace(new RegExp(endMarker, 'g'), '');
      fileContent = fileContent.trim() + `\n\n${startMarker}\n${endMarker}`;
    }

    const existingEntries = parseEntries(fileContent);

    // Deduplication Check
    if (existingEntries.some(e => e.commitHash === entry.commitHash)) {
      return;
    }

    // Combine and apply limits
    let remainingEntries = [entry, ...existingEntries];

    // Age Pruning
    if (config.window && typeof config.window.days === 'number' && config.window.days > 0) {
      const now = new Date();
      const maxAgeMs = config.window.days * 24 * 60 * 60 * 1000;
      remainingEntries = remainingEntries.filter(e => {
        const entryTime = new Date(e.date).getTime();
        if (isNaN(entryTime)) {
          return true; // Keep invalid dates to be safe
        }
        return (now.getTime() - entryTime) <= maxAgeMs;
      });
    }

    // Count Pruning
    if (config.window && typeof config.window.entries === 'number' && config.window.entries > 0) {
      remainingEntries = remainingEntries.slice(0, config.window.entries);
    }

    // Serialize entries
    const serialized = remainingEntries
      .map(e => {
        let block = `## [${e.date}] ${e.commitHash}${e.sourceBranch ? ` (${e.sourceBranch})` : ''}\n${e.summary.trim()}`;
        if (e.filesChanged && e.filesChanged.length > 0) {
          const hasFilesLine = e.summary.split('\n').some(line => /^FILES:/i.test(line.trim()));
          if (!hasFilesLine) {
            block += `\n\nFILES: ${e.filesChanged.join(', ')}`;
          }
        }
        return block;
      })
      .join('\n\n');

    // Replace content between markers preserving everything else
    const currentStartIdx = fileContent.indexOf(startMarker);
    const currentEndIdx = fileContent.indexOf(endMarker);

    const before = fileContent.substring(0, currentStartIdx + startMarker.length);
    const after = fileContent.substring(currentEndIdx);

    const updatedFileContent = serialized
      ? `${before}\n${serialized}\n${after}`
      : `${before}\n${after}`;

    const tmpPath = `${config.target}.tmp`;
    fs.writeFileSync(tmpPath, updatedFileContent, 'utf-8');
    robustRename(tmpPath, config.target);
  } finally {
    if (acquired) {
      try {
        fs.unlinkSync(lockPath);
      } catch (err) {
        // ignore
      }
    }
  }
}

/**
 * Reads the target file, parses the entries inside the markers, and returns
 * the first/latest entry, or null if none exist or the file doesn't exist.
 */
export function getLastEntry(config: BriefedConfig): ContextEntry | null {
  if (!fs.existsSync(config.target)) {
    return null;
  }
  try {
    const content = fs.readFileSync(config.target, 'utf-8');
    const entries = parseEntries(content);
    return entries.length > 0 ? entries[0] : null;
  } catch (error) {
    return null;
  }
}
