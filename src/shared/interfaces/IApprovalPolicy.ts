export type DestructiveActionType = 'write' | 'command';

export interface DestructiveActionDetails {
  type: DestructiveActionType;
  path?: string; // file actions
  diff?: string;
  command?: string; // for bash
  cwd?: string;
}

export type ApprovalResponse = 'approved' | 'denied' | 'always-allow';
