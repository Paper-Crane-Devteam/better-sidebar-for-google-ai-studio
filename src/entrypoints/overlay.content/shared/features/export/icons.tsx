import React from 'react';

interface IconProps {
  className?: string;
}

/**
 * Obsidian logo icon (simplified vault/diamond shape).
 */
export const ObsidianIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 2L3 9l3 11h12l3-11L12 2z" />
    <path d="M12 2v20" />
    <path d="M3 9h18" />
  </svg>
);

/**
 * Notion logo icon (simplified "N" shape).
 */
export const NotionIcon = ({ className }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 7h2l4 10h2" />
    <path d="M16 7h-2" />
    <path d="M8 17h2" />
  </svg>
);
