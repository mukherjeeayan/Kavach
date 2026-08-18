// AppBlockRule.model.ts
// Represents an app blocking rule tied to a specific child.
// Maps directly to the `app_block_rules` table in PostgreSQL.

export interface AppBlockRule {
  id: string;                   // UUID primary key
  child_id: string;             // FK -> children.id
  device_id: string;            // FK -> devices.id
  package_name: string;         // e.g. "com.instagram.android"
  app_name: string | null;      // Human-readable name, nullable
  is_blocked: boolean;
  block_reason: string | null;  // Why the parent blocked this app
  unblock_requested: boolean;   // Whether the child has asked for unblock
  unblock_reason: string | null;// Child's reason for requesting unblock
  created_at: string;
  updated_at: string;
}

// Used when creating a new block rule — omits server-generated fields
export interface CreateAppBlockRuleInput {
  child_id: string;
  device_id: string;
  package_name: string;
  app_name?: string;
  block_reason?: string;
}
