'use server';

/**
 * @fileOverview A flow to correct NER tags in the new_text field based on the old_text field and predefined entity types.
 *
 * - correctNERTags - A function that handles the correction of NER tags.
 * - CorrectNERTagsInput - The input type for the correctNERTags function.
 * - CorrectNERTagsOutput - The return type for the correctNERTags function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CorrectNERTagsInputSchema = z.object({
  old_text: z.string().describe('The original text.'),
  new_text: z.string().describe('The text with NER tags.'),
});
export type CorrectNERTagsInput = z.infer<typeof CorrectNERTagsInputSchema>;

const CorrectNERTagsOutputSchema = z.object({
  corrected_text: z.string().describe('The corrected text with NER tags.'),
});
export type CorrectNERTagsOutput = z.infer<typeof CorrectNERTagsOutputSchema>;

export async function correctNERTags(input: CorrectNERTagsInput): Promise<CorrectNERTagsOutput> {
  return correctNERTagsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'correctNERTagsPrompt',
  input: {schema: CorrectNERTagsInputSchema},
  output: {schema: CorrectNERTagsOutputSchema},
  prompt: `You are an expert in Named Entity Recognition (NER). You are given an original text (old_text) and a modified text with NER tags (new_text). Your task is to identify and correct any potentially incorrect or missing NER tags in the new_text field, based on the old_text field and the following entity types: name, location, date.

Original Text (old_text): {{{old_text}}}
Modified Text (new_text): {{{new_text}}}

Your corrected text (corrected_text) should maintain the structure of new_text as much as possible, only modifying it when a tag is clearly incorrect or missing based on the original text and the entity types.

Output the corrected text with NER tags.
`,
});

const correctNERTagsFlow = ai.defineFlow(
  {
    name: 'correctNERTagsFlow',
    inputSchema: CorrectNERTagsInputSchema,
    outputSchema: CorrectNERTagsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
