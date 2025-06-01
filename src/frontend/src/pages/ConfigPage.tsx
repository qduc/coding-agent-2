import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import MainLayout from '../components/Layout/MainLayout';
import ConfigPanel from '../components/Configuration/ConfigPanel';

export default function ConfigPage() {
  const [hasChanges, setHasChanges] = useState(false);

  return (
    <MainLayout>
      <Helmet>
        <title>Settings | DevAssistant</title>
        <meta name="description" content="Configure application settings" />
      </Helmet>
      <div className="p-4 max-w-4xl mx-auto">
        <ConfigPanel 
          onConfigChange={() => setHasChanges(true)}
          hasChanges={hasChanges}
          onSave={() => {
            setHasChanges(false);
            return Promise.resolve();
          }}
        />
      </div>
    </MainLayout>
  );
}
