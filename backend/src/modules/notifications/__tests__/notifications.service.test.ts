// notifications.service.test.ts
// Unit tests for the notifications service.

import * as notificationsService from '../notifications.service';
import { query } from '../../../config/database';
import { NotFoundError } from '../../../utils/errors';

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
const NOTIF_ID = '22222222-2222-2222-2222-222222222222';

const baseNotification = {
  id: NOTIF_ID,
  user_id: USER_ID,
  title: 'SOS Triggered',
  body: 'Emergency alert from child',
  notification_type: 'SOS',
  reference_id: null,
  is_read: false,
  created_at: '2026-08-25T10:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('notifications.service', () => {
  describe('getNotifications', () => {
    it('should return paginated items and total', async () => {
      mockedQuery
        .mockResolvedValueOnce({
          rows: [baseNotification, { ...baseNotification, id: 'other' }],
        } as any)
        .mockResolvedValueOnce({ rows: [{ total: 2 }] } as any);

      const result = await notificationsService.getNotifications(USER_ID, {
        page: 1,
        limit: 20,
        unread_only: false,
        notification_type: undefined,
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM notifications'),
        expect.arrayContaining([USER_ID])
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return the unread notification count', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ count: 7 }] } as any);

      const result = await notificationsService.getUnreadCount(USER_ID);

      expect(result).toBe(7);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)::int AS count FROM notifications'),
        [USER_ID]
      );
    });
  });

  describe('markAsRead', () => {
    it('should update is_read=true and return the updated row', async () => {
      const updated = { ...baseNotification, is_read: true };

      mockedQuery
        .mockResolvedValueOnce({ rows: [baseNotification] } as any) // ownership check
        .mockResolvedValueOnce({ rows: [updated] } as any); // UPDATE

      const result = await notificationsService.markAsRead(USER_ID, NOTIF_ID);

      expect(result.is_read).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET is_read = true'),
        [NOTIF_ID, USER_ID]
      );
    });

    it('should short-circuit when the notification is already read', async () => {
      const read = { ...baseNotification, is_read: true };
      mockedQuery.mockResolvedValueOnce({ rows: [read] } as any);

      const result = await notificationsService.markAsRead(USER_ID, NOTIF_ID);

      expect(result).toEqual(read);
      // No UPDATE issued
      expect(mockedQuery).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundError when the notification does not exist', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        notificationsService.markAsRead(USER_ID, 'missing')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('markAllAsRead', () => {
    it('should return the number of rows updated', async () => {
      mockedQuery.mockResolvedValueOnce({ rowCount: 5 } as any);

      const result = await notificationsService.markAllAsRead(USER_ID);

      expect(result.marked).toBe(5);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1 AND is_read = false'),
        [USER_ID]
      );
    });
  });

  describe('deleteNotification', () => {
    it('should delete the notification and return deleted=true', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [baseNotification] } as any) // ownership
        .mockResolvedValueOnce({ rowCount: 1 } as any); // DELETE

      const result = await notificationsService.deleteNotification(USER_ID, NOTIF_ID);

      expect(result.deleted).toBe(true);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM notifications'),
        [NOTIF_ID, USER_ID]
      );
    });
  });
});
