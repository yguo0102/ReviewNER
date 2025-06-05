# **App Name**: ReviewNER

## Core Features:

- Data Loading and Display: Display the old_text in a read-only text field and new_text in an editable text field, and automatically load the data.
- Tag Highlighting: Highlight existing tags (e.g., <name>, <location>, <date>) in the editable text field. Also, highlight the original words of corresponding tag in the read-only text field.
- Text Editing: Allow users to edit the new_text field to revert tags to the original word or add new tags.
- Added Tag Highlighting: Provide visual cues for newly added or modified tags.
- AI-Powered Tag Correction: Use a generative AI tool that automatically corrects/adds tags if they don't match with the given ontology and suggest proper entity.

## Style Guidelines:

- Primary color: A muted blue (#6699CC) to create a calm, focused environment.
- Background color: Light gray (#F0F0F0), very slightly tinged with blue.
- Accent color: A warm orange (#FFB347) to highlight interactive elements and new tags, ensuring they stand out.
- Body and headline font: 'Inter' sans-serif font for its modern, readable style.
- Use simple, clear icons for actions like saving, loading, and using AI to make changes.
- A clear, two-panel layout with the old_text and new_text fields side-by-side for easy comparison.
- Subtle animations to draw attention to newly highlighted or corrected tags.