import { CompletionItem, CompletionType } from './services/completion/CompletionProvider';

export interface InputState {
  value: string;
  cursorPosition: number;
  isMultilineMode: boolean;
  pasteIndicator: boolean;
}

export interface CompletionState {
  items: CompletionItem[];
  selectedIndex: number;
  isVisible: boolean;
  type: CompletionType | null;
}

export interface KeyboardEvent {
  inputChar: string;
  key: {
    return?: boolean;
    ctrl?: boolean;
    escape?: boolean;
    tab?: boolean;
    upArrow?: boolean;
    downArrow?: boolean;
    leftArrow?: boolean;
    rightArrow?: boolean;
    backspace?: boolean;
    delete?: boolean;
    meta?: boolean;
  };
}

export interface InputCallbacks {
  onSubmit: (input: string) => void;
  onExit: () => void;
  onInterrupt?: () => void;
  onInterruptOrExit?: () => void; // Added for unified interrupt/exit
}

export interface InputOptions {
  prompt?: string;
  initialInput?: string;
  maxWidth?: number;
  minHeight?: number;
  placeholder?: string;
  showCursor?: boolean;
  disabled?: boolean;
}

export interface SessionConfig {
  workingDirectory: string;
  maxFileSize: number;
  timeout: number;
  allowHidden: boolean;
  allowedExtensions: string[];
  blockedPaths: string[];
}
