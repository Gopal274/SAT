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

// Define tools for the LLM to access the database
const getProductRatesTool = ai.defineTool(
  {
    name: 'getProductRates',
    description: 'Retrieves the current rates and price history for products in the Trust database.',
    inputSchema: z.object({
      searchQuery: z.string().optional().describe('Optional product name to filter by.'),
    }),
    outputSchema: z.array(z.any()),
  },
  async (input) => {
    const products = await getAllProductsWithRates();
    if (input.searchQuery) {
      return products.filter(p => p.name.toLowerCase().includes(input.searchQuery!.toLowerCase()));
    }
    return products;
  }
);

const getOrdersStatusTool = ai.defineTool(
  {
    name: 'getOrdersStatus',
    description: 'Retrieves pending demands and delivery status of items for various departments.',
    inputSchema: z.object({
      department: z.string().optional().describe('Filter by department name (e.g., Langar, Hospital).'),
      source: z.string().optional().describe('Filter by source hub (e.g., Indore, Delhi).'),
    }),
    outputSchema: z.array(z.any()),
  },
  async (input) => {
    const orders = await getAllOrdersWithItems();
    let filtered = orders;
    if (input.department) {
      filtered = filtered.filter(o => o.partyName.toLowerCase().includes(input.department!.toLowerCase()));
    }
    if (input.source) {
      filtered = filtered.filter(o => o.sourceLocation?.toLowerCase().includes(input.source!.toLowerCase()));
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
    let retries = 4;
    let delay = 1500;

    while (retries > 0) {
      try {
        const response = await ai.generate({
          system: `You are the Shri Anandpur Trust Store Assistant. 
          You help management track supplies and product rates.
          
          RULES:
          1. Use the provided tools to check LIVE data before answering.
          2. If asked about pending items, look for items where receivedQuantity < quantity.
          3. Keep answers professional and respectful.
          4. If you don't find data for a specific product, mention that it might not be recorded yet.
          5. Today is ${new Date().toLocaleDateString()}.`,
          prompt: input.message,
          messages: input.history,
          tools: [getProductRatesTool, getOrdersStatusTool],
        });

        return response.text;
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
    return "I am currently experiencing heavy traffic while connecting to the Trust database. Please try again in a few seconds.";
  }
);
