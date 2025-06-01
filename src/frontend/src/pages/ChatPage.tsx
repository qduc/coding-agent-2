import { Helmet } from 'react-helmet-async';
import MainLayout from '../components/Layout/MainLayout';
import ChatInterface from '../components/Chat/ChatInterface';
import { useChat } from '../hooks/useChat';

export default function ChatPage() {
  const { messages, sendMessage, isStreaming } = useChat();

  return (
    <MainLayout>
      <Helmet>
        <title>Chat | DevAssistant</title>
        <meta name="description" content="Interactive chat interface with AI assistant" />
      </Helmet>
      <div className="flex flex-col h-full">
        <ChatInterface
          messages={messages}
          onSendMessage={sendMessage}
          isStreaming={isStreaming}
          // toolExecutions, isLoading, error props might also be needed
          // depending on ChatInterface's full definition
        />
      </div>
    </MainLayout>
  );
}
