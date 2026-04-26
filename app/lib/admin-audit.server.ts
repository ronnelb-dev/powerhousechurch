import { db } from "~/lib/db.server";
import { getClientIpAddress } from "~/lib/rate-limit.server";

type AuditActorRole = "ADMIN" | "CELL_LEADER" | "MEMBER";

type AuditEventInput = {
  request: Request;
  actorId?: string | null;
  actorRole: AuditActorRole | string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  details?: Record<string, unknown> | null;
};

function truncateUserAgent(value: string | null) {
  if (!value) return null;
  return value.slice(0, 512);
}

export async function recordAdminAuditEvent(input: AuditEventInput) {
  const auditModel = (db as unknown as {
    adminAuditLog?: {
      create(args: {
        data: {
          actorId: string | null;
          actorRole: string;
          action: string;
          entityType: string;
          entityId: string | null;
          summary: string;
          details?: Record<string, unknown> | null;
          ipAddress: string;
          userAgent: string | null;
        };
      }): Promise<unknown>;
    };
  }).adminAuditLog;

  if (!auditModel) {
    return;
  }

  try {
    await auditModel.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        details: input.details ?? null,
        ipAddress: getClientIpAddress(input.request),
        userAgent: truncateUserAgent(input.request.headers.get("user-agent")),
      },
    });
  } catch (error) {
    console.error("[admin-audit] Failed to record audit event:", error);
  }
}
