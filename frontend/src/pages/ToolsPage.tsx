import { Helmet } from 'react-helmet-async';
import MainLayout from '../components/Layout/MainLayout';
import { ToolList } from '../components/Tools/ToolList';
import { ToolStatus } from '../components/Tools/ToolStatus';
import { useState, useCallback } from 'react';
import { ToolExecution } from '../components/Chat/types'; // Adjust path if necessary

// Mock data - replace with actual data source (e.g., useConfiguration or a dedicated tools hook)
const MOCK_AVAILABLE_TOOLS = [
  { name: 'file_system_tool', description: 'Access and modify files', enabled: true },
  { name: 'code_interpreter_tool', description: 'Execute Python code', enabled: false },
  { name: 'web_search_tool', description: 'Search the web', enabled: true },
];

const MOCK_CURRENT_TOOLS: ToolExecution[] = [
  // { id: 'tool_exec_1', toolName: 'file_system_tool', input: { command: 'readFile', path: 'src/index.ts'}, status: 'running', output: null, error: null },
];

export default function ToolsPage() {
  const [availableTools, setAvailableTools] = useState(MOCK_AVAILABLE_TOOLS);
  const [currentTools] = useState<ToolExecution[]>(MOCK_CURRENT_TOOLS);

  const handleToggleTool = useCallback((toolName: string, enabled: boolean) => {
    setAvailableTools(prevTools =>
      prevTools.map(tool =>
        tool.name === toolName ? { ...tool, enabled } : tool
      )
    );
    // In a real app, this would also update global config state and persist to backend
    console.log(`Toggled tool ${toolName} to ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  return (
    <MainLayout>
      <Helmet>
        <title>Tools | DevAssistant</title>
        <meta name="description" content="Manage and monitor tools" />
      </Helmet>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        <div className="lg:col-span-2">
          <ToolList
            availableTools={availableTools}
            onToggleTool={handleToggleTool}
          />
        </div>
        <div>
          <ToolStatus
            currentTools={currentTools}
          />
        </div>
      </div>
    </MainLayout>
  );
}
