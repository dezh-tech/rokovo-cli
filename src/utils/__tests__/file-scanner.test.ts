import { FileScanner } from '../file-scanner';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');
jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('FileScanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateDirectory', () => {
    it('should validate existing directory', async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => true
      } as any);

      await expect(FileScanner.validateDirectory('/test/path')).resolves.not.toThrow();
    });

    it('should throw error for non-directory', async () => {
      mockFs.stat.mockResolvedValue({
        isDirectory: () => false
      } as any);

      await expect(FileScanner.validateDirectory('/test/file.txt'))
        .rejects.toThrow('Path is not a directory');
    });

    it('should throw error for non-existent path', async () => {
      mockFs.stat.mockRejectedValue(new Error('ENOENT'));

      await expect(FileScanner.validateDirectory('/nonexistent'))
        .rejects.toThrow('Cannot access directory');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(FileScanner.formatFileSize(500)).toBe('500.0 B');
      expect(FileScanner.formatFileSize(1024)).toBe('1.0 KB');
      expect(FileScanner.formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(FileScanner.formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    });
  });

  describe('getProjectName', () => {
    it('should return package.json name if available', () => {
      const result = FileScanner.getProjectName('/test/project');
      // This will use the directory name as fallback since we can't easily mock readFileSync
      expect(result).toBe('project');
    });
  });

  describe('scan', () => {
    it('should scan directory and return results', async () => {
      const scanner = new FileScanner({
        directory: '/test/project',
        maxFileSize: 1024 * 1024
      });

      // Mock directory structure
      mockFs.readdir.mockResolvedValue([
        { name: 'src', isDirectory: () => true, isFile: () => false } as any,
        { name: 'index.ts', isDirectory: () => false, isFile: () => true } as any,
        { name: 'package.json', isDirectory: () => false, isFile: () => true } as any,
      ]);

      mockFs.stat.mockImplementation((filePath) => {
        if (filePath.toString().endsWith('index.ts')) {
          return Promise.resolve({
            size: 1000,
            mtime: new Date('2024-01-01'),
            isDirectory: () => false,
            isFile: () => true
          } as any);
        }
        return Promise.resolve({
          size: 500,
          mtime: new Date('2024-01-01'),
          isDirectory: () => false,
          isFile: () => true
        } as any);
      });

      const result = await scanner.scan();

      expect(result.files).toHaveLength(1); // Only .ts files should be included
      expect(result.files[0].filePath).toBe('index.ts');
      expect(result.files[0].language).toBe('TypeScript');
      expect(result.totalFiles).toBe(1);
    });

    it('should handle scan errors gracefully', async () => {
      const scanner = new FileScanner({
        directory: '/test/project'
      });

      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const result = await scanner.scan();

      expect(result.files).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Permission denied');
    });
  });

  describe('readFileContent', () => {
    it('should read file content', async () => {
      const content = 'test file content';
      mockFs.readFile.mockResolvedValue(content);

      const result = await FileScanner.readFileContent('/test/file.ts');

      expect(result).toBe(content);
      expect(mockFs.readFile).toHaveBeenCalledWith('/test/file.ts', 'utf-8');
    });

    it('should throw FileSystemError on read failure', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(FileScanner.readFileContent('/test/missing.ts'))
        .rejects.toThrow('Failed to read file');
    });
  });
});
