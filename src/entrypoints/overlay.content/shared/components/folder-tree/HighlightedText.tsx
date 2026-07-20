import React, { useMemo } from 'react';

interface HighlightedTextProps {
  text: string;
  query?: string;
  className?: string;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({ text, query, className }) => {
  const parts = useMemo(() => {
    const trimmed = query?.trim();
    if (!trimmed || !text) return null;

    const escaped = escapeRegExp(trimmed);
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.split(regex);
  }, [text, query]);

  if (!parts) {
    return <span className={className}>{text}</span>;
  }

  const trimmedQuery = query?.trim().toLowerCase() || '';

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmedQuery ? (
          <mark
            key={i}
            className="bg-highlight/65 text-foreground rounded-[2px]"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </span>
  );
};
