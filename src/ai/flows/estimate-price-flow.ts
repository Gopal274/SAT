'use server';
/**
 * @fileOverview An AI flow to estimate the future price of a product based on its history.
 *
 * - estimatePrice - A function that handles the price estimation process.
 * - EstimatePriceInput - The input type for the estimatePrice function.
 * - EstimatePriceOutput - The return type for the estimatePrice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const HistoricalRateSchema = z.object({
  rate: z.number().describe('The price of the product at a point in time.'),
  gst: z.number().describe('The GST percentage at that time.'),
  billDate: z.string().describe('The date of the price recording (ISO 8601 format).'),
});

const EstimatePriceInputSchema = z.object({
  productName: z.string().describe('The name of the product being analyzed.'),
  historicalRates: z
    .array(HistoricalRateSchema)
    .describe('An array of historical price points for the product, sorted from most recent to oldest.'),
});
export type EstimatePriceInput = z.infer<typeof EstimatePriceInputSchema>;

const ChartDataPointSchema = z.object({
    date: z.string().describe("The date for the data point in 'YYYY-MM-DD' format."),
    price: z.number().describe('The final price (including GST) on that date.'),
    type: z.enum(['historical', 'estimated']).describe("Indicates if the point is a historical fact or an AI estimation.")
});

const EstimatePriceOutputSchema = z.object({
  estimatedPrice: z.number().describe('The estimated next final price for the product, including GST.'),
  reasoning: z
    .string()
    .describe('A brief, one or two-sentence explanation for the estimated price, noting any trends or patterns observed.'),
  chartData: z.array(ChartDataPointSchema).describe("Data points for a trend chart. Include key historical points and the new estimated point."),
});
export type EstimatePriceOutput = z.infer<typeof EstimatePriceOutputSchema>;

export async function estimatePrice(input: EstimatePriceInput): Promise<EstimatePriceOutput> {
  return estimatePriceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'estimatePricePrompt',
  input: {schema: EstimatePriceInputSchema},
  output: {schema: EstimatePriceOutputSchema},
  prompt: `You are a financial analyst specializing in price forecasting for retail products.
Your task is to predict the next final price (including GST) for a given product based on its historical price data.

Analyze the provided historical rates for the product: '{{productName}}'.
The data is sorted from most recent to oldest.

{{#each historicalRates}}
- Date: {{billDate}}, Base Rate: {{rate}}, GST: {{gst}}%
{{/each}}

Identify any trends, seasonality, or patterns in the price history. Based on your analysis, provide a single numerical estimate for the next final price.
Also, provide a concise, one or two-sentence reasoning for your prediction. Do not provide a long analysis.

Finally, generate data for a trend chart in the 'chartData' field.
- The chart should visualize the price trend over time.
- Include a few significant historical points (e.g., the oldest, the most recent, and a few in between) to show the trend. Mark these with type: 'historical'.
- Include your new estimated price. For its date, use a date one month after the most recent historical bill date. Mark this with type: 'estimated'.
- All prices in the chart data must be the final price (base rate + GST).
`,
});

const estimatePriceFlow = ai.defineFlow(
  {
    name: 'estimatePriceFlow',
    inputSchema: EstimatePriceInputSchema,
    outputSchema: EstimatePriceOutputSchema,
  },
  async input => {
    let retries = 3;
    let delay = 1000;

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
    throw new Error('AI Service Unavailable after multiple retries.');
  }
);
