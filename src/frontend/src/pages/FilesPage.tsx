import { Helmet } from 'react-helmet-async';
import MainLayout from '../components/Layout/MainLayout';
import { FileExplorer } from '../components/FileExplorer/FileExplorer';
import { FileToolbar } from '../components/FileExplorer/FileToolbar';

export default function FilesPage() {
  return (
    <MainLayout>
      <Helmet>
        <title>Files | DevAssistant</title>
        <meta name="description" content="Project file explorer" />
      </Helmet>
      <div className="flex flex-col h-full">
        <FileToolbar />
        <FileExplorer className="flex-1" />
      </div>
    </MainLayout>
  );
}
