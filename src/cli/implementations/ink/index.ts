// Main refactored handler
export { InkInputHandler } from './InkInputHandler';

// Components
export { InputComponent } from './components/InputComponent';
export { InputBox } from './components/InputBox';
export { HelpText } from './components/HelpText';
export { CompletionDropdown } from './components/CompletionDropdown';

// Hooks
export { useInputState } from './hooks/useInputState';
export { useCompletions } from './hooks/useCompletions';
export { useKeyboardHandler } from './hooks/useKeyboardHandler';

// Services
export { InkServiceFactory } from './services/InkServiceFactory';
export { CompletionManager } from './services/completion/CompletionManager';
export { ClipboardManager } from './services/clipboard/ClipboardManager';
export { InputSession } from './services/session/InputSession';
export { InteractiveSession } from './services/session/InteractiveSession';

// Providers
export { FileCompletionProvider } from './services/completion/FileCompletionProvider';
export { CommandCompletionProvider } from './services/completion/CommandCompletionProvider';

// Utilities
export { FuzzyMatcher } from './utils/FuzzyMatcher';

// Types and interfaces
export * from './types';
export { CompletionProvider } from './services/completion/CompletionProvider';
export { ClipboardProvider } from './services/clipboard/ClipboardProvider';