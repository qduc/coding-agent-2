// Project context placeholder
// This file should contain project-related context

import { ProjectDiscoveryResult } from '../../../src/shared/utils/projectDiscovery';

export interface ProjectContextType {
  currentProject?: ProjectDiscoveryResult;
  workingDirectory: string;
  setWorkingDirectory: (path: string) => void;
  refreshProject: () => Promise<void>;
}

// Placeholder exports
export const ProjectContext = {} as any;
export const useProject = () => ({} as ProjectContextType);
