'use server';
/**
 * @fileOverview An AI flow to analyze the current supply chain status and provide insights.
 *
 * - analyzeSupply - A function that handles the supply chain analysis process.
 * - SupplyAnalysisInput - The input type for the analyzeSupply function.
 * - SupplyAnalysisOutput - The return type for the analyzeSupply function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PendingItemSchema = z.object({
  productName: z.string(),
  department: z.string(),
  pendingQty: z.number(),
  unit: z.string(),
  daysPending: z.number(),
  source: z.string(),
});

const SupplyAnalysisInputSchema = z.object({
  pendingItems: z.array(PendingItemSchema).describe('List of all currently pending items across the Trust.'),
  totalPendingCount: z.number(),
});
export type SupplyAnalysisInput = z.infer<typeof SupplyAnalysisInputSchema>;

const SupplyAnalysisOutputSchema = z.object({
  prioritySummary: z.string().describe('A high-level summary of the most urgent supply needs.'),
  sourcePerformance: z.string().describe('Insights into which purchasing hubs (Indore, Delhi, etc.) are currently overloaded or efficient.'),
  criticalItems: z.array(z.string()).describe('A list of specific items that need immediate attention.'),
  suggestedActions: z.array(z.string()).describe('Specific steps the Trust can take to resolve bottlenecks.'),
});
export type SupplyAnalysisOutput = z.infer<typeof SupplyAnalysisOutputSchema>;

export async function analyzeSupply(input: SupplyAnalysisInput): Promise<SupplyAnalysisOutput> {
  return analyzeSupplyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeSupplyPrompt',
  input: {schema: SupplyAnalysisInputSchema},
  output: {schema: SupplyAnalysisOutputSchema},
  prompt: `You are a Supply Chain Intelligence Expert for "Shri Anandpur Trust".
You have been provided with a list of {{totalPendingCount}} pending items that need to be purchased and delivered to various departments.

PENDING DATA:
{{#each pendingItems}}
- Item: {{productName}}, Dept: {{department}}, Qty: {{pendingQty}} {{unit}}, Source: {{source}}, Days Pending: {{daysPending}}
{{/each}}

TASK:
Analyze this data and provide a professional, concise management report for the Trust officials.

1. **Priority Summary**: Summarize which departments are suffering the most and why.
2. **Source Performance**: Analyze the workload of different sources (Indore, Delhi, Gwalior, etc.). Which one has the most "stale" (old) orders?
3. **Critical Items**: List 3-5 items that are either high quantity or have been waiting the longest.
4. **Suggested Actions**: Provide 3 clear recommendations (e.g., "Redirect Indore purchases to Gwalior temporarily" or "Prioritize the Hospital department's food supplies").

Keep the tone respectful and professional, suitable for a religious Trust management meeting.
`,
});

const analyzeSupplyFlow = ai.defineFlow(
  {
    name: 'analyzeSupplyFlow',
    inputSchema: SupplyAnalysisInputSchema,
    outputSchema: SupplyAnalysisOutputSchema,
  },
  async input => {
    let retries = 4;
    let delay = 1500;

    while (retries > 0) {
      try {
        const {output} = await prompt(input);
        return output!;
      } catch (error: any) {
        const isRetryable = error.message?.includes('503') || 
                          error.message?.includes('429') || 
                          error.message?.includes('overloaded') ||
                          error.message?.includes('deadline');

        if (retries === 1 || !isRetryable) throw error;
        
        await new Promise(resolve => setTimeout(resolve, delay));
        retries--;
        delay *= 2; 
      }
    }
    throw new Error('AI analysis is temporarily unavailable due to high demand. Please try again later.');
  }
);
