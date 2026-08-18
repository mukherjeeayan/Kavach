// children.service.test.ts
// Unit tests for the child profile service.

import * as childrenService from '../children.service';
import { query } from '../../config/database';
import { ForbiddenError } from '../../utils/errors';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: { connect: jest.fn() },
  query: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const CHILD_ID = '22222222-2222-2222-2222-222222222222';

const childRow = {
  id: CHILD_ID,
  parent_id: PARENT_ID,
  name: 'Kid',
  birth_date: '2015-01-01',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('children.service', () => {
  describe('verifyChildBelongsToParent', () => {
    it('should resolve when the child belongs to the parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: CHILD_ID }] } as any);

      await expect(
        childrenService.verifyChildBelongsToParent(CHILD_ID, PARENT_ID)
      ).resolves.toBeUndefined();
    });

    it('should throw ForbiddenError when the child does not belong to the parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        childrenService.verifyChildBelongsToParent(CHILD_ID, PARENT_ID)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('listChildren', () => {
    it('should return the parent\'s children', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [childRow] } as any);

      const result = await childrenService.listChildren(PARENT_ID);

      expect(result).toHaveLength(1);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE parent_id = $1'),
        [PARENT_ID]
      );
    });
  });

  describe('createChild', () => {
    it('should insert and return the new child profile', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [childRow] } as any);

      const result = await childrenService.createChild(PARENT_ID, 'Kid', '2015-01-01');

      expect(result.id).toBe(CHILD_ID);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO children'),
        [PARENT_ID, 'Kid', '2015-01-01']
      );
    });

    it('should insert with a null birth_date when omitted', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ ...childRow, birth_date: null }] } as any);

      const result = await childrenService.createChild(PARENT_ID, 'Kid');

      expect(result.birth_date).toBeNull();
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO children'),
        [PARENT_ID, 'Kid', null]
      );
    });
  });
});