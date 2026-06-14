'use server';
/**
 * @fileOverview A conversational AI assistant for the Shri Anandpur Trust store.
 * 
 * This flow allows users to ask questions about products, rates, and pending orders.
 * It uses tools to query Firestore data in real-time.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getAllProductsWithRates, getAllOrdersWithItems } from '@/lib/data';

// Optimized tools: request ONLY latest rates to stay within processing limits
const getProductRatesTool = ai.defineTool(
  {
    name: 'getProductRates',
    description: 'Retrieves current rates for products. Use this to check latest prices.',
    inputSchema: z.object({
      searchQuery: z.string().optional().describe('Optional product name to filter by.'),
    }),
    outputSchema: z.array(z.any()),
  },
  async (input) => {
    // Optimization: only fetch latest rate for chat context
    const products = await getAllProductsWithRates({ onlyLatestRate: true });
    if (input.searchQuery) {
      const search = input.searchQuery.toLowerCase();
      return products.filter(p => p.name.toLowerCase().includes(search));
    }
    return products;
  }
);

const getOrdersStatusTool = ai.defineTool(
  {
    name: 'getOrdersStatus',
    description: 'Retrieves status of pending items for departments.',
    inputSchema: z.object({
      department: z.string().optional().describe('Filter by department name.'),
      source: z.string().optional().describe('Filter by source hub.'),
    }),
    outputSchema: z.array(z.any()),
  },
  async (input) => {
    const orders = await getAllOrdersWithItems();
    let filtered = orders;
    if (input.department) {
      const dept = input.department.toLowerCase();
      filtered = filtered.filter(o => o.partyName.toLowerCase().includes(dept));
    }
    if (input.source) {
      const src = input.source.toLowerCase();
      filtered = filtered.filter(o => o.sourceLocation?.toLowerCase().includes(src));
    }
    return filtered;
  }
);

const ChatInputSchema = z.object({
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.array(z.object({ text: z.string() })),
  })).optional(),
  message: z.string(),
});

export async function trustChat(input: z.infer<typeof ChatInputSchema>) {
  return trustChatFlow(input);
}

const trustChatFlow = ai.defineFlow(
  {
    name: 'trustChatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    let retries = 3;
    let delay = 1000; // Shorter initial delay to stay within server action limits

    while (retries > 0) {
      try {
        const response = await ai.generate({
          system: `You are the Shri Anandpur Trust Store Assistant. 
          Respond naturally to greetings like "Hi" or "Hello".
          
          RULES:
          1. Use tools ONLY if the user asks for specific data or reports.
          2. For greetings, just reply respectfully without checking the database.
          3. Today is ${new Date().toLocaleDateString()}.`,
          prompt: input.message,
          messages: input.history,
          tools: [getProductRatesTool, getOrdersStatusTool],
        });

        return response.text;
      } catch (error: any) {
        const isRetryable = error.message?.includes('503') || 
                          error.message?.includes('429') || 
                          error.message?.includes('overloaded');
                          
        if (retries === 1 || !isRetryable) throw error;
        
        await new Promise(resolve => setTimeout(resolve, delay));
        retries--;
        delay *= 2;
      }
    }
    return "I am currently experiencing heavy traffic. Please try your request one more time.";
  }
);
