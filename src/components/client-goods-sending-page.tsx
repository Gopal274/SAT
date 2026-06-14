'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { AuthForm } from '@/components/auth-form';
import { GoodsSendingTable } from '@/components/goods-sending-table';
import { getAllOrdersWithItemsAction } from '@/lib/actions';
import type { OrderWithItems } from '@/lib/types';
import { Loader2, Truck } from 'lucide-react';

export default function ClientGoodsSendingPage() {
  const { user } = useUser();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
        if (!user) return;
        try {
            const data = await getAllOrdersWithItemsAction();
            setOrders(data);
        } catch (error) {
            console.error("Failed to fetch orders:", error);
        } finally {
            setIsLoading(false);
        }
    }
    fetchData();
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center pt-16">
        <AuthForm />
      </div>
    );
  }

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">Scanning store readiness...</p>
        </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="h-8 w-8 text-blue-600" /> Goods Sending Console
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage dispatches and track movement of items to Trust departments.
          </p>
        </div>
      </div>
      
      <GoodsSendingTable allOrders={orders} />
    </div>
  );
}
