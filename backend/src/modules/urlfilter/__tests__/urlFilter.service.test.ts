// urlFilter.service.test.ts
// Unit tests for the URL filter rules service.

import * as urlFilterService from '../urlFilter.service';
import { query } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import * as childrenService from '../../children/children.service';
import * as auditService from '../../shared/audit.service';
import * as pagination from '../../../utils/pagination';

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../children/children.service', () => ({
  verifyChildBelongsToParent: jest.fn(),
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
const mockedChildren = childrenService as jest.Mocked<typeof childrenService>;
const mockedAudit = auditService as jest.Mocked<typeof auditService>;
const mockedPagination = pagination as jest.Mocked<typeof pagination>;

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const CHILD_ID = '22222222-2222-2222-2222-222222222222';
const RULE_ID = '44444444-4444-4444-4444-444444444444';

const ruleRow = {
  id: RULE_ID,
  child_id: CHILD_ID,
  url_pattern: '*.example.com',
  rule_type: 'BLOCK',
  category: 'SOCIAL_MEDIA',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
  mockedPagination.toOffset.mockReturnValue(0);
  mockedPagination.buildPaginationMeta.mockReturnValue({ page: 1, limit: 20, total: 1, total_pages: 1 });
});

describe('urlFilter.service', () => {
  describe('listRules', () => {
    it('should verify ownership and return paginated rules', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [ruleRow] } as any) // items
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any); // count

      const result = await urlFilterService.listRules(PARENT_ID, CHILD_ID, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });
  });

  describe('createRule', () => {
    it('should create a URL filter rule and write audit log', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [ruleRow] } as any);

      const result = await urlFilterService.createRule(PARENT_ID, CHILD_ID, {
        url_pattern: '*.example.com',
        rule_type: 'BLOCK',
        category: 'SOCIAL_MEDIA',
        is_active: true,
      });

      expect(result.url_pattern).toBe('*.example.com');
      expect(result.rule_type).toBe('BLOCK');
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_URL_FILTER' })
      );
    });

    it('should default is_active to true when not provided', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [ruleRow] } as any);

      await urlFilterService.createRule(PARENT_ID, CHILD_ID, {
        url_pattern: '*.test.com',
        rule_type: 'ALLOW',
      });

      expect(mockedQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO url_filter_rules'),
        expect.arrayContaining([CHILD_ID, '*.test.com', 'ALLOW', null, true])
      );
    });
  });

  describe('updateRule', () => {
    it('should update and audit an existing rule', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: RULE_ID }] } as any) // existence check
        .mockResolvedValueOnce({ rows: [{ ...ruleRow, is_active: false }] } as any); // update

      const result = await urlFilterService.updateRule(PARENT_ID, CHILD_ID, RULE_ID, {
        is_active: false,
      });

      expect(result.is_active).toBe(false);
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_URL_FILTER' })
      );
    });

    it('should throw NotFoundError when rule does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        urlFilterService.updateRule(PARENT_ID, CHILD_ID, RULE_ID, { is_active: false })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteRule', () => {
    it('should delete and audit an existing rule', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: RULE_ID }] } as any);

      await expect(
        urlFilterService.deleteRule(PARENT_ID, CHILD_ID, RULE_ID)
      ).resolves.toBeUndefined();
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_URL_FILTER' })
      );
    });

    it('should throw NotFoundError when rule does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        urlFilterService.deleteRule(PARENT_ID, CHILD_ID, RULE_ID)
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('getActiveRulesForChild', () => {
    it('should return active rules for device sync', async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ url_pattern: '*.example.com', rule_type: 'BLOCK', category: 'SOCIAL_MEDIA' }],
      } as any);

      const result = await urlFilterService.getActiveRulesForChild(CHILD_ID);

      expect(result).toHaveLength(1);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_active = TRUE'),
        [CHILD_ID]
      );
    });
  });
});
