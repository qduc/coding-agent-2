import React, {createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode} from "react";
import ApprovalPrompt from "./ApprovalPrompt";

export type ApprovalResult = { approved: boolean; alwaysAllow?: boolean };
type ApprovalRequest = {
  prompt: string;
  key?: string;
  resolve: (result: ApprovalResult) => void;
  reject: (reason?: any) => void;
};

type RequestApproval = (prompt: string, options?: {key?: string}) => Promise<ApprovalResult>;
type ApprovalContextType = {
  requestApproval: RequestApproval;
};

const ApprovalContext = createContext<ApprovalContextType | undefined>(undefined);

export const useApproval = () => {
  const ctx = useContext(ApprovalContext);
  if (!ctx) throw new Error("useApproval must be used within ApprovalProvider");
  return ctx;
};

export const ApprovalProvider = ({children}:{children:ReactNode}) => {
  const [queue, setQueue] = useState<ApprovalRequest[]>([]);
  const [current, setCurrent] = useState<ApprovalRequest|null>(null);
  const alwaysAllowed = useRef<Record<string, boolean>>({});

  const requestApproval: RequestApproval = useCallback((prompt, options) => {
    const key = options?.key;
    if (key && alwaysAllowed.current[key]) {
      return Promise.resolve({approved:true, alwaysAllow:true});
    }
    return new Promise<ApprovalResult>((resolve, reject) => {
      const req:ApprovalRequest = {prompt, key, resolve, reject};
      setQueue(q => [...q, req]);
    });
  }, []);

  // Whenever queue or current changes, pick first if none active
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue(q => q.slice(1));
    }
  }, [queue, current]);

  const handleRespond = (result:ApprovalResult) => {
    if (current) {
      if (result.alwaysAllow && current.key) {
        alwaysAllowed.current[current.key] = true;
      }
      current.resolve(result);
      setCurrent(null);
    }
  };

  return (
    <ApprovalContext.Provider value={{requestApproval}}>
      {children}
      {current && (
        <ApprovalPrompt prompt={current.prompt} onRespond={handleRespond} />
      )}
    </ApprovalContext.Provider>
  );
};
