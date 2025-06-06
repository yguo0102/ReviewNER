export type TagType = 'name' | 'location' | 'date';

export interface HighlightedSegment {
  text: string;
  isHighlighted: boolean;
  tagType?: TagType | string; // Allow string for other potential tags
  isNewlyAdded?: boolean; // For animation/styling cues
}

export interface NerSample {
  id: string;
  data: Record<string, string>; // Stores all columns from the CSV row
  // old_text and new_text are expected keys within data for core functionality
  original_new_text?: string; // To track changes for export
}
