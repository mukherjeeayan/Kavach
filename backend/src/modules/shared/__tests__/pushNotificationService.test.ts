// pushNotificationService.test.ts
// Unit tests for the high-level push notification helpers.

jest.mock('../../../config/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
  query: jest.fn(),
}));

jest.mock('../firebase.service', () => ({
  __esModule: true,
  sendMulticastNotification: jest.fn(),
}));

import pool from '../../../config/database';
import { sendMulticastNotification } from '../firebase.service';
import { sendPushToParent, sendPushToAllParents } from '../pushNotificationService';

const mockedQuery = pool.query as unknown as jest.Mock;
const mockedSend = sendMulticastNotification as unknown as jest.Mock;

const PARENT_ID = '11111111-1111-1111-1111-111111111111';
const CHILD_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_PARENT_ID = '33333333-3333-3333-3333-333333333333';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sendPushToParent', () => {
  test('sends to all tokens registered for the parent', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ token: 'tok-a' }, { token: 'tok-b' }],
    } as any);
    mockedSend.mockResolvedValueOnce({ success: 2, failure: 0 });

    const result = await sendPushToParent(PARENT_ID, 'Hello', 'World');

    expect(mockedQuery).toHaveBeenCalledWith(
      'SELECT token FROM push_tokens WHERE user_id = $1',
      [PARENT_ID]
    );
    expect(mockedSend).toHaveBeenCalledWith(
      ['tok-a', 'tok-b'],
      'Hello',
      'World',
      undefined
    );
    expect(result).toEqual({ success: 2, failure: 0 });
  });

  test('passes through data payload', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ token: 'tok-x' }] } as any);
    mockedSend.mockResolvedValueOnce({ success: 1, failure: 0 });

    await sendPushToParent(PARENT_ID, 't', 'b', { type: 'sos' });

    expect(mockedSend).toHaveBeenCalledWith(['tok-x'], 't', 'b', { type: 'sos' });
  });

  test('returns 0,0 when the parent has no registered tokens', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const result = await sendPushToParent(PARENT_ID, 'Hello', 'World');

    expect(mockedSend).not.toHaveBeenCalled();
    expect(result).toEqual({ success: 0, failure: 0 });
  });

  test('returns 0,0 and does not throw when firebase is not configured', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ token: 'tok-a' }] } as any);
    // firebase service degrades to 0,0 when not initialised
    mockedSend.mockResolvedValueOnce({ success: 0, failure: 0 });

    const result = await sendPushToParent(PARENT_ID, 't', 'b');

    expect(result).toEqual({ success: 0, failure: 0 });
  });

  test('returns 0,0 and does not throw when the DB query fails', async () => {
    mockedQuery.mockRejectedValueOnce(new Error('db down'));

    const result = await sendPushToParent(PARENT_ID, 't', 'b');

    expect(result).toEqual({ success: 0, failure: 0 });
    expect(mockedSend).not.toHaveBeenCalled();
  });

  test('returns 0,0 when sendMulticastNotification throws', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ token: 'tok-a' }] } as any);
    mockedSend.mockRejectedValueOnce(new Error('fcm exploded'));

    const result = await sendPushToParent(PARENT_ID, 't', 'b');

    expect(result).toEqual({ success: 0, failure: 0 });
  });
});

describe('sendPushToAllParents', () => {
  test('fans out to every parent of the child', async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rows: [{ id: PARENT_ID }, { id: OTHER_PARENT_ID }],
      } as any)
      .mockResolvedValueOnce({ rows: [{ token: 'tok-1' }] } as any)
      .mockResolvedValueOnce({ rows: [{ token: 'tok-2' }] } as any);
    mockedSend
      .mockResolvedValueOnce({ success: 1, failure: 0 })
      .mockResolvedValueOnce({ success: 1, failure: 0 });

    await sendPushToAllParents(CHILD_ID, 'Title', 'Body', { type: 'sos' });

    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('INNER JOIN child_guardians'),
      [CHILD_ID]
    );
    expect(mockedSend).toHaveBeenCalledTimes(2);
    expect(mockedSend).toHaveBeenCalledWith(
      expect.any(Array),
      'Title',
      'Body',
      { type: 'sos' }
    );
  });

  test('does not throw when no guardians are linked', async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    await expect(
      sendPushToAllParents(CHILD_ID, 't', 'b')
    ).resolves.toBeUndefined();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  test('swallows DB errors so callers are not blocked', async () => {
    mockedQuery.mockRejectedValueOnce(new Error('db exploded'));

    await expect(
      sendPushToAllParents(CHILD_ID, 't', 'b')
    ).resolves.toBeUndefined();
    expect(mockedSend).not.toHaveBeenCalled();
  });

  test('uses DISTINCT so a parent with multiple guardian rows only gets one push', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ id: PARENT_ID }] } as any)
      .mockResolvedValueOnce({ rows: [{ token: 'tok-1' }] } as any);
    mockedSend.mockResolvedValueOnce({ success: 1, failure: 0 });

    await sendPushToAllParents(CHILD_ID, 't', 'b');

    const [sql] = mockedQuery.mock.calls[0];
    expect(sql).toMatch(/SELECT DISTINCT/);
    expect(mockedSend).toHaveBeenCalledTimes(1);
  });
});
