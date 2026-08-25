// voiceCommand.service.ts
// Voice command recording and listing.

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';
import { toOffset } from '../../utils/pagination';

export interface VoiceCommandInput {
  command_text: string;
  intent?: string;
  was_executed?: boolean;
}

const COMMAND_COLUMNS = `id, child_id, device_id, command_text, intent, was_executed, recorded_at`;

export const recordCommand = async (
  deviceId: string,
  input: VoiceCommandInput
): Promise<Record<string, unknown>> => {
  const device = await query(
    `SELECT d.id, d.child_id FROM devices d WHERE d.id = $1`,
    [deviceId]
  );
  if (device.rows.length === 0) throw new NotFoundError('Device not found');

  const childId = device.rows[0].child_id;

  const result = await query(
    `INSERT INTO voice_commands (child_id, device_id, command_text, intent, was_executed)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COMMAND_COLUMNS}`,
    [
      childId,
      deviceId,
      input.command_text,
      input.intent ?? null,
      input.was_executed ?? false,
    ]
  );

  await writeAuditLog({
    actorId: childId,
    targetChildId: childId,
    action: 'VOICE_COMMAND_RECORDED',
    resourceType: 'voice_commands',
    details: {
      command_id: result.rows[0].id,
      device_id: deviceId,
      intent: input.intent,
      was_executed: input.was_executed ?? false,
    },
  });

  return result.rows[0];
};

export const listCommands = async (
  parentId: string,
  childId: string,
  page = 1,
  limit = 20
): Promise<{ items: Array<Record<string, unknown>>; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM voice_commands WHERE child_id = $1`,
    [childId]
  );

  const result = await query(
    `SELECT ${COMMAND_COLUMNS}
     FROM voice_commands
     WHERE child_id = $1
     ORDER BY recorded_at DESC
     LIMIT $2 OFFSET $3`,
    [childId, limit, toOffset(page, limit)]
  );

  return { items: result.rows, total: countResult.rows[0].total };
};
