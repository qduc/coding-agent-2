import { Helmet } from 'react-helmet-async';
import MainLayout from '../components/Layout/MainLayout';
import ChatInterface from '../components/Chat/ChatInterface';

export default function ChatPage() {
  return (
    <MainLayout>
      <Helmet>
        <title>Chat | DevAssistant</title>
        <meta name="description" content="Interactive chat interface with AI assistant" />
      </Helmet>
      <div className="flex flex-col h-full">
        <ChatInterface />
      </div>
    </MainLayout>
  );
}
