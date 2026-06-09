'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PackageOpen, Clock, Truck, MapPin, History, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { OrderWithItems } from '@/lib/types';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, differenceInDays } from 'date-fns';
import { safeToDate } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { analyzeSupply, type SupplyAnalysisOutput } from '@/ai/flows/supply-analysis-flow';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';

interface OrderStatsProps {
  orders: OrderWithItems[];
}

export function OrderStats({ orders }: OrderStatsProps) {
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [aiInsight, setAiInsight] = React.useState<SupplyAnalysisOutput | null>(null);
  const { toast } = useToast();

  const stats = React.useMemo(() => {
    let totalItems = 0;
    let totalReceived = 0;
    let totalPending = 0;
    
    const sourceStats: Record<string, { pending: number; received: number }> = {};
    const deptStats: Record<string, { pending: number; total: number }> = {};
    const pendingItemsList: any[] = [];
    const allDeliveries: Array<{
        productName: string;
        partyName: string;
        quantity: number;
        unit: string;
        date: Date;
        createdAt: Date;
        remark?: string;
    }> = [];

    orders.forEach(order => {
      const source = order.sourceLocation || 'Unspecified';
      if (!sourceStats[source]) sourceStats[source] = { pending: 0, received: 0 };
      
      if (!deptStats[order.partyName]) deptStats[order.partyName] = { pending: 0, total: 0 };

      order.items.forEach(item => {
        const qty = item.quantity || 0;
        const rcvd = item.receivedQuantity || 0;
        const pending = Math.max(0, qty - rcvd);

        totalItems += qty;
        totalReceived += rcvd;
        totalPending += pending;

        sourceStats[source].pending += pending;
        sourceStats[source].received += rcvd;
        
        deptStats[order.partyName].pending += pending;
        deptStats[order.partyName].total += qty;

        if (pending > 0 && item.status !== 'cancelled') {
            pendingItemsList.push({
                productName: item.productName,
                department: order.partyName,
                pendingQty: pending,
                unit: item.unit,
                daysPending: differenceInDays(new Date(), safeToDate(order.orderDate)),
                source: source,
            });
        }

        if (item.deliveries) {
            item.deliveries.forEach(d => {
                allDeliveries.push({
                    productName: item.productName,
                    partyName: order.partyName,
                    quantity: d.quantity,
                    unit: item.unit,
                    date: safeToDate(d.deliveryDate),
                    createdAt: safeToDate(d.createdAt),
                    remark: d.remark
                });
            });
        }
      });
    });

    const sourceChartData = Object.entries(sourceStats)
      .map(([name, data]) => ({ name, pending: data.pending }))
      .sort((a, b) => b.pending - a.pending);

    const recentDeliveries = allDeliveries
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10);

    return {
      totalPending,
      totalReceived,
      percentComplete: totalItems > 0 ? Math.round((totalReceived / totalItems) * 100) : 0,
      sourceChartData,
      recentDeliveries,
      pendingItemsList,
      mostPendingDept: Object.entries(deptStats).sort((a,b) => b[1].pending - a[1].pending)[0]
    };
  }, [orders]);

  const handleGenerateInsight = async () => {
      setIsAnalyzing(true);
      try {
          const result = await analyzeSupply({
              pendingItems: stats.pendingItemsList.slice(0, 50), // Send top 50 to keep it concise
              totalPendingCount: stats.totalPending,
          });
          setAiInsight(result);
      } catch (error) {
          console.error("AI Error:", error);
          toast({ variant: 'destructive', title: 'Analysis Failed', description: 'Could not generate AI insights at this time.' });
      } finally {
          setIsAnalyzing(false);
      }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending Qty</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Units across all locations</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Supply Progress</CardTitle>
            <Truck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.percentComplete}%</div>
            <p className="text-xs text-muted-foreground">{stats.totalReceived.toLocaleString()} units received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sources</CardTitle>
            <MapPin className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sourceChartData.length}</div>
            <p className="text-xs text-muted-foreground">Purchasing hubs active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Priority Dept</CardTitle>
            <PackageOpen className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold truncate">{stats.mostPendingDept ? stats.mostPendingDept[0] : 'None'}</div>
            <p className="text-xs text-muted-foreground">
                {stats.mostPendingDept ? `${stats.mostPendingDept[1].pending.toLocaleString()} units pending` : 'All caught up'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-500" />
                            AI Supply Insights
                        </CardTitle>
                        <CardDescription>Advanced analysis of bottlenecks and Trust priorities.</CardDescription>
                    </div>
                    {!aiInsight && !isAnalyzing && (
                        <Button variant="outline" size="sm" onClick={handleGenerateInsight} className="gap-2">
                            <Sparkles className="h-4 w-4" /> Run Analysis
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {isAnalyzing ? (
                        <div className="space-y-4">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    ) : aiInsight ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2 p-4 rounded-lg bg-orange-50 border border-orange-100">
                                    <h4 className="font-bold text-orange-800 text-sm flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" /> Priority Summary
                                    </h4>
                                    <p className="text-xs text-orange-700 leading-relaxed">{aiInsight.prioritySummary}</p>
                                </div>
                                <div className="space-y-2 p-4 rounded-lg bg-blue-50 border border-blue-100">
                                    <h4 className="font-bold text-blue-800 text-sm flex items-center gap-1">
                                        <Truck className="h-3 w-3" /> Source Performance
                                    </h4>
                                    <p className="text-xs text-blue-700 leading-relaxed">{aiInsight.sourcePerformance}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-bold mb-2">Critical Items Checklist</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {aiInsight.criticalItems.map((item, i) => (
                                            <div key={i} className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium border border-red-200">
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                <Separator />
                                
                                <div>
                                    <h4 className="text-sm font-bold mb-2">Suggested Actions for Management</h4>
                                    <ul className="space-y-2">
                                        {aiInsight.suggestedActions.map((action, i) => (
                                            <li key={i} className="text-xs flex items-start gap-2 text-muted-foreground">
                                                <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5" />
                                                {action}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            <Button variant="ghost" size="xs" onClick={() => setAiInsight(null)} className="text-[10px] text-muted-foreground">
                                Reset Analysis
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                            <Sparkles className="h-10 w-10 text-muted-foreground/20" />
                            <div className="max-w-xs">
                                <p className="text-sm text-muted-foreground font-medium">No analysis generated yet.</p>
                                <p className="text-xs text-muted-foreground/60">Let AI analyze your {stats.pendingItemsList.length} pending demands to find shortcuts.</p>
                            </div>
                            <Button variant="secondary" size="sm" onClick={handleGenerateInsight}>
                                Generate Insights
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Pending Quantity by Source Location</CardTitle>
                    <CardDescription>Identifying which hubs have the most outstanding supply demands.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-64 w-full">
                        <ChartContainer config={{ pending: { label: 'Pending Units', color: 'hsl(var(--chart-1))' } }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.sourceChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip content={<ChartTooltipContent hideLabel />} />
                                    <Bar dataKey="pending" fill="var(--color-pending)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </div>
                </CardContent>
            </Card>
        </div>

        <Card className="h-fit sticky top-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <History className="h-4 w-4 text-blue-500" />
                    Latest Supplies
                </CardTitle>
                <CardDescription>Recently logged deliveries (by time).</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                    {stats.recentDeliveries.length > 0 ? (
                        <div className="space-y-4">
                            {stats.recentDeliveries.map((delivery, i) => (
                                <div key={i} className="space-y-1">
                                    <div className="flex justify-between items-start">
                                        <div className="text-sm font-semibold leading-none">{delivery.productName}</div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded inline-block">
                                                {format(delivery.date, 'dd MMM')}
                                            </div>
                                            <div className="text-[9px] text-muted-foreground/60 block">
                                                {format(delivery.createdAt, 'h:mm a')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        <span className="font-bold text-green-600">+{delivery.quantity} {delivery.unit}</span> for {delivery.partyName}
                                    </div>
                                    {delivery.remark && (
                                        <div className="text-[10px] italic text-muted-foreground truncate border-l-2 pl-2 mt-1">
                                            "{delivery.remark}"
                                        </div>
                                    )}
                                    {i < stats.recentDeliveries.length - 1 && <Separator className="mt-4" />}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center py-8">
                            <Truck className="h-8 w-8 text-muted-foreground/30 mb-2" />
                            <p className="text-xs text-muted-foreground italic">No deliveries recorded yet.</p>
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
