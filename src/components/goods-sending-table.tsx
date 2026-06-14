'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { 
  PackageCheck, 
  Search, 
  Truck, 
  MapPin, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Loader2,
  Filter,
  X
} from 'lucide-react';

import type { OrderWithItems, OrderItem } from '@/lib/types';
import { updateOrderItemStatusAction } from '@/lib/actions';
import { safeToDate, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from './ui/card';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';

interface GoodsSendingTableProps {
  allOrders: OrderWithItems[];
}

export function GoodsSendingTable({ allOrders }: GoodsSendingTableProps) {
  const [filterText, setFilterText] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'ready' | 'pending' | 'dispatched' | 'all'>('ready');
  const [isUpdating, setIsUpdating] = React.useState<string | null>(null);
  const { toast } = useToast();

  const handleStatusUpdate = async (orderId: string, itemId: string, newStatus: OrderItem['status']) => {
    setIsUpdating(itemId);
    const result = await updateOrderItemStatusAction(orderId, itemId, newStatus);
    if (result.success) {
      toast({ title: 'Dispatched', description: 'Item has been marked as sent.' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsUpdating(null);
  };

  const flattenedItems = React.useMemo(() => {
    return allOrders.flatMap(order => 
      order.items.map(item => ({
        ...item,
        orderId: order.id,
        partyName: order.partyName,
        sourceLocation: order.sourceLocation,
        orderDate: order.orderDate,
        pageNo: order.pageNo,
      }))
    );
  }, [allOrders]);

  const filteredItems = React.useMemo(() => {
    return flattenedItems.filter(item => {
      const matchesSearch = 
        item.productName.toLowerCase().includes(filterText.toLowerCase()) ||
        item.partyName.toLowerCase().includes(filterText.toLowerCase());

      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'ready' && item.status === 'received') ||
        (statusFilter === 'pending' && item.status === 'pending') ||
        (statusFilter === 'dispatched' && item.status === 'dispatched');

      return matchesSearch && matchesStatus;
    });
  }, [flattenedItems, filterText, statusFilter]);

  return (
    <Card className="shadow-lg border-primary/10">
      <CardHeader className="bg-muted/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl">Dispatch List</CardTitle>
            <CardDescription>Items ready for delivery to various departments.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Item or Dept..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-9 w-[200px] md:w-[250px]"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[150px]">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ready">Ready (Received)</SelectItem>
                <SelectItem value="pending">Not Yet Received</SelectItem>
                <SelectItem value="dispatched">Sent (Dispatched)</SelectItem>
                <SelectItem value="all">All Items</SelectItem>
              </SelectContent>
            </Select>
            {(filterText || statusFilter !== 'ready') && (
                <Button variant="ghost" size="icon" onClick={() => { setFilterText(''); setStatusFilter('ready'); }}>
                    <X className="h-4 w-4" />
                </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[300px]">Product & Destination</TableHead>
                <TableHead className="text-center">Quantity</TableHead>
                <TableHead>Source Logistics</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-base">{item.productName}</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" /> {item.partyName}
                          </Badge>
                          {item.remark && (
                            <span className="text-[10px] text-muted-foreground italic truncate max-w-[150px]">
                              "{item.remark}"
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-black tracking-tight">{item.quantity}</span>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">{item.unit}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-blue-500" />
                          <span className="font-medium">{item.sourceLocation || 'Not Set'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                            <span>ORD: {format(safeToDate(item.orderDate), 'dd MMM')}</span>
                            {item.pageNo && <span>• P: {item.pageNo}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.status === 'received' && (
                        <div className="flex items-center gap-1.5 text-green-600 font-bold text-xs uppercase">
                          <CheckCircle2 className="h-4 w-4" /> Ready to Send
                        </div>
                      )}
                      {item.status === 'pending' && (
                        <div className="flex items-center gap-1.5 text-orange-500 font-bold text-xs uppercase">
                          <Clock className="h-4 w-4" /> Awaiting Supply
                        </div>
                      )}
                      {item.status === 'dispatched' && (
                        <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs uppercase">
                          <Truck className="h-4 w-4" /> Dispatched
                        </div>
                      )}
                      {item.status === 'cancelled' && (
                        <div className="flex items-center gap-1.5 text-red-600 font-bold text-xs uppercase">
                          <AlertCircle className="h-4 w-4" /> Cancelled
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.status !== 'dispatched' && item.status !== 'cancelled' && (
                        <Button 
                          size="sm" 
                          variant={item.status === 'received' ? 'default' : 'outline'}
                          className="gap-2"
                          disabled={isUpdating === item.id}
                          onClick={() => handleStatusUpdate(item.orderId, item.id, 'dispatched')}
                        >
                          {isUpdating === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Truck className="h-4 w-4" />
                          )}
                          Dispatch
                        </Button>
                      )}
                      {item.status === 'dispatched' && (
                         <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-muted-foreground"
                            disabled={isUpdating === item.id}
                            onClick={() => handleStatusUpdate(item.orderId, item.id, 'received')}
                         >
                            Undo Dispatch
                         </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Truck className="h-10 w-10 text-muted-foreground/20" />
                      <p className="text-muted-foreground font-medium">No items matching current view.</p>
                      <Button variant="link" onClick={() => { setFilterText(''); setStatusFilter('all'); }}>View all items</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
