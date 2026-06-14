
'use server';
/**
 * @fileOverview An AI flow to extract logistics details from a "Samagri Gate Pass".
 *
 * - scanDispatch - A function that handles the gate pass extraction.
 * - ScanDispatchInput - The input type for the scanDispatch function.
 * - ScanDispatchOutput - The return type for the scanDispatch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScanDispatchInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a Gate Pass (Samagri Gate Pass), as a data URI."
    ),
});
export type ScanDispatchInput = z.infer<typeof ScanDispatchInputSchema>;

const ScanDispatchOutputSchema = z.object({
  partyName: z.string().optional().describe('The department (Vibhaag) mentioned, e.g., "Truck Workshop".'),
  productName: z.string().optional().describe('The name of the item being sent.'),
  quantity: z.number().optional().describe('The quantity (Sankhya).'),
  unit: z.string().optional().describe('The unit, e.g., "Nag", "Kg".'),
  dispatchReason: z.enum(['purchased', 'sample', 'repairing', 'exchange', 'return', 'replacement', 'new_stock']).optional().describe('The reason (Karan) for taking the item out.'),
  destination: z.string().optional().describe('Where to send (Saman Kahan Bhejna Hai).'),
  recipientName: z.string().optional().describe('To whom to send (Saman Kisko Bhejna Hai).'),
  dispatchedAt: z.string().optional().describe('The date (Dinaank) in YYYY-MM-DD format.'),
});
export type ScanDispatchOutput = z.infer<typeof ScanDispatchOutputSchema>;

export async function scanDispatch(input: ScanDispatchInput): Promise<ScanDispatchOutput> {
  return scanDispatchFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scanDispatchPrompt',
  input: {schema: ScanDispatchInputSchema},
  output: {schema: ScanDispatchOutputSchema},
  prompt: `You are an expert OCR assistant for "Shri Anandpur Trust".
Your task is to analyze the provided image of a "SAMAGRI GATE PASS" and extract the logistics details.

PHOTO: {{media url=photoDataUri}}

INSTRUCTIONS:
1. Extract "Vibhaag" as 'partyName'.
2. Extract "Saman ka Vivaran" as 'productName'.
3. Extract "Sankhya" as 'quantity' (convert text to number) and 'unit'.
4. Extract "Gate se bahar jaane ka karan" and map it to 'dispatchReason':
   - "Repair" -> 'repairing'
   - "Naya stock" -> 'new_stock'
   - "Sample" -> 'sample'
   - Otherwise try to find the best fit.
5. Extract "Saman kahan bhejna hai" as 'destination'.
6. Extract "Saman kisko bhejna hai" as 'recipientName'.
7. Extract "Dinaank" as 'dispatchedAt' (format: YYYY-MM-DD).

Return the structured data for the dispatch record.`,
});

const scanDispatchFlow = ai.defineFlow(
  {
    name: 'scanDispatchFlow',
    inputSchema: ScanDispatchInputSchema,
    outputSchema: ScanDispatchOutputSchema,
  },
  async input => {
    let retries = 3;
    let delay = 1500;

    while (retries > 0) {
      try {
        const {output} = await prompt(input);
        return output!;
      } catch (error: any) {
        if (retries === 1 || !error.message?.includes('503')) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
        retries--;
        delay *= 2;
      }
    }
    throw new Error('Gate Pass scanner is currently unavailable. Please try again.');
  }
);
