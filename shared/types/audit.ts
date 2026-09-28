/**
 * DevaSetu Audit Trail & Governance Types
 */
import type { ID } from './common.js';
import type { AuditAction, AuditEntityType } from './enums.js';

export interface AuditLog {
  _id: ID;
  actorId: ID | any;
  actorRole: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: ID;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}
