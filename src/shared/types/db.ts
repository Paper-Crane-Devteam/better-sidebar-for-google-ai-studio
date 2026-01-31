export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  order_index: number;
  created_at: number;
  updated_at: number;
}

export interface Conversation {
  id: string;
  title: string | null;
  folder_id: string | null;
  external_id: string | null;
  external_url: string | null;
  model_name: string | null;
  type: string;
  order_index: number;
  updated_at: number;
  created_at: number;
  prompt_metadata: any;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'model';
  content: string | null;
  message_type: 'text' | 'thought';
  order_index: number;
  timestamp: number;
}

export interface Favorite {
  id: string;
  target_id: string;
  target_type: 'conversation' | 'message' | 'prompt';
  note: string | null;
  created_at: number;
}

export interface PromptFolder {
  id: string;
  name: string;
  parent_id: string | null;
  order_index: number;
  created_at: number;
  updated_at: number;
}

export interface Prompt {
  id: string;
  title: string;
  content: string;
  type: 'normal' | 'system';
  icon?: string;
  folder_id: string | null;
  order_index: number;
  created_at: number;
  updated_at: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  created_at: number;
}

export interface ConversationTag {
  conversation_id: string;
  tag_id: string;
  created_at: number;
}
