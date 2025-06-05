'use client';

import type { HighlightedSegment } from './types';
import { cn } from '@/lib/utils';

interface HighlightedTextRendererProps {
  segments: HighlightedSegment[];
  animationKey?: string | number; // To trigger re-animation
}

export function HighlightedTextRenderer({ segments, animationKey }: HighlightedTextRendererProps) {
  if (!segments || segments.length === 0) {
    return null;
  }

  const getHighlightClass = (tagType?: string, isNewlyAdded?: boolean) => {
    let baseClass = '';
    switch (tagType) {
      case 'name':
        baseClass = 'highlight-tag-name';
        break;
      case 'location':
        baseClass = 'highlight-tag-location';
        break;
      case 'date':
        baseClass = 'highlight-tag-date';
        break;
      default:
        baseClass = 'highlight-tag-default';
    }
    return cn(baseClass, isNewlyAdded && 'animate-pulse-bg');
  };

  return (
    <p className="text-base leading-relaxed whitespace-pre-wrap" key={animationKey}>
      {segments.map((segment, index) => (
        <span
          key={index}
          className={segment.isHighlighted ? getHighlightClass(segment.tagType, segment.isNewlyAdded) : ''}
        >
          {segment.text}
        </span>
      ))}
    </p>
  );
}
