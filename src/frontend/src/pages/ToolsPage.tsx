import { Helmet } from 'react-helmet-async';
import MainLayout from '../components/Layout/MainLayout';
import { ToolList } from '../components/Tools/ToolList';
import { ToolStatus } from '../components/Tools/ToolStatus';

export default function ToolsPage() {
  return (
    <MainLayout>
      <Helmet>
        <title>Tools | DevAssistant</title>
        <meta name="description" content="Manage and monitor tools" />
      </Helmet>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        <div className="lg:col-span-2">
          <ToolList />
        </div>
        <div>
          <ToolStatus />
        </div>
      </div>
    </MainLayout>
  );
}
