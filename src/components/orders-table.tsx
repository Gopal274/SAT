'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Plus, Trash2, History, Info, Filter, X, Edit, Printer, ArrowUpDown, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

import type { OrderItem, Product, OrderWithItems, DeliveryRecord } from '@/lib/types';
import { updateOrderItemStatusAction, logDeliveryAction, deleteDeliveryRecordAction } from '@/lib/actions';

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
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { OrderFormDialog, DeleteOrderDialog, PrintOrderSlip, PrintPendingSummary } from './order-forms';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';

function ItemStatusChanger({ orderId, item }: { orderId: string, item: OrderItem }) {
    const [isUpdating, setIsUpdating] = React.useState(false);
    const { toast } = useToast();

    const handleValueChange = async (newStatus: OrderItem['status']) => {
        setIsUpdating(true);
        const result = await updateOrderItemStatusAction(orderId, item.id, newStatus);
        if (result.success) {
            toast({ title: 'Status Updated', description: `Item status set to ${newStatus}.` });
        } else {
            toast({ variant: 'destructive', title: 'Update Failed', description: result.message });
        }
        setIsUpdating(false);
    };

    const statusColors: Record<OrderItem['status'], string> = {
        pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        received: 'bg-green-100 text-green-800 border-green-200',
        dispatched: 'bg-blue-100 text-blue-800 border-blue-200',
        cancelled: 'bg-red-100 text-red-800 border-red-200',
    };

    return (
        <Select onValueChange={handleValueChange} value={item.status} disabled={isUpdating}>
            <SelectTrigger className={cn("h-8 w-[110px] text-xs font-semibold", statusColors[item.status])}>
                <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
        </Select>
    );
}

