import { readdir, stat, readFile } from "node:fs/promises";
import { join, relative, basename } from "node:path";

export interface FileEntry {
  path: string;
  relativePath: string;
  content: string;
  size: number;
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  "__pycache__",
  ".tox",
  ".mypy_cache",
  ".pytest_cache",
  "dist",
  "build",
  ".next",
  "venv",
  ".venv",
  "env",
]);

const MAX_FILE_SIZE = 1024 * 1024; // 1MB — skip very large files

const SCANNABLE_EXTENSIONS = new Set([
  ".js", ".ts", ".mjs", ".cjs",
  ".py", ".rb", ".sh", ".bash",
  ".json", ".yaml", ".yml",
  ".md", ".txt",
  ".env", ".cfg", ".conf", ".ini", ".toml",
]);

export async function walkDirectory(rootPath: string): Promise<FileEntry[]> {
  const files: FileEntry[] = [];
  await walk(rootPath, rootPath, files);
  return files;
}

async function walk(
  currentPath: string,
  rootPath: string,
  files: FileEntry[]
): Promise<void> {
  let entries;
  try {
    entries = await readdir(currentPath, { withFileTypes: true });
  } catch {
    return; // Permission denied or not a directory
  }

  for (const entry of entries) {
    const fullPath = join(currentPath, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        await walk(fullPath, rootPath, files);
      }
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = getExtension(entry.name);
    if (!SCANNABLE_EXTENSIONS.has(ext)) continue;

    try {
      const stats = await stat(fullPath);
      if (stats.size > MAX_FILE_SIZE) continue;

      const content = await readFile(fullPath, "utf-8");
      files.push({
        path: fullPath,
        relativePath: relative(rootPath, fullPath),
        content,
        size: stats.size,
      });
    } catch {
      // Skip files we can't read
    }
  }
}

function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) return "";
  // Handle .env specially (it's the full name)
  if (filename === ".env" || filename.startsWith(".env.")) return ".env";
  return filename.slice(dotIndex).toLowerCase();
}

export function getSkillName(skillPath: string): string {
  return basename(skillPath);
}
