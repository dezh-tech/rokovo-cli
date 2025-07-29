import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { 
  SupportedFileExtensions, 
  SupportedFileExtension, 
  FileAnalysis, 
  DEFAULT_IGNORE_PATTERNS,
  FileSystemError 
} from '@/types';

export interface ScanOptions {
  directory: string;
  ignorePatterns?: string[];
  maxFileSize?: number; // in bytes
  includeHidden?: boolean;
}

export interface ScanResult {
  files: FileAnalysis[];
  totalFiles: number;
  totalSize: number;
  skippedFiles: string[];
  errors: string[];
}

export class FileScanner {
  private readonly defaultMaxFileSize = 1024 * 1024; // 1MB
  private readonly ignorePatterns: RegExp[];

  constructor(private options: ScanOptions) {
    const patterns = [...DEFAULT_IGNORE_PATTERNS, ...(options.ignorePatterns || [])];
    this.ignorePatterns = patterns.map(pattern => 
      new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'))
    );
  }

  async scan(): Promise<ScanResult> {
    const result: ScanResult = {
      files: [],
      totalFiles: 0,
      totalSize: 0,
      skippedFiles: [],
      errors: []
    };

    try {
      await this.scanDirectory(this.options.directory, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new FileSystemError(`Failed to scan directory: ${message}`, {
        directory: this.options.directory,
        error: message
      });
    }

    return result;
  }

  private async scanDirectory(dirPath: string, result: ScanResult): Promise<void> {
    let entries: fsSync.Dirent[];
    
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to read directory ${dirPath}: ${message}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(this.options.directory, fullPath);

      // Skip hidden files unless explicitly included
      if (!this.options.includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      // Check ignore patterns
      if (this.shouldIgnore(relativePath)) {
        result.skippedFiles.push(relativePath);
        continue;
      }

      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath, result);
      } else if (entry.isFile()) {
        await this.processFile(fullPath, relativePath, result);
      }
    }
  }

  private async processFile(fullPath: string, relativePath: string, result: ScanResult): Promise<void> {
    try {
      const stats = await fs.stat(fullPath);
      const maxSize = this.options.maxFileSize || this.defaultMaxFileSize;

      // Skip files that are too large
      if (stats.size > maxSize) {
        result.skippedFiles.push(`${relativePath} (too large: ${stats.size} bytes)`);
        return;
      }

      const extension = path.extname(fullPath) as SupportedFileExtension;
      
      // Only process supported file types
      if (!this.isSupportedFile(extension)) {
        return;
      }

      const language = this.getLanguageFromExtension(extension);
      
      const fileAnalysis: FileAnalysis = {
        filePath: relativePath,
        fileType: extension,
        language,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        businessRules: [],
        analysisStatus: 'pending'
      };

      result.files.push(fileAnalysis);
      result.totalFiles++;
      result.totalSize += stats.size;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Failed to process file ${relativePath}: ${message}`);
    }
  }

  private shouldIgnore(relativePath: string): boolean {
    return this.ignorePatterns.some(pattern => pattern.test(relativePath));
  }

  private isSupportedFile(extension: string): extension is SupportedFileExtension {
    return SupportedFileExtensions.includes(extension as SupportedFileExtension);
  }

  private getLanguageFromExtension(extension: SupportedFileExtension): string {
    const languageMap: Record<SupportedFileExtension, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript React',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript React',
      '.py': 'Python',
      '.java': 'Java',
      '.cs': 'C#',
      '.cpp': 'C++',
      '.c': 'C',
      '.go': 'Go',
      '.rs': 'Rust',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.clj': 'Clojure'
    };

    return languageMap[extension] || 'Unknown';
  }

  // Static utility methods
  static async validateDirectory(dirPath: string): Promise<void> {
    try {
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        throw new FileSystemError(`Path is not a directory: ${dirPath}`);
      }
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new FileSystemError(`Cannot access directory: ${message}`, { path: dirPath });
    }
  }

  static async readFileContent(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new FileSystemError(`Failed to read file: ${message}`, { path: filePath });
    }
  }

  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  static getProjectName(directory: string): string {
    const packageJsonPath = path.join(directory, 'package.json');
    
    try {
      const packageJson = JSON.parse(fsSync.readFileSync(packageJsonPath, 'utf-8'));
      return packageJson.name || path.basename(directory);
    } catch {
      return path.basename(directory);
    }
  }
}
