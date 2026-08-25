// voiceCommand.service.test.ts
// Unit tests for the voice command recording and listing service.

import * as voiceCommandService from '../voiceCommand.service';
import { query } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';
import * as childrenService from '../../children/children.service';
import * as auditService from '../../shared/audit.service';

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../children/children.service', () => ({
  verifyChildBelongsToParent: jest.fn(),
}));

jest.mock('../../shared/audit.service', () => ({
  writeAuditLog: jest.fn(),
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

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const CHILD_ID = '22222222-2222-2222-2222-222222222222';
const DEVICE_ID = '33333333-3333-3333-3333-333333333333';
const COMMAND_ID = '44444444-4444-4444-4444-444444444444';

const commandRow = {
  id: COMMAND_ID,
  child_id: CHILD_ID,
  device_id: DEVICE_ID,
  command_text: 'Call mom',
  intent: 'CALL',
  was_executed: true,
  recorded_at: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
});

describe('voiceCommand.service', () => {
  describe('recordCommand', () => {
    it('should record a voice command when device exists', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any)
        .mockResolvedValueOnce({ rows: [commandRow] } as any);

      const result = await voiceCommandService.recordCommand(DEVICE_ID, {
        command_text: 'Call mom',
        intent: 'CALL',
        was_executed: true,
      });

      expect(result.id).toBe(COMMAND_ID);
      expect(result.command_text).toBe('Call mom');
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO voice_commands'),
        [CHILD_ID, DEVICE_ID, 'Call mom', 'CALL', true]
      );
      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'VOICE_COMMAND_RECORDED', targetChildId: CHILD_ID })
      );
    });

    it('should throw NotFoundError when device does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        voiceCommandService.recordCommand(DEVICE_ID, { command_text: 'Hello' })
      ).rejects.toThrow(NotFoundError);
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });

    it('should default was_executed to false when not provided', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any)
        .mockResolvedValueOnce({ rows: [{ ...commandRow, was_executed: false }] } as any);

      await voiceCommandService.recordCommand(DEVICE_ID, {
        command_text: 'Set alarm',
      });

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO voice_commands'),
        [CHILD_ID, DEVICE_ID, 'Set alarm', null, false]
      );
    });
  });

  describe('listCommands', () => {
    it('should verify ownership and return commands with pagination', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any)
        .mockResolvedValueOnce({ rows: [commandRow] } as any);

      const result = await voiceCommandService.listCommands(PARENT_ID, CHILD_ID, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
      expect(mockedQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('FROM voice_commands'),
        [CHILD_ID, 20, 0]
      );
    });
  });
});
