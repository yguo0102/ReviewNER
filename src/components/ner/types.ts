export type TagType = 'name' | 'location' | 'date';

export interface HighlightedSegment {
  text: string;
  isHighlighted: boolean;
  tagType?: TagType | string; // Allow string for other potential tags
  isNewlyAdded?: boolean; // For animation/styling cues
}

export interface NerSample {
  id: string;
  old_text: string;
  new_text: string;
}
