// keywordDict.service.test.ts
// Unit tests for the keyword dictionary service.

import * as keywordDictService from '../keywordDict.service';
import { query } from '../../../config/database';
import { NotFoundError, ConflictError } from '../../../utils/errors';
import * as auditService from '../../shared/audit.service';
import * as pagination from '../../../utils/pagination';

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../shared/audit.service', () => ({
  writeAuditLog: jest.fn(),
}));

jest.mock('../../../utils/pagination', () => ({
  toOffset: jest.fn(),
  buildPaginationMeta: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedAudit = auditService as jest.Mocked<typeof auditService>;
const mockedPagination = pagination as jest.Mocked<typeof pagination>;

const KEYWORD_ID = '66666666-6666-6666-6666-666666666666';

beforeEach(() => {
  jest.clearAllMocks();
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
  mockedPagination.toOffset.mockReturnValue(0);
  mockedPagination.buildPaginationMeta.mockReturnValue({ page: 1, limit: 20, total: 1, total_pages: 1 });
});

describe('keywordDict.service', () => {
  describe('listKeywords', () => {
    it('should return paginated keyword entries', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: KEYWORD_ID, keyword: 'drugs', category: 'DRUGS' }] } as any)
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any);

      const result = await keywordDictService.listKeywords(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by category when provided', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] } as any);

      await keywordDictService.listKeywords(1, 20, 'DRUGS');

      expect(mockedQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('category = $1'),
        expect.arrayContaining(['DRUGS'])
      );
    });

    it('should filter active only when requested', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] } as any);

      await keywordDictService.listKeywords(1, 20, undefined, true);

      expect(mockedQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('is_active = TRUE'),
        expect.anything()
      );
    });
  });

  describe('createKeyword', () => {
    it('should create a keyword and write audit log', async () => {
      const kw = { id: KEYWORD_ID, keyword: 'test', category: 'CUSTOM', severity: 'MEDIUM', language: 'en', is_active: true };
      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any) // no duplicate
        .mockResolvedValueOnce({ rows: [kw] } as any); // insert

      const result = await keywordDictService.createKeyword({
        category: 'CUSTOM',
        keyword: 'Test',
        severity: 'MEDIUM',
        language: 'en',
        is_active: true,
      });

      expect(result.id).toBe(KEYWORD_ID);
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_KEYWORD' })
      );
    });

    it('should throw ConflictError for duplicate keyword', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: KEYWORD_ID }] } as any); // duplicate found

      await expect(
        keywordDictService.createKeyword({
          category: 'DRUGS',
          keyword: 'drugs',
          severity: 'HIGH',
          language: 'en',
          is_active: true,
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('bulkCreateKeywords', () => {
    it('should create multiple keywords and return counts', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await keywordDictService.bulkCreateKeywords({
        keywords: [
          { category: 'CUSTOM', keyword: 'word1', severity: 'LOW', language: 'en' },
          { category: 'CUSTOM', keyword: 'word2', severity: 'HIGH', language: 'en' },
        ],
      });

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(2);
    });
  });

  describe('updateKeyword', () => {
    it('should update severity and return the keyword', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ id: KEYWORD_ID, severity: 'CRITICAL' }],
      } as any);

      const result = await keywordDictService.updateKeyword(KEYWORD_ID, { severity: 'CRITICAL' });

      expect(result.severity).toBe('CRITICAL');
    });

    it('should throw NotFoundError when keyword does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        keywordDictService.updateKeyword('nonexistent', { severity: 'HIGH' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteKeyword', () => {
    it('should delete an existing keyword', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: KEYWORD_ID }] } as any);

      await expect(
        keywordDictService.deleteKeyword(KEYWORD_ID)
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundError when keyword does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        keywordDictService.deleteKeyword('nonexistent')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
