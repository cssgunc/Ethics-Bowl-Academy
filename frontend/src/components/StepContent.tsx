'use client';

import React from 'react';

interface StepContentProps {
  content: string;
  /**
   * When true, suppress the block-level div wrapper so text flows inline
   * with adjacent elements (e.g. a question number). Default: false.
   */
  inline?: boolean;
}

// Matches <img src="..." ... /> — only the src attribute is extracted for rendering
const IMG_TAG_RE = /<img\s[^>]*?src="([^"]*)"[^>]*?\/>/g;

export default function StepContent({ content, inline = false }: StepContentProps) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = new RegExp(IMG_TAG_RE.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    const src = match[1];
    // Block javascript: and data: URLs — only allow https://
    if (src.startsWith('https://')) {
      parts.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={match.index}
          src={src}
          alt="Image"
          style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0.25rem auto' }}
        />
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  if (parts.length === 0) {
    return <>{content}</>;
  }

  return inline ? <>{parts}</> : <div>{parts}</div>;
}
