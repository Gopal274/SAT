
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Bar, 
  BarChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import type { OrderWithItems } from '@/lib/types';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { format, startOfMonth, subMonths } from 'date-fns';
import { safeToDate } from '@/lib/utils';
import { IndianRupee, TrendingUp, Landmark, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Separator } from './ui/separator';

interface FinancialReportsProps {
  orders: OrderWithItems[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
];

export function FinancialReports({ orders }: FinancialReportsProps) {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      maximumFractionDigits: 0 
    }).format(val);

  const stats = React.useMemo(() => {
    const deptSpend: Record<string, number> = {};
    const monthlySpend: Record<string, number> = {};
    const productSpend: Record<string, { total: number; qty: number; unit: string }> = {};
    let totalGlobalSpend = 0;

    // Initialize last 6 months for the line chart
    for (let i = 5; i >= 0; i--) {
      const monthKey = format(subMonths(new Date(), i), 'MMM yyyy');
      monthlySpend[monthKey] = 0;
    }

    orders.forEach(order => {
      const spend = order.totalAmount || 0;
      totalGlobalSpend += spend;

      // Department Spend
      deptSpend[order.partyName] = (deptSpend[order.partyName] || 0) + spend;

      // Monthly Spend
      const monthKey = format(safeToDate(order.orderDate), 'MMM yyyy');
      if (monthlySpend.hasOwnProperty(monthKey)) {
        monthlySpend[monthKey] += spend;
      }

      // Product Spend Analysis
      order.items.forEach(item => {
        const itemTotal = (item.rate || 0) * item.quantity * (1 + (item.gst || 0) / 100);
        if (!productSpend[item.productName]) {
          productSpend[item.productName] = { total: 0, qty: 0, unit: item.unit };
        }
        productSpend[item.productName].total += itemTotal;
        productSpend[item.productName].qty += item.quantity;
      });
    });

    const deptChartData = Object.entries(deptSpend)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const monthlyChartData = Object.entries(monthlySpend)
      .map(([name, spend]) => ({ name, spend }));

    const topProducts = Object.entries(productSpend)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Calculate Trend (this month vs last month)
    const currentMonthKey = format(new Date(), 'MMM yyyy');
    const lastMonthKey = format(subMonths(new Date(), 1), 'MMM yyyy');
    const currentSpend = monthlySpend[currentMonthKey] || 0;
    const lastSpend = monthlySpend[lastMonthKey] || 0;
    const trendPercent = lastSpend > 0 ? ((currentSpend - lastSpend) / lastSpend) * 100 : 0;

    return {
      totalGlobalSpend,
      deptChartData,
      monthlyChartData,
      topProducts,
      trendPercent,
      currentSpend
    };
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Financial Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider opacity-80 flex items-center gap-2">
              <Landmark className="h-3 w-3" /> Total Lifetime Demand Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{formatCurrency(stats.totalGlobalSpend)}</div>
            <p className="text-[10px] mt-1 opacity-70">Total estimated value of all recorded orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <IndianRupee className="h-3 w-3" /> Current Month Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{formatCurrency(stats.currentSpend)}</div>
            <div className="flex items-center gap-1 mt-1">
              {stats.trendPercent >= 0 ? (
                <span className="text-xs text-red-500 font-bold flex items-center">
                  <ArrowUpRight className="h-3 w-3" /> {Math.abs(stats.trendPercent).toFixed(1)}% 
                </span>
              ) : (
                <span className="text-xs text-green-600 font-bold flex items-center">
                  <ArrowDownRight className="h-3 w-3" /> {Math.abs(stats.trendPercent).toFixed(1)}% 
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-3 w-3" /> Top Contributing Dept
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold truncate">
              {stats.deptChartData[0]?.name || 'N/A'}
            </div>
            <div className="text-sm font-medium text-muted-foreground">
              {formatCurrency(stats.deptChartData[0]?.value || 0)} total
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by Department */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Department</CardTitle>
            <CardDescription>Estimated cost breakdown per Trust division.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.deptChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.deptChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                {stats.deptChartData.slice(0, 5).map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[80px]">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Spending Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Spending Trend</CardTitle>
            <CardDescription>Visualizing financial fluctuations over the last 6 months.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ChartContainer config={{ spend: { label: 'Spend', color: 'hsl(var(--chart-2))' } }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthlyChartData} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip 
                      content={<ChartTooltipContent hideLabel formatter={(val) => formatCurrency(val as number)} />}
                    />
                    <Bar 
                      dataKey="spend" 
                      fill="var(--color-spend)" 
                      radius={[6, 6, 0, 0]} 
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Value Products */}
      <Card>
        <CardHeader>
          <CardTitle>High-Value Item Distribution</CardTitle>
          <CardDescription>Items that consume the largest portion of the budget.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.topProducts.map((product, i) => (
              <div key={product.name} className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <div className="font-semibold flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">#{i + 1}</span>
                    {product.name}
                  </div>
                  <div className="font-mono font-bold text-primary">{formatCurrency(product.total)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary/40 rounded-full" 
                      style={{ width: `${(product.total / stats.topProducts[0].total) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {product.qty} {product.unit} total
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