function DeliveryManager({ orderId, item }: { orderId: string, item: OrderItem }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { toast } = useToast();

    const [qty, setQty] = React.useState<number>(item.quantity - (item.receivedQuantity || 0));
    const [date, setDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [remark, setRemark] = React.useState('');

    const handleAddDelivery = async () => {
        if (qty <= 0) return;
        setIsSubmitting(true);
        const result = await logDeliveryAction(orderId, item.id, qty, date, remark);
        if (result.success) {
            toast({ title: 'Delivery Logged', description: `Added ${qty} ${item.unit} to records.` });
            setQty(0);
            setRemark('');
            setIsOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
        setIsSubmitting(false);
    };

    const handleDeleteRecord = async (logId: string) => {
        if (!confirm('Are you sure you want to delete this delivery record?')) return;
        const result = await deleteDeliveryRecordAction(orderId, item.id, logId);
        if (result.success) {
            toast({ title: 'Deleted', description: 'Delivery record removed.' });
        }
    };

    const pendingQty = Math.max(0, item.quantity - (item.receivedQuantity || 0));

    return (
        <>
            <div className="flex items-center gap-2">
                <Button 
                    variant="outline" 
                    size="sm" 
                    className={cn(
                        "h-8 px-2 text-xs gap-1 font-bold",
                        pendingQty === 0 ? "text-green-600 border-green-200 bg-green-50" : "text-orange-600 border-orange-200 bg-orange-50"
                    )}
                    onClick={() => setIsOpen(true)}
                >
                    <History className="h-3 w-3" />
                    {item.receivedQuantity || 0} / {item.quantity}
                </Button>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Track Delivery: {item.productName}</DialogTitle>
                        <DialogDescription>
                            Log partial supplies and add remarks for reporting.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs">Quantity Received ({item.unit})</Label>
                                <Input type="number" step="any" value={qty} onChange={e => setQty(parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Delivery Date</Label>
                                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Remark (Voucher No, Driver, etc.)</Label>
                            <Textarea placeholder="Optional details..." value={remark} onChange={e => setRemark(e.target.value)} rows={2} />
                        </div>
                        <Button className="w-full" onClick={handleAddDelivery} disabled={isSubmitting || qty <= 0}>
                            {isSubmitting ? 'Saving...' : 'Log This Supply'}
                        </Button>

                        <Separator />

                        <div>
                            <h4 className="text-sm font-semibold mb-2">Delivery History</h4>
                            <ScrollArea className="h-48 border rounded-md p-2">
                                {item.deliveries && item.deliveries.length > 0 ? (
                                    <div className="space-y-2">
                                        {item.deliveries.map(log => (
                                            <div key={log.id} className="text-xs p-2 rounded border bg-muted/30 relative group">
                                                <div className="flex justify-between font-bold">
                                                    <span>{log.quantity} {item.unit}</span>
                                                    <div className="text-right">
                                                        <span className="text-muted-foreground block">{format(safeToDate(log.deliveryDate), 'dd MMM yy')}</span>
                                                        <span className="text-[9px] text-muted-foreground/60 block">{format(safeToDate(log.createdAt), 'h:mm a')}</span>
                                                    </div>
                                                </div>
                                                {log.remark && <p className="mt-1 italic text-muted-foreground">"{log.remark}"</p>}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-5 w-5 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                                    onClick={() => handleDeleteRecord(log.id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-muted-foreground py-8 text-xs italic">No supplies recorded yet.</p>
                                )}
                            </ScrollArea>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function OrdersTable({ allOrders, allProducts }: { allOrders: OrderWithItems[], allProducts: Product[] }) {
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [sourceFilter, setSourceFilter] = React.useState<string>('all');
  const [deptFilter, setDeptFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [startDate, setStartDate] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');
  const [sortBy, setSortBy] = React.useState<string>('date-desc');
  
  const [isOrderFormOpen, setIsOrderFormOpen] = React.useState(false);
  const [editingOrder, setEditingOrder] = React.useState<OrderWithItems | null>(null);
  const [deletingOrder, setDeletingOrder] = React.useState<OrderWithItems | null>(null);

  const uniqueSources = React.useMemo(() => {
    const sources = new Set(allOrders.map(o => o.sourceLocation).filter(Boolean));
    return Array.from(sources).sort();
  }, [allOrders]);

  const uniqueDepts = React.useMemo(() => {
    const depts = new Set(allOrders.map(o => o.partyName));
    return Array.from(depts).sort();
  }, [allOrders]);

  const filteredOrders = React.useMemo(() => {
    let result = allOrders
        .map(order => ({
            ...order,
            items: order.items.filter(item => statusFilter === 'all' || item.status === statusFilter)
        }))
        .filter(order => {
            if (order.items.length === 0 && statusFilter !== 'all') return false;

            const matchesSource = sourceFilter === 'all' || order.sourceLocation === sourceFilter;
            const matchesDept = deptFilter === 'all' || order.partyName === deptFilter;
            
            const itemNames = order.items.map(i => i.productName).join(' ');
            const searchStr = `${order.partyName} ${order.sourceLocation} ${order.pageNo || ''} ${itemNames}`.toLowerCase();
            const matchesGlobal = !globalFilter || searchStr.includes(globalFilter.toLowerCase());

            // Date Range Filter
            const orderDateTime = safeToDate(order.orderDate).getTime();
            const start = startDate ? new Date(startDate).getTime() : -Infinity;
            // Set end to end of day (adding 23:59:59 worth of milliseconds)
            const end = endDate ? new Date(endDate).getTime() + 86399999 : Infinity;
            const matchesDateRange = orderDateTime >= start && orderDateTime <= end;

            return matchesSource && matchesDept && matchesGlobal && matchesDateRange;
        });

    // Apply Sorting
    result.sort((a, b) => {
        let dateA: number, dateB: number;

        if (sortBy.startsWith('mail')) {
            dateA = a.mailDate ? safeToDate(a.mailDate).getTime() : 0;
            dateB = b.mailDate ? safeToDate(b.mailDate).getTime() : 0;
        } else {
            dateA = safeToDate(a.orderDate).getTime();
            dateB = safeToDate(b.orderDate).getTime();
        }

        if (sortBy.endsWith('desc')) {
            if (dateB !== dateA) return dateB - dateA;
        } else {
            if (dateA !== dateB) return dateA - dateB;
        }

        // Secondary sort by creation time (newest first) to break ties
        return safeToDate(b.createdAt).getTime() - safeToDate(a.createdAt).getTime();
    });

    return result;
  }, [allOrders, sourceFilter, deptFilter, statusFilter, globalFilter, sortBy, startDate, endDate]);

  const columns: ColumnDef<OrderWithItems>[] = React.useMemo(() => [
    { id: 'serialNumber', header: 'S. No.' },
    { accessorKey: 'partyName', header: 'Department' },
    { id: 'orderItem', header: 'Order Item' },
    { id: 'quantity', header: 'Demand Qty' },
    { id: 'received', header: 'Received Qty' },
    { accessorKey: 'orderDate', header: 'Date' },
    { accessorKey: 'mailDate', header: 'Date of Mail' },
    { accessorKey: 'pageNo', header: 'Page No.' },
    { accessorKey: 'sourceLocation', header: 'Source' },
    { id: 'status', header: 'Status' },
    { id: 'remarks', header: 'Remarks' },
    { id: 'actions', header: () => <div className="text-center">Actions</div> },
  ], []);

  const table = useReactTable({
    data: filteredOrders,
    columns,
    state: {},
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const sortedRows = table.getSortedRowModel().rows;

  return (
    <>
      <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <CardTitle>Orders & Supply Tracking</CardTitle>
                    <CardDescription>Filter by Source, Department, or Date to manage Trust demands.</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <PrintPendingSummary orders={filteredOrders} source={sourceFilter} />
                    <Button onClick={() => { setEditingOrder(null); setIsOrderFormOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Create Order
                    </Button>
                </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-4 no-print">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Search</Label>
                        <Input
                            placeholder="Dept, Page, or Item..."
                            value={globalFilter}
                            onChange={(event) => setGlobalFilter(event.target.value)}
                            className="h-9"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Source Hub</Label>
                        <Select value={sourceFilter} onValueChange={setSourceFilter}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="All Locations" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Locations</SelectItem>
                                {uniqueSources.map(loc => (
                                    <SelectItem key={loc} value={loc!}>{loc}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Department</Label>
                        <Select value={deptFilter} onValueChange={setDeptFilter}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="All Departments" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {uniqueDepts.map(dept => (
                                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Any Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Any Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="received">Received</SelectItem>
                                <SelectItem value="dispatched">Dispatched</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <ArrowUpDown className="h-2 w-2" /> Sort List By
                        </Label>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="h-9 font-semibold text-blue-700 border-blue-200 bg-blue-50/50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="date-desc">Demand Date (Newest)</SelectItem>
                                <SelectItem value="date-asc">Demand Date (Oldest)</SelectItem>
                                <SelectItem value="mail-desc">Mail Date (Newest)</SelectItem>
                                <SelectItem value="mail-asc">Mail Date (Oldest)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-muted/20 p-3 rounded-lg border border-dashed">
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <CalendarIcon className="h-2 w-2" /> From Date
                        </Label>
                        <Input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)} 
                            className="h-9 bg-background"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            <CalendarIcon className="h-2 w-2" /> To Date
                        </Label>
                        <Input 
                            type="date" 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)} 
                            className="h-9 bg-background"
                        />
                    </div>
                    <div className="md:col-span-2 flex items-end justify-end">
                        {(sourceFilter !== 'all' || deptFilter !== 'all' || statusFilter !== 'all' || globalFilter || startDate || endDate) && (
                            <Button variant="ghost" size="sm" onClick={() => {
                                setSourceFilter('all');
                                setDeptFilter('all');
                                setStatusFilter('all');
                                setGlobalFilter('');
                                setStartDate('');
                                setEndDate('');
                                setSortBy('date-desc');
                            }} className="h-9 text-xs text-muted-foreground hover:text-destructive">
                                <X className="mr-1 h-3 w-3" /> Clear Filters & Date Range
                            </Button>
                        )}
                    </div>
                </div>
            </div>
          </CardHeader>
          <CardContent>
              <div className="rounded-md border overflow-x-auto">
                  <Table>
                      <TableHeader>
                          {table.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id}>
                              {headerGroup.headers.map((header) => (
                                <TableHead key={header.id} className="whitespace-nowrap text-xs uppercase tracking-wider">
                                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                </TableHead>
                              ))}
                          </TableRow>
                          ))}
                      </TableHeader>
                      <TableBody>
                          {sortedRows.length > 0 ? (
                            sortedRows.flatMap((row, orderIndex) => {
                                const order = row.original;
                                const items = order.items || [];
                                const rowSpan = items.length || 1;

                                if (items.length === 0) {
                                    return (
                                        <TableRow key={order.id}>
                                            <TableCell className="text-center border-r font-medium">{orderIndex + 1}</TableCell>
                                            <TableCell className="border-r whitespace-nowrap">{order.partyName}</TableCell>
                                            <TableCell colSpan={3} className="text-muted-foreground italic border-r">No matching items</TableCell>
                                            <TableCell className="border-r whitespace-nowrap">{format(safeToDate(order.orderDate), 'dd/MM/yy')}</TableCell>
                                            <TableCell className="border-r whitespace-nowrap text-muted-foreground">{order.mailDate ? format(safeToDate(order.mailDate), 'dd/MM/yy') : '-'}</TableCell>
                                            <TableCell className="text-center border-r">{order.pageNo ?? '-'}</TableCell>
                                            <TableCell className="border-r whitespace-nowrap text-muted-foreground">{order.sourceLocation || '-'}</TableCell>
                                            <TableCell className="border-r"></TableCell>
                                            <TableCell className="border-r"></TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <PrintOrderSlip order={order} />
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => { setEditingOrder(order); setIsOrderFormOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingOrder(order)}><Trash2 className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }
                                
                                return items.map((item, itemIndex) => (
                                    <TableRow key={item.id} className={cn(itemIndex === items.length - 1 && "border-b-2")}>
                                        {itemIndex === 0 && (
                                            <>
                                                <TableCell rowSpan={rowSpan} className="align-top pt-4 text-center border-r font-bold bg-muted/20">
                                                    {orderIndex + 1}
                                                </TableCell>
                                                <TableCell rowSpan={rowSpan} className="align-top pt-4 border-r whitespace-nowrap font-medium">
                                                    {order.partyName}
                                                </TableCell>
                                            </>
                                        )}
                                        <TableCell className="border-r whitespace-nowrap font-semibold">
                                            <div className="flex items-center gap-1">
                                                {item.productName}
                                                {item.deliveries && item.deliveries.some(d => d.remark) && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><Info className="h-3 w-3 text-blue-500 cursor-help" /></TooltipTrigger>
                                                            <TooltipContent>Has remarks in delivery history</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="border-r whitespace-nowrap">
                                            {item.quantity} <span className="text-xs text-muted-foreground">{item.unit}</span>
                                        </TableCell>
                                        <TableCell className="border-r">
                                            <div className="flex items-center gap-2">
                                                <DeliveryManager orderId={order.id} item={item} />
                                                <div className="flex flex-col text-[10px] leading-tight">
                                                    <span className="text-muted-foreground">Left:</span>
                                                    <span className={cn(
                                                        "font-bold",
                                                        (item.quantity - (item.receivedQuantity || 0)) > 0 ? "text-orange-600" : "text-green-600"
                                                    )}>
                                                        {Math.max(0, item.quantity - (item.receivedQuantity || 0))}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        {itemIndex === 0 && (
                                            <>
                                                <TableCell rowSpan={rowSpan} className="align-top pt-4 border-r whitespace-nowrap text-muted-foreground">
                                                    {format(safeToDate(order.orderDate), 'dd/MM/yy')}
                                                </TableCell>
                                                <TableCell rowSpan={rowSpan} className="align-top pt-4 border-r whitespace-nowrap text-muted-foreground">
                                                    {order.mailDate ? format(safeToDate(order.mailDate), 'dd/MM/yy') : '-'}
                                                </TableCell>
                                                <TableCell rowSpan={rowSpan} className="align-top pt-4 text-center border-r font-mono">
                                                    {order.pageNo ?? '-'}
                                                </TableCell>
                                                <TableCell rowSpan={rowSpan} className="align-top pt-4 border-r whitespace-nowrap text-muted-foreground italic">
                                                    {order.sourceLocation || '-'}
                                                </TableCell>
                                            </>
                                        )}
                                        <TableCell className="border-r">
                                            <ItemStatusChanger orderId={order.id} item={item} />
                                        </TableCell>
                                        <TableCell className="border-r whitespace-nowrap text-xs italic text-muted-foreground">
                                            {item.remark || '-'}
                                        </TableCell>
                                        {itemIndex === 0 && (
                                            <TableCell rowSpan={rowSpan} className="align-top pt-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <PrintOrderSlip order={order} />
                                                            </TooltipTrigger>
                                                            <TooltipContent><p>Print Demand Slip</p></TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => { setEditingOrder(order); setIsOrderFormOpen(true); }}>
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent><p>Edit Order Header/Items</p></TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeletingOrder(order)}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent><p>Delete Order</p></TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ));
                            })
                          ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No orders found. Try adjusting your filters or date range.
                                </TableCell>
                            </TableRow>
                          )}
                      </TableBody>
                  </Table>
              </div>
          </CardContent>
      </Card>

      <OrderFormDialog 
        order={editingOrder || undefined}
        isOpen={isOrderFormOpen}
        setIsOpen={setIsOrderFormOpen}
        departmentNameOptions={uniqueDepts}
        allProducts={allProducts}
      />
      <DeleteOrderDialog
        order={deletingOrder}
        isOpen={!!deletingOrder}
        setIsOpen={(isOpen) => !isOpen && setDeletingOrder(null)}
      />
    </>
  );
}
