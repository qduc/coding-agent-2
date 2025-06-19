import { useApproval } from './ApprovalContext';

export type DestructiveActionDetails = {
  type: 'write' | 'command';
  path?: string; // for file actions
  diff?: string; // file diff for preview
  command?: string; // for bash actions
  cwd?: string;
};

export type ApprovalResponse = 'approved' | 'denied' | 'always-allow';

let alwaysAllowSession = false;

// New: context-aware approval
export async function requestApproval(details: DestructiveActionDetails): Promise<ApprovalResponse> {
  if (alwaysAllowSession) return 'approved';
  // Try to use Ink context if available
  if (typeof window === 'undefined') {
    // Not in browser, try React context
    try {
      // This will throw if not in Ink tree
      const { requestApproval } = useApproval();
      const prompt = buildPrompt(details);
      const result = await requestApproval(prompt, { key: getApprovalKey(details) });
      if (result.alwaysAllow) {
        alwaysAllowSession = true;
        return 'always-allow';
      }
      return result.approved ? 'approved' : 'denied';
    } catch {
      // Not in Ink context
      throw new Error('Approval prompt must be integrated into Ink render tree.');
    }
  }
  throw new Error('Approval prompt must be integrated into Ink render tree.');
}

function buildPrompt(details: DestructiveActionDetails): string {
  if (details.type === 'write') {
    return `Approve file write to ${details.path || 'unknown file'}?`;
  }
  if (details.type === 'command') {
    return `Approve running command: ${details.command || ''} in ${details.cwd || ''}?`;
  }
  return 'Approve destructive action?';
}

function getApprovalKey(details: DestructiveActionDetails): string {
  if (details.type === 'write') return `write:${details.path}`;
  if (details.type === 'command') return `cmd:${details.command}`;
  return 'unknown';
}

export function setAlwaysAllowSession(value: boolean) {
  alwaysAllowSession = value;
}

export function getAlwaysAllowSession() {
  return alwaysAllowSession;
}
