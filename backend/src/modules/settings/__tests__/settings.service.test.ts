// settings.service.test.ts
// Unit tests for the user settings service.

import * as settingsService from '../settings.service';
import { query } from '../../../config/database';

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: { query: jest.fn(), connect: jest.fn() },
  query: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;

const USER_ID = '11111111-1111-1111-1111-111111111111';

const savedSettingsRow = {
  id: 'settings-uuid',
  user_id: USER_ID,
  notifications_enabled: true,
  email_digest_enabled: false,
  digest_frequency: 'WEEKLY',
  screen_time_alerts: true,
  location_alerts: true,
  communication_alerts: false,
  sos_alerts: true,
  self_harm_alerts: true,
  dnd_enabled: false,
  dnd_start_time: null,
  dnd_end_time: null,
  push_token: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('settings.service', () => {
  describe('getSettings', () => {
    it('should return defaults by creating a row when no settings exist', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [] } as any) // SELECT — none
        .mockResolvedValueOnce({ rows: [savedSettingsRow] } as any); // INSERT

      const result = await settingsService.getSettings(USER_ID);

      expect(result).toEqual(savedSettingsRow);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_settings'),
        [USER_ID]
      );
    });

    it('should return existing settings when already saved', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [savedSettingsRow] } as any);

      const result = await settingsService.getSettings(USER_ID);

      expect(result).toEqual(savedSettingsRow);
      expect(mockedQuery).toHaveBeenCalledTimes(1);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM user_settings'),
        [USER_ID]
      );
    });
  });

  describe('updateSettings', () => {
    it('should only update provided fields and return the new row', async () => {
      const updatedRow = { ...savedSettingsRow, notifications_enabled: false, email_digest_enabled: true };

      mockedQuery
        .mockResolvedValueOnce({ rows: [savedSettingsRow] } as any) // getSettings SELECT (ensures exist)
        .mockResolvedValueOnce({ rows: [updatedRow] } as any); // UPDATE RETURNING

      const result = await settingsService.updateSettings(USER_ID, {
        notifications_enabled: false,
        email_digest_enabled: true,
      });

      expect(result.notifications_enabled).toBe(false);
      expect(result.email_digest_enabled).toBe(true);
      // The SET clause should only contain the two updated fields + updated_at
      const updateCall = mockedQuery.mock.calls[1];
      expect(updateCall[0]).toContain('notifications_enabled = $1');
      expect(updateCall[0]).toContain('email_digest_enabled = $2');
      expect(updateCall[0]).toContain('updated_at = now()');
    });

    it('should be a no-op when no fields are provided', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [savedSettingsRow] } as any) // getSettings SELECT
        .mockResolvedValueOnce({ rows: [savedSettingsRow] } as any); // getSettings called again

      const result = await settingsService.updateSettings(USER_ID, {});

      expect(result).toEqual(savedSettingsRow);
      // Should not have issued an UPDATE
      const sqlCalls = mockedQuery.mock.calls.map((c: any) => c[0]);
      expect(sqlCalls.some((sql: string) => sql.includes('UPDATE user_settings'))).toBe(false);
    });
  });

  describe('savePushToken', () => {
    it('should persist the token and return saved=true on success', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [savedSettingsRow] } as any) // getSettings SELECT
        .mockResolvedValueOnce({ rowCount: 1 } as any); // UPDATE

      const result = await settingsService.savePushToken(
        USER_ID,
        'fcm-token-abc',
        'android'
      );

      expect(result.saved).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET push_token = $1'),
        ['fcm-token-abc', 'android', USER_ID]
      );
    });
  });
});
