export const CURRENT_VERSION = '2.0.0';

export interface ChangeLogItem {
  version: string;
  date: string;
  features: string[];
  fixes?: string[];
}

export const CHANGELOG: ChangeLogItem[] = [
  {
    version: '2.0.0',
    date: '2026-02-13',
    features: [
      '🌟 **Gemini Platform Support**: Now works seamlessly with Gemini alongside AI Studio. Manage conversations across both platforms in one unified sidebar.',
      '🔄 **Automatic Conversation Sync**: Your latest conversations are automatically synced when you visit the page. Stay up-to-date effortlessly.',
      '🔗 **Unified Data Management**: Seamlessly share prompts and search across both Gemini and AI Studio. One library, two platforms.',
      '🎨 **Improved UI Layouts**: Enhanced compact and relaxed view options for better readability and visual comfort.',
    ],
    fixes: [
      'Optimized batch operations for improved performance and reliability when managing multiple items.',
      'Fixed various UI bugs and enhanced overall user experience with smoother interactions.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-01-31',
    features: [
      '🚀 **Prompt Library**: A powerful new module to manage your prompts with folders, tags, and variables.',
      '📥 **Conversation Export**: Export your conversations as Markdown, Plain Text, or JSON.',
      '🔍 **Deep Search**: Full-text search across all your conversations and messages. Find anything instantly.',
      '🌐 **Multi-Browser Support**: Now available for Firefox and Microsoft Edge.',
      "🔗 **Quick Shortcuts**: Added direct access to AI Studio's Build, Dashboard, and Documentation pages in the sidebar.",
      '✨ **QoL Improvements**: Enhanced UI, better navigation, and smoother interactions.',
      '❤️ **Open Source**: The code is now open source! Star us on GitHub if you like it!',
    ],
    fixes: [
      'Moved the "Switch to Original UI" button for better accessibility.',
      'Fixed various UI glitches and improved performance.',
    ],
  },
];
