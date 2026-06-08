
'use client';

import * as React from 'react';
import {
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Wand2 } from 'lucide-react';
import type { ProductWithRates } from '@/lib/types';
import { estimatePrice, type EstimatePriceOutput } from '@/ai/flows/estimate-price-flow';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';
import { safeToDate } from '@/lib/utils';
import { ChartContainer, ChartTooltipContent } from './ui/chart';
import type { ChartConfig } from './ui/chart';

interface PriceEstimatorProps {
  productsWithRates: ProductWithRates[];
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
};

const chartConfig = {
  price: {
    label: "Price",
    color: "hsl(var(--chart-1))",
  },
  estimated: {
    label: "Estimated",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;


export function PriceEstimator({ productsWithRates }: PriceEstimatorProps) {
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  const [isEstimating, setIsEstimating] = React.useState(false);
  const [estimationResult, setEstimationResult] = React.useState<EstimatePriceOutput | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    // Select a product with a trend by default to make it easy to start
    if (!selectedProductId && productsWithRates.length > 0) {
      const firstProductWithTrend = productsWithRates.find(p => p.rates && p.rates.length > 1);
      if (firstProductWithTrend) {
        setSelectedProductId(firstProductWithTrend.id);
      }
    }
  }, [productsWithRates, selectedProductId]);

  const selectedProduct = React.useMemo(() => {
    return productsWithRates.find(p => p.id === selectedProductId);
  }, [selectedProductId, productsWithRates]);
  
  const handleEstimate = async () => {
    if (!selectedProduct) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a product first.' });
      return;
    }
    
    const historicalRatesForFlow = selectedProduct.rates.map(r => ({
        rate: r.rate,
        gst: r.gst,
        billDate: safeToDate(r.billDate).toISOString(),
    }));

    setIsEstimating(true);
    setEstimationResult(null);

    try {
      const result = await estimatePrice({
        productName: selectedProduct.name,
        historicalRates: historicalRatesForFlow,
      });
      setEstimationResult(result);
    } catch (error) {
      console.error("Estimation Error:", error);
      toast({ variant: 'destructive', title: 'Estimation Failed', description: 'Could not generate a price estimate.' });
    } finally {
      setIsEstimating(false);
    }
  };
  
  const chartData = React.useMemo(() => {
    if (!estimationResult?.chartData) return [];
    return estimationResult.chartData.map(d => ({...d, date: new Date(d.date).getTime()})).sort((a,b) => a.date - b.date);
  }, [estimationResult]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Price Estimator</CardTitle>
        <CardDescription>Predict the next price for a product using AI.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Select onValueChange={setSelectedProductId} value={selectedProductId ?? undefined}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a product to estimate" />
            </SelectTrigger>
            <SelectContent>
              {productsWithRates
                .filter(p => p.rates && p.rates.length > 0)
                .sort((a,b) => a.name.localeCompare(b.name))
                .map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          
          <Button onClick={handleEstimate} disabled={isEstimating || !selectedProductId} className="w-full">
            <Wand2 className="mr-2 h-4 w-4" />
            {isEstimating ? 'Estimating...' : 'Estimate Next Price'}
          </Button>

          {isEstimating && (
            <div className="space-y-2 pt-2">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-48 w-full mt-2" />
            </div>
          )}

          {estimationResult && (
            <div className="pt-2 space-y-4">
              <div>
                  <p className="text-sm text-muted-foreground">Estimated Next Price:</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(estimationResult.estimatedPrice)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{estimationResult.reasoning}</p>
              </div>

              {chartData.length > 0 && (
                <div className="h-48 w-full">
                    <ChartContainer config={chartConfig} className="min-h-[100px] w-full h-full">
                        <ResponsiveContainer>
                            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    type="number"
                                    scale="time"
                                    domain={['dataMin', 'dataMax']}
                                    tickFormatter={(tick) => format(new Date(tick), 'MMM yy')}
                                    tick={{ fontSize: 12 }}
                                />
                                <YAxis 
                                    tickFormatter={(tick) => formatCurrency(tick)}
                                    tick={{ fontSize: 12 }}
                                    domain={['dataMin - (dataMax - dataMin) * 0.2', 'dataMax + (dataMax - dataMin) * 0.2']}
                                />
                                <Tooltip
                                    content={<ChartTooltipContent 
                                        labelFormatter={(label) => format(new Date(label), "dd MMM yyyy")}
                                        formatter={(value, name, props) => (
                                          <div className='flex flex-col'>
                                            <span className='font-bold'>{formatCurrency(value as number)}</span>
                                            <span className='text-xs'>{props.payload.type}</span>
                                          </div>
                                        )}
                                        hideLabel
                                    />}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="price" 
                                    stroke="var(--color-price)" 
                                    strokeWidth={2}
                                    dot={(props) => {
                                        const { payload, cx, cy } = props;
                                        if (payload.type === 'estimated') {
                                            return <circle cx={cx} cy={cy} r={5} fill="var(--color-estimated)" stroke="var(--color-estimated)" strokeWidth={2} />;
                                        }
                                        return <circle cx={cx} cy={cy} r={3} fill="var(--color-price)" />;
                                    }}
                                />
                                 {chartData.filter(d => d.type === 'estimated').map(point => (
                                    <ReferenceLine key={`ref-${point.date}`} x={point.date} stroke="var(--color-estimated)" strokeDasharray="3 3" />
                                 ))}

                            </LineChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
