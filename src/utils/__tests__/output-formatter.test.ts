import { OutputFormatter } from '../output-formatter';
import { AnalysisResult, BusinessRule } from '../../types';
import * as fs from 'fs/promises';

// Mock fs module
jest.mock('fs/promises');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('OutputFormatter', () => {
  let formatter: OutputFormatter;
  let mockAnalysisResult: AnalysisResult;

  beforeEach(() => {
    jest.clearAllMocks();
    
    formatter = new OutputFormatter({
      includeMetadata: true,
      includeSourceReferences: true,
      groupByCategory: true,
      sortByPriority: true
    });

    const mockBusinessRule: BusinessRule = {
      id: 'rule-001',
      title: 'Email Validation Required',
      description: 'Users must provide valid email addresses during registration',
      category: 'User Management',
      priority: 'high',
      source: {
        file: 'src/auth/validation.ts',
        startLine: 15,
        endLine: 25
      },
      tags: ['validation', 'email'],
      userFacing: true
    };

    mockAnalysisResult = {
      applicationName: 'Test Application',
      analysisDate: '2024-01-15T10:30:00.000Z',
      totalFilesAnalyzed: 5,
      businessRules: [mockBusinessRule],
      categories: ['User Management'],
      summary: {
        totalRules: 1,
        highPriorityRules: 1,
        userFacingRules: 1
      }
    };
  });

  describe('formatAsJSON', () => {
    it('should format analysis result as JSON string', () => {
      const output = formatter.formatAsJSON(mockAnalysisResult);

      expect(output.format).toBe('json');
      expect(typeof output.content).toBe('string');
      
      const parsed = JSON.parse(output.content);
      expect(parsed.applicationName).toBe('Test Application');
      expect(parsed.businessRules).toHaveLength(1);
    });
  });

  describe('formatAsMarkdown', () => {
    it('should format analysis result as markdown', () => {
      const output = formatter.formatAsMarkdown(mockAnalysisResult);

      expect(output.format).toBe('markdown');
      expect(output.content).toContain('# Business Rules for Test Application');
      expect(output.content).toContain('## Analysis Summary');
      expect(output.content).toContain('## User Management');
      expect(output.content).toContain('### 🔴 Email Validation Required');
      expect(output.content).toContain('Users must provide valid email addresses');
      expect(output.content).toContain('*Source: src/auth/validation.ts:15-25*');
    });

    it('should include metadata when enabled', () => {
      const output = formatter.formatAsMarkdown(mockAnalysisResult);

      expect(output.content).toContain('**Analysis Date:**');
      expect(output.content).toContain('**Total Files Analyzed:** 5');
      expect(output.content).toContain('**Total Business Rules:** 1');
    });

    it('should exclude metadata when disabled', () => {
      const formatterNoMeta = new OutputFormatter({
        includeMetadata: false
      });

      const output = formatterNoMeta.formatAsMarkdown(mockAnalysisResult);

      expect(output.content).not.toContain('## Analysis Summary');
      expect(output.content).not.toContain('**Analysis Date:**');
    });

    it('should exclude source references when disabled', () => {
      const formatterNoSource = new OutputFormatter({
        includeSourceReferences: false
      });

      const output = formatterNoSource.formatAsMarkdown(mockAnalysisResult);

      expect(output.content).not.toContain('*Source:');
    });
  });

  describe('formatAndSave', () => {
    beforeEach(() => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
    });

    it('should save JSON format', async () => {
      await formatter.formatAndSave(mockAnalysisResult, '/output/test.json', 'json');

      expect(mockFs.mkdir).toHaveBeenCalledWith('/output', { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/output/test.json',
        expect.stringContaining('"applicationName":"Test Application"'),
        'utf-8'
      );
    });

    it('should save markdown format', async () => {
      await formatter.formatAndSave(mockAnalysisResult, '/output/test.md', 'markdown');

      expect(mockFs.mkdir).toHaveBeenCalledWith('/output', { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/output/test.md',
        expect.stringContaining('# Business Rules for Test Application'),
        'utf-8'
      );
    });

    it('should handle write errors', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      await expect(
        formatter.formatAndSave(mockAnalysisResult, '/readonly/test.md', 'markdown')
      ).rejects.toThrow('Failed to save output');
    });
  });

  describe('static utility methods', () => {
    describe('getOutputExtension', () => {
      it('should return correct extensions', () => {
        expect(OutputFormatter.getOutputExtension('json')).toBe('.json');
        expect(OutputFormatter.getOutputExtension('markdown')).toBe('.md');
      });
    });

    describe('generateDefaultOutputPath', () => {
      it('should generate default output path', () => {
        const result = OutputFormatter.generateDefaultOutputPath('/project/src', 'markdown');
        
        expect(result).toContain('business-rules-src-');
        expect(result.endsWith('.md')).toBe(true);
      });
    });

    describe('validateOutputPath', () => {
      it('should validate existing directory', async () => {
        mockFs.access.mockResolvedValue(undefined);

        await expect(OutputFormatter.validateOutputPath('/existing/output.md'))
          .resolves.not.toThrow();
      });

      it('should create directory if it does not exist', async () => {
        mockFs.access.mockRejectedValue(new Error('ENOENT'));
        mockFs.mkdir.mockResolvedValue(undefined);

        await expect(OutputFormatter.validateOutputPath('/new/output.md'))
          .resolves.not.toThrow();

        expect(mockFs.mkdir).toHaveBeenCalledWith('/new', { recursive: true });
      });
    });
  });
});
