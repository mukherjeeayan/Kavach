// security.service.test.ts
// Unit tests for the security scan and WiFi monitoring service.

import * as securityService from '../security.service';
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
const SCAN_ID = '44444444-4444-4444-4444-444444444444';
const WIFI_ID = '55555555-5555-5555-5555-555555555555';

const scanRow = {
  id: SCAN_ID,
  device_id: DEVICE_ID,
  scan_type: 'FULL',
  result: { root_detected: false, keylogger_detected: false },
  threats_found: 0,
  scanned_at: new Date().toISOString(),
};

const wifiRow = {
  id: WIFI_ID,
  device_id: DEVICE_ID,
  ssid: 'HomeWiFi',
  bssid: 'AA:BB:CC:DD:EE:FF',
  security_type: 'WPA2',
  is_open: false,
  is_known: true,
  ip_address: '192.168.1.100',
  recorded_at: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
  mockedAudit.writeAuditLog.mockResolvedValue(undefined);
});

describe('security.service', () => {
  describe('recordSecurityScan', () => {
    it('should record a scan when device belongs to parent', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any)
        .mockResolvedValueOnce({ rows: [scanRow] } as any);

      const result = await securityService.recordSecurityScan(PARENT_ID, DEVICE_ID, {
        scan_type: 'FULL',
        result: { root_detected: false, keylogger_detected: false },
        threats_found: 0,
      });

      expect(result.id).toBe(SCAN_ID);
      expect(result.scan_type).toBe('FULL');
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_scans'),
        [DEVICE_ID, 'FULL', JSON.stringify({ root_detected: false, keylogger_detected: false }), 0]
      );
      expect(mockedAudit.writeAuditLog).not.toHaveBeenCalled();
    });

    it('should audit when threats are found', async () => {
      const threatScan = { ...scanRow, threats_found: 2 };
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID, child_id: CHILD_ID }] } as any)
        .mockResolvedValueOnce({ rows: [threatScan] } as any);

      await securityService.recordSecurityScan(PARENT_ID, DEVICE_ID, {
        scan_type: 'ROOT',
        result: { root_detected: true },
        threats_found: 2,
      });

      expect(mockedAudit.writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SECURITY_THREAT_DETECTED', targetChildId: CHILD_ID })
      );
    });

    it('should throw NotFoundError when device does not belong to parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        securityService.recordSecurityScan(PARENT_ID, DEVICE_ID, {
          scan_type: 'FULL',
          result: {},
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('recordWifiLog', () => {
    it('should record a wifi connection when device belongs to parent', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID }] } as any)
        .mockResolvedValueOnce({ rows: [wifiRow] } as any);

      const result = await securityService.recordWifiLog(PARENT_ID, DEVICE_ID, {
        ssid: 'HomeWiFi',
        bssid: 'AA:BB:CC:DD:EE:FF',
        security_type: 'WPA2',
        is_open: false,
        is_known: true,
        ip_address: '192.168.1.100',
      });

      expect(result.id).toBe(WIFI_ID);
      expect(result.ssid).toBe('HomeWiFi');
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO wifi_logs'),
        [DEVICE_ID, 'HomeWiFi', 'AA:BB:CC:DD:EE:FF', 'WPA2', false, true, '192.168.1.100']
      );
    });

    it('should throw NotFoundError when device does not belong to parent', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        securityService.recordWifiLog(PARENT_ID, DEVICE_ID, { ssid: 'EvilTwin' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('listSecurityScans', () => {
    it('should verify ownership, device and return scans with pagination', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID }] } as any) // device check
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any) // count
        .mockResolvedValueOnce({ rows: [scanRow] } as any); // select

      const result = await securityService.listSecurityScans(PARENT_ID, CHILD_ID, DEVICE_ID, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });

    it('should throw NotFoundError when device does not belong to child', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID }] } as any) // device check OK
        .mockResolvedValueOnce({ rows: [] } as any) // but device query returns empty

      // Actually the service does verifyChildBelongsToParent first, then queries devices
      // Let me fix: the device query happens after verifyChildBelongsToParent
      mockedQuery.mockReset();
      mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any); // device not found for child

      await expect(
        securityService.listSecurityScans(PARENT_ID, CHILD_ID, DEVICE_ID, 1, 20)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('listWifiLogs', () => {
    it('should verify ownership, device and return wifi logs with pagination', async () => {
      mockedQuery
        .mockResolvedValueOnce({ rows: [{ id: DEVICE_ID }] } as any) // device check
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any) // count
        .mockResolvedValueOnce({ rows: [wifiRow] } as any); // select

      const result = await securityService.listWifiLogs(PARENT_ID, CHILD_ID, DEVICE_ID, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockedChildren.verifyChildBelongsToParent).toHaveBeenCalledWith(CHILD_ID, PARENT_ID);
    });

    it('should throw NotFoundError when device does not belong to child', async () => {
      mockedQuery.mockReset();
      mockedChildren.verifyChildBelongsToParent.mockResolvedValue(undefined);
      mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        securityService.listWifiLogs(PARENT_ID, CHILD_ID, DEVICE_ID, 1, 20)
      ).rejects.toThrow(NotFoundError);
    });
  });
});
