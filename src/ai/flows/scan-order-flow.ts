'use server';
/**
 * @fileOverview An AI flow to extract order items from a photo or PDF of a handwritten/printed list.
 *
 * - scanOrder - A function that handles the visual extraction process.
 * - ScanOrderInput - The input type for the scanOrder function.
 * - ScanOrderOutput - The return type for the scanOrder function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScanOrderInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of an order list, as a public URL or a data URI (which must include a MIME type and use Base64 encoding)."
    ),
});
export type ScanOrderInput = z.infer<typeof ScanOrderInputSchema>;

const ExtractedItemSchema = z.object({
  productName: z.string().describe('The name of the product identified.'),
  quantity: z.number().describe('The quantity requested.'),
  unit: z.string().describe('The unit of measurement (kg, piece, etc.).'),
  remark: z.string().optional().describe('Any handwritten notes or specific instructions for this item.'),
});

const ScanOrderOutputSchema = z.object({
  partyName: z.string().optional().describe('The department or store name if mentioned in the list.'),
  items: z.array(ExtractedItemSchema).describe('The list of products found in the document.'),
});
export type ScanOrderOutput = z.infer<typeof ScanOrderOutputSchema>;

export async function scanOrder(input: ScanOrderInput): Promise<ScanOrderOutput> {
  return scanOrderFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scanOrderPrompt',
  input: {schema: ScanOrderInputSchema},
  output: {schema: ScanOrderOutputSchema},
  prompt: `You are an expert OCR assistant for "Shri Anandpur Trust".
Your task is to look at the provided image or PDF page and extract a list of items requested for purchase.

The document may be a handwritten slip or a printed demand note.

PHOTO: {{media url=photoDataUri}}

INSTRUCTIONS:
1. Identify all products, their quantities, and their units.
2. If there are any notes next to an item (like "Urgent" or "Special quality"), put them in the 'remark' field.
3. If a department name (like "Langar", "Hospital", "Office") is visible at the top, extract it as 'partyName'.
4. If a quantity is written as text (like "Ten"), convert it to a number (10).
5. Ensure the product names are clean and professional.

Return the data in a structured format suitable for an inventory system.`,
});

const scanOrderFlow = ai.defineFlow(
  {
    name: 'scanOrderFlow',
    inputSchema: ScanOrderInputSchema,
    outputSchema: ScanOrderOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
