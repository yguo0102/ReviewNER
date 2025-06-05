
import type { HighlightedSegment, TagType } from '@/components/ner/types';

const TAG_REGEX_GLOBAL = /(<name>|<location>|<date>|<[^>]+>)/g; // Support other potential tags too
const KNOWN_TAG_REGEX = /^(<name>|<location>|<date>)$/;

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface ParsedNewTextSegment {
  text: string;
  type: 'tag' | 'text';
  tagType?: TagType | string;
}

export function parseNewText(newText: string): ParsedNewTextSegment[] {
  const segments: ParsedNewTextSegment[] = [];
  let lastIndex = 0;

  for (const match of newText.matchAll(TAG_REGEX_GLOBAL)) {
    if (match.index === undefined) continue;
    if (match.index > lastIndex) {
      segments.push({
        text: newText.substring(lastIndex, match.index),
        type: 'text',
      });
    }
    const tagContent = match[0].slice(1, -1);
    segments.push({
      text: match[0],
      type: 'tag',
      tagType: tagContent as TagType | string,
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < newText.length) {
    segments.push({
      text: newText.substring(lastIndex),
      type: 'text',
    });
  }
  return segments;
}


export function getOldTextHighlightedParts(
  originalOldText: string,
  currentNewText: string
): HighlightedSegment[] {
  const parsedNewTextSegments = parseNewText(currentNewText);

  let patternString = "^";
  parsedNewTextSegments.forEach(segment => {
    if (segment.type === 'tag' && KNOWN_TAG_REGEX.test(segment.text)) {
      patternString += "(.*?)"; // Capture group for known tags
    } else {
      // Literal text or unknown tags (treated as literals in the regex pattern)
      patternString += escapeRegExp(segment.text);
    }
  });
  patternString += "$";

  try {
    const mainRegex = new RegExp(patternString, 's'); // 's' flag for dot to match newlines
    const matches = originalOldText.match(mainRegex);

    if (!matches) {
      // originalOldText does not match the structure implied by currentNewText
      return [{ text: originalOldText, isHighlighted: false }];
    }

    // matches[0] is the full originalOldText if the pattern matches
    // matches[1], matches[2], ... are the captured (.*?) groups for known tags
    const capturedEntities = matches.slice(1);
    const resultSegments: HighlightedSegment[] = [];
    let capturedEntityIndex = 0;

    for (const segment of parsedNewTextSegments) {
      if (segment.type === 'tag' && KNOWN_TAG_REGEX.test(segment.text)) {
        // This is a known tag; its content in originalOldText was captured by (.*?)
        const entityText = capturedEntities[capturedEntityIndex++];
        if (entityText !== undefined) {
          resultSegments.push({
            text: entityText,
            isHighlighted: true,
            tagType: segment.tagType,
          });
        } else {
          // Fallback if a capture group is unexpectedly undefined (should not happen if regex matches)
          resultSegments.push({ text: segment.text, isHighlighted: false, tagType: segment.tagType });
        }
      } else {
        // This is literal text from new_text, or an unknown tag (e.g., <customtag>).
        // The regex matched segment.text literally in originalOldText.
        // These are not highlighted in the "Original Text" view based on current styling logic.
        resultSegments.push({
          text: segment.text,
          isHighlighted: false,
          // tagType: segment.type === 'tag' ? segment.tagType : undefined, // Pass tagType if unknown tags need specific (non-highlight) styling
        });
      }
    }
    // Filter out any segments that might have resulted in empty text (e.g., if (.*?) captured an empty string)
    return resultSegments.filter(s => s.text.length > 0);

  } catch (error) {
    // console.error("Regex error in getOldTextHighlightedParts:", error);
    // Return the original text with an error message prepended for easier debugging.
    const errorMessage = `[Error during highlighting: ${error instanceof Error ? error.message : String(error)}] `;
    return [{ text: errorMessage + originalOldText, isHighlighted: false, tagType: 'error' }];
  }
}

// For new_text, we are using a standard Textarea, so we can't render highlights within it.
// This function is provided for completeness if a contentEditable div were used.
// For now, tags in new_text are visually distinct by their <tag> syntax.
export function getNewTextHighlightedParts(currentNewText: string): HighlightedSegment[] {
  const parsedSegments = parseNewText(currentNewText);
  return parsedSegments.map(segment => ({
    text: segment.text,
    isHighlighted: segment.type === 'tag' && KNOWN_TAG_REGEX.test(segment.text),
    tagType: segment.type === 'tag' ? segment.tagType : undefined,
  }));
}
