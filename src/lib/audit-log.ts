export type AuditLog = {
  userId?: string;
  email?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  success?: boolean;
  message?: string;
  ip?: string;
  ua?: string;
  metadata?: Record<string, any>;
};

export async function logAudit(
  sql: any,
  data: AuditLog
) {
  await sql`
    INSERT INTO audit_logs (
      user_id,
      user_email,
      action,
      entity_type,
      entity_id,
      success,
      message,
      ip_address,
      user_agent,
      metadata
    ) VALUES (
      ${data.userId ?? null},
      ${data.email ?? null},
      ${data.action},
      ${data.entityType ?? null},
      ${data.entityId ?? null},
      ${data.success ?? true},
      ${data.message ?? null},
      ${data.ip ?? null},
      ${data.ua ?? null},
      ${JSON.stringify(data.metadata ?? {})}::jsonb
    )
  `;
}
