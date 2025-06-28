import { useEffect } from 'react';
import { eventBus } from '../../shared/utils/EventBus';
import { useApproval } from './ApprovalContext';

/**
 * Listens for approval-request events from the eventBus and routes them to Ink Approval UI.
 * Should be rendered inside ApprovalProvider.
 */
export function ApprovalEventBridge() {
  const { requestApproval } = useApproval();

  useEffect(() => {
    function handleApprovalRequest({ details, callback }: any) {
      const prompt = details.type === 'write'
        ? `Approve file write to ${details.path || 'unknown file'}?`
        : 'Approve destructive action?';
      requestApproval(prompt, { key: details.path })
        .then(result => {
          if (result.alwaysAllow) callback('always-allow');
          else callback(result.approved ? 'approved' : 'denied');
        })
        .catch(() => callback('denied'));
    }
    eventBus.on('approval-request', handleApprovalRequest);
    return () => { eventBus.off('approval-request', handleApprovalRequest); };
  }, [requestApproval]);
  return null;
}
