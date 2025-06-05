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

  let pattern = "^";
  const actualTagsForCapture: ParsedNewTextSegment[] = [];

  parsedNewTextSegments.forEach(segment => {
    if (segment.type === 'tag' && KNOWN_TAG_REGEX.test(segment.text)) { // Only use known tags for regex capture
      pattern += "(.*?)";
      actualTagsForCapture.push(segment);
    } else if (segment.type === 'tag') { // Unknown tag, treat as literal
       pattern += escapeRegExp(segment.text);
    }
    else {
      pattern += escapeRegExp(segment.text);
    }
  });
  pattern += "$";

  try {
    const mainRegex = new RegExp(pattern, 's'); // 's' flag for dot to match newlines
    const matches = originalOldText.match(mainRegex);

    if (!matches) {
      return [{ text: originalOldText, isHighlighted: false }];
    }

    const capturedEntities = matches.slice(1);
    const resultSegments: HighlightedSegment[] = [];
    let tempOldText = originalOldText;
    let capturedEntityIndex = 0;

    for (const newSegment of parsedNewTextSegments) {
      if (newSegment.type === 'tag' && KNOWN_TAG_REGEX.test(newSegment.text)) {
        const entityText = capturedEntities[capturedEntityIndex++];
        if (entityText === undefined) { // Should not happen if regex matches
            // Fallback: add the tag itself as non-highlighted
            resultSegments.push({ text: newSegment.text, isHighlighted: false });
            continue;
        }
        
        const indexOfEntity = tempOldText.indexOf(entityText);
        if (indexOfEntity === 0) { // Entity is at the beginning of the current tempOldText part
            resultSegments.push({
                text: entityText,
                isHighlighted: true,
                tagType: newSegment.tagType,
            });
            tempOldText = tempOldText.substring(entityText.length);
        } else {
             // This indicates a mismatch or complex structure not handled by simple sequential processing.
             // Add the entity text as highlighted, and the preceding part as not highlighted.
             // This part is tricky and might need refinement for complex cases.
             // For now, assume simpler structure or accept potential visual artifacts if complex.
             if(indexOfEntity > 0) {
                resultSegments.push({ text: tempOldText.substring(0, indexOfEntity), isHighlighted: false});
             }
             resultSegments.push({ text: entityText, isHighlighted: true, tagType: newSegment.tagType });
             tempOldText = tempOldText.substring(indexOfEntity + entityText.length);
        }

      } else { // Literal text from new_text or unknown tag
        const literalText = newSegment.text;
        const indexOfLiteral = tempOldText.indexOf(literalText);
        if (indexOfLiteral === 0) {
            resultSegments.push({ text: literalText, isHighlighted: false });
            tempOldText = tempOldText.substring(literalText.length);
        } else {
            // Mismatch, this implies the structure of old_text doesn't perfectly map with new_text non-tag parts
            // Add the literal as is, and potentially log warning or handle error
            // For now, just add it and let tempOldText be, or try to recover
             if(indexOfLiteral > 0) { // Some text before the literal
                resultSegments.push({ text: tempOldText.substring(0, indexOfLiteral), isHighlighted: false});
             }
             resultSegments.push({ text: literalText, isHighlighted: false});
             if (indexOfLiteral !== -1) { // If found
                tempOldText = tempOldText.substring(indexOfLiteral + literalText.length);
             } else { // Not found, major mismatch
                if(tempOldText.length > 0) resultSegments.push({text: tempOldText, isHighlighted: false});
                tempOldText = ""; // Stop processing
             }
        }
      }
    }
     if (tempOldText.length > 0) { // Add any remaining part of old text
        resultSegments.push({ text: tempOldText, isHighlighted: false });
    }

    return resultSegments.filter(s => s.text.length > 0);

  } catch (error) {
    // console.error("Regex error in getOldTextHighlightedParts:", error);
    return [{ text: originalOldText, isHighlighted: false, tagType: 'error' }];
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

