
'use client';

import * as React from 'react';
import {
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Brush,
  Line,
} from 'recharts';
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
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import type { ProductWithRates } from '@/lib/types';
import { safeToDate } from '@/lib/utils';
import { format } from 'date-fns';

interface PriceTrendChartProps {
  productsWithRates: ProductWithRates[];
}

interface ChartData {
  date: number;
  price: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
};

export function PriceTrendChart({ productsWithRates }: PriceTrendChartProps) {
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedProductId && productsWithRates.length > 0) {
      const firstProductWithTrend = productsWithRates.find(p => p.rates && p.rates.length > 1);
      if (firstProductWithTrend) {
        setSelectedProductId(firstProductWithTrend.id);
      } else {
        const firstProductWithAnyRate = productsWithRates.find(p => p.rates && p.rates.length > 0);
        if (firstProductWithAnyRate) {
            setSelectedProductId(firstProductWithAnyRate.id);
        }
      }
    }
  }, [productsWithRates, selectedProductId]);

  const selectedProduct = React.useMemo(() => {
    return productsWithRates.find(p => p.id === selectedProductId);
  }, [selectedProductId, productsWithRates]);

  const chartData = React.useMemo((): ChartData[] => {
    if (!selectedProduct || !selectedProduct.rates || selectedProduct.rates.length === 0) return [];
    
    return selectedProduct.rates
      .map(rate => ({
        date: safeToDate(rate.billDate).getTime(),
        price: rate.rate * (1 + rate.gst / 100),
      }))
      .sort((a, b) => a.date - b.date);

  }, [selectedProduct]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Product Price Trend</CardTitle>
        <CardDescription>View the price history of a selected product.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <div className="space-y-4 flex-grow flex flex-col">
            <Select onValueChange={setSelectedProductId} value={selectedProductId ?? undefined}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a product" />
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

            <div className="flex-grow w-full">
            {chartData.length > 1 ? (
                <ChartContainer config={{}} className="min-h-[250px] w-full h-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 20, left: -10, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(tick) => format(new Date(tick), 'dd MMM yy')}
                            scale="time"
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            interval="preserveStartEnd"
                        />
                         <YAxis 
                            orientation="right"
                            tickFormatter={(tick) => formatCurrency(tick)}
                            domain={['dataMin - (dataMax - dataMin) * 0.2', 'dataMax + (dataMax - dataMin) * 0.2']}
                            width={80}
                        />
                        <Tooltip
                            content={<ChartTooltipContent 
                                labelFormatter={(label) => format(new Date(label), "dd MMM yyyy")}
                                formatter={(value) => formatCurrency(value as number)}
                                cursor={true}
                            />}
                        />
                        
                        <Line
                            type="monotone"
                            dataKey="price"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                            activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                         />
                         
                         <Brush 
                            dataKey="date" 
                            height={30} 
                            stroke="hsl(var(--primary))"
                            tickFormatter={(tick) => format(new Date(tick), 'MMM yy')}
                            travellerWidth={15}
                        />
                    </LineChart>
                    </ResponsiveContainer>
                </ChartContainer>
            ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    {selectedProductId ? 'Not enough data to display a trend.' : 'Select a product to see its trend.'}
                </div>
            )}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
