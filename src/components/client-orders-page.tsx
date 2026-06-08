'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { Product, OrderWithItems } from '@/lib/types';
import { collection } from 'firebase/firestore';
import { OrdersTable } from '@/components/orders-table';
import { getAllOrdersWithItemsAction } from '@/lib/actions';

export default function ClientOrdersPage() {
  const firestore = useFirestore();
  const [ordersWithItems, setOrdersWithItems] = useState<OrderWithItems[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  // Fetch all products to use for suggestions in the order form
  const productsRef = useMemoFirebase(() => firestore ? collection(firestore, 'products') : null, [firestore]);
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsRef);

  useEffect(() => {
    let isMounted = true;
    async function fetchOrders() {
        if (!isMounted) return;
        setIsLoadingOrders(true);
        try {
            const orders = await getAllOrdersWithItemsAction();
            if (isMounted) {
                setOrdersWithItems(orders);
            }
        } catch (error) {
            console.error("Failed to fetch orders:", error);
        } finally {
            if (isMounted) {
                setIsLoadingOrders(false);
            }
        }
    }
    fetchOrders();

    return () => {
        isMounted = false;
    }
  }, []);

  const isLoading = isLoadingOrders || isLoadingProducts;

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-96">
            <p>Loading orders...</p>
        </div>
    )
  }

  return (
    <>
      <OrdersTable allOrders={ordersWithItems} allProducts={products ?? []} />
    </>
  );
}
