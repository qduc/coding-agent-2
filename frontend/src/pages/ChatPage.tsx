import { Helmet } from 'react-helmet-async';
import ChatInterface from '../components/Chat/ChatInterface';
import { useChat } from '../hooks/useChat';

export default function ChatPage() {
  const { messages, sendMessage, isStreaming } = useChat();

  return (
    <>
      <Helmet>
        <title>Chat | DevAssistant</title>
        <meta name="description" content="Interactive chat interface with AI assistant" />
      </Helmet>
      <div className="flex flex-col h-full">
        <ChatInterface
          messages={messages}
          onSendMessage={sendMessage}
          isStreaming={isStreaming}
          // toolExecutions, isLoading, error props are not provided by useChat in current context
          // and are optional in ChatInterfaceProps, so no explicit passing needed if not available.
        />
      </div>
    </>
  );
}