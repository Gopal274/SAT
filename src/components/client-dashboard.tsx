
'use client';

import React, { useState, useMemo } from 'react';
import type { ProductWithRates, OrderWithItems } from '@/lib/types';
import { SummaryCards } from './summary-cards';
import { PriceTrendChart } from './price-trend-chart';
import { PriceEstimator } from './price-estimator';
import { QuantityCalculator } from './quantity-calculator';
import { PartyDistributionChart } from './party-distribution-chart';
import { OrderStats } from './order-stats';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, TrendingUp, ShoppingBag } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ClientDashboard({ 
    productsWithRates, 
    orders 
}: { 
    productsWithRates: ProductWithRates[],
    orders: OrderWithItems[]
}) {
  const [selectedParty, setSelectedParty] = useState<string | null>(null);

  const filteredProductsByParty = useMemo(() => {
    if (!selectedParty) {
      return productsWithRates;
    }
    return productsWithRates.filter(p => p.partyName === selectedParty);
  }, [productsWithRates, selectedParty]);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="supply" className="w-full">
        <div className="flex items-center justify-between mb-4">
            <TabsList>
                <TabsTrigger value="supply" className="gap-2">
                    <ShoppingBag className="h-4 w-4" /> Supply Tracking
                </TabsTrigger>
                <TabsTrigger value="rates" className="gap-2">
                    <TrendingUp className="h-4 w-4" /> Price Analysis
                </TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="supply" className="space-y-6">
            <OrderStats orders={orders} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Department Demand Status</CardTitle>
                        <CardDescription>Visualizing product count distribution per department.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-80">
                            <PartyDistributionChart allProducts={productsWithRates} onPartySelect={setSelectedParty} />
                        </ScrollArea>
                    </CardContent>
                </Card>
                <QuantityCalculator productsWithRates={productsWithRates} />
            </div>
        </TabsContent>

        <TabsContent value="rates" className="space-y-6">
            <SummaryCards productsWithRates={productsWithRates} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <div className="lg:col-span-3">
                    <PriceTrendChart productsWithRates={filteredProductsByParty} />
                </div>
                <div className="lg:col-span-2 space-y-6">
                    <PriceEstimator productsWithRates={filteredProductsByParty} />
                </div>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
