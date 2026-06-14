
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
  X,
  Calendar,
  User,
  Info,
  ChevronRight,
  Plus,
  Printer,
  Sparkles,
  FileUp,
  UserCheck,
  Paperclip,
  Eye
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { OrderWithItems, OrderItem, DispatchDetailsSchema, QuickDispatchSchema } from '@/lib/types';
import { updateOrderItemDispatchDetailsAction, createQuickDispatchAction } from '@/lib/actions';
import { dispatchDetailsSchema, quickDispatchSchema } from '@/lib/types';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { scanDispatch } from '@/ai/flows/scan-dispatch-flow';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface GoodsSendingTableProps {
  allOrders: OrderWithItems[];
}

function AttachmentViewer({ url }: { url?: string }) {
    const [isOpen, setIsOpen] = React.useState(false);
    if (!url) return null;

    const isPdf = url.includes('/auto/upload') && url.endsWith('.pdf');

    return (
        <>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600" onClick={() => setIsOpen(true)}>
                            <Eye className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>View Scanned Slip</TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>Gate Pass / Slip Attachment</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto flex justify-center bg-muted/20 rounded-lg p-2 min-h-[50vh]">
                        {isPdf ? (
                            <iframe src={url} className="w-full h-[70vh]" title="Slip PDF" />
                        ) : (
                            <img src={url} className="max-w-full h-auto object-contain shadow-lg border" alt="Slip Attachment" />
                        )}
                    </div>
                    <div className="flex justify-end pt-2">
                        <Button variant="outline" onClick={() => setIsOpen(false)}>Close</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function PrintGatePass({ item }: { item: any }) {
    const printRef = React.useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const content = printRef.current?.innerHTML;
        const win = window.open('', '', 'height=700,width=900');
        if (!win) return;
        
        win.document.write(`
            <html>
                <head>
                    <title>Samagri Gate Pass - ${item.partyName}</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px; border: 4px solid black; min-height: 90vh; }
                        .header { text-align: center; border-bottom: 2px solid black; padding-bottom: 15px; margin-bottom: 20px; }
                        .header h1 { margin: 0; font-size: 32px; text-decoration: underline; }
                        .header h2 { margin: 5px 0; font-size: 18px; }
                        .form-row { display: flex; gap: 20px; margin-bottom: 20px; font-size: 18px; }
                        .field { flex: 1; border-bottom: 1px dotted black; padding-bottom: 5px; }
                        .field label { font-weight: bold; margin-right: 10px; }
                        table { width: 100%; border-collapse: collapse; margin: 30px 0; }
                        th, td { border: 2px solid black; padding: 15px; text-align: left; font-size: 18px; }
                        th { background-color: #f0f0f0; }
                        .footer { margin-top: 80px; display: flex; justify-content: space-between; align-items: flex-end; }
                        .sig { text-align: center; width: 250px; }
                        .sig-line { border-top: 2px solid black; margin-top: 60px; padding-top: 5px; font-weight: bold; }
                        .stamp { border: 3px solid blue; color: blue; padding: 15px; width: fit-content; text-transform: uppercase; font-weight: bold; transform: rotate(-5deg); margin: 20px; }
                    </style>
                </head>
                <body>
                    ${content}
                </body>
            </html>
        `);
        win.document.close();
        win.print();
    };

    const getReasonLabel = (reason?: string) => {
        if (!reason) return '-';
        const labels: Record<string, string> = {
          purchased: 'Purchased',
          sample: 'As Sample',
          repairing: 'For Repairing',
          exchange: 'For Exchange',
          return: 'For Return',
          replacement: 'For Replacement',
          new_stock: 'New Stock'
        };
        return labels[reason] || reason;
    };

    return (
        <>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
            </Button>
            <div ref={printRef} className="hidden">
                <div className="header">
                    <h2>SHRI ANANDPUR TRUST</h2>
                    <h1>SAMAGRI GATE PASS</h1>
                </div>
                <div className="form-row">
                    <div className="field"><label>Department (Vibhaag):</label> {item.partyName}</div>
                    <div className="field"><label>Date (Dinaank):</label> {item.dispatchedAt ? format(safeToDate(item.dispatchedAt), 'dd-MM-yyyy') : format(new Date(), 'dd-MM-yyyy')}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: '60%' }}>Item Description (Saman ka Vivaran)</th>
                            <th style={{ width: '15%' }}>Qty</th>
                            <th style={{ width: '25%' }}>Reason for Dispatch</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{item.productName}</td>
                            <td>{item.quantity} {item.unit}</td>
                            <td>{getReasonLabel(item.dispatchReason)}</td>
                        </tr>
                    </tbody>
                </table>
                <div className="form-row" style={{ marginTop: '40px' }}>
                    <div className="field"><label>Destination (Saman Kahan Bhejna Hai):</label> {item.sourceLocation || item.destination || '-'}</div>
                </div>
                <div className="form-row">
                    <div className="field"><label>To Whom (Saman Kisko Bhejna Hai):</label> {item.recipientName || '-'}</div>
                </div>
                <div className="stamp">
                    SHRI ANANDPUR TRUST<br/>
                    STORE DEPARTMENT<br/>
                    GATE PASS ISSUED
                </div>
                <div className="footer">
                    <div className="sig">
                        <div className="sig-line">Sign. of Department Incharge</div>
                    </div>
                    <div className="sig">
                        <div className="sig-line">Sign. of Authorized Person</div>
                    </div>
                </div>
            </div>
        </>
    );
}

function QuickDispatchDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);

  const form = useForm<QuickDispatchSchema>({
    resolver: zodResolver(quickDispatchSchema),
    defaultValues: {
      dispatchReason: 'purchased',
      dispatchedAt: format(new Date(), "yyyy-MM-dd"),
      receivedBySenderDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      quantity: 1,
      recipientName: '',
      attachmentUrl: '',
    }
  });

  const handleFileUploadAndScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'unsigned_preset');

      try {
          const response = await fetch(`https://api.cloudinary.com/v1_1/dt7vbeobv/auto/upload`, {
              method: 'POST',
              body: formData,
          });
          const data = await response.json();
          if (!response.ok) throw new Error("Upload failed");

          form.setValue('attachmentUrl', data.secure_url);
          setIsScanning(true);
          const result = await scanDispatch({ photoDataUri: data.secure_url });
          
          if (result.partyName) form.setValue('partyName', result.partyName);
          if (result.productName) form.setValue('productName', result.productName);
          if (result.quantity) form.setValue('quantity', result.quantity);
          if (result.unit) form.setValue('unit', result.unit);
          if (result.destination) form.setValue('destination', result.destination);
          if (result.recipientName) form.setValue('recipientName', result.recipientName);
          if (result.dispatchReason) form.setValue('dispatchReason', result.dispatchReason as any);
          if (result.dispatchedAt) form.setValue('dispatchedAt', result.dispatchedAt);

          toast({ title: 'Gate Pass Scanned', description: 'Form fields populated from slip.' });
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Scan Failed', description: error.message });
      } finally {
          setIsUploading(false);
          setIsScanning(false);
      }
  };

  const onSubmit = async (data: QuickDispatchSchema) => {
    setIsSubmitting(true);
    const result = await createQuickDispatchAction(data);
    if (result.success) {
      toast({ title: 'Success', description: 'Quick dispatch record created.' });
      onClose();
      form.reset();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex justify-between items-start">
              <div>
                <DialogTitle>Record New Dispatch Movement</DialogTitle>
                <DialogDescription>
                    Log a physical sending event (e.g. sample, repair, or new purchase).
                </DialogDescription>
              </div>
              <label className="cursor-pointer">
                  <Input type="file" accept="image/*" className="hidden" onChange={handleFileUploadAndScan} />
                  <Button type="button" variant="outline" size="sm" className="gap-2 bg-purple-50 text-purple-700 border-purple-200" asChild disabled={isUploading || isScanning}>
                      <span>
                          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : isScanning ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Sparkles className="h-4 w-4" />}
                          AI Scan Gate Pass
                      </span>
                  </Button>
              </label>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {form.watch('attachmentUrl') && (
                <div className="p-3 border rounded-lg bg-green-50/50 flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded border bg-white overflow-hidden flex items-center justify-center">
                            {form.watch('attachmentUrl').endsWith('.pdf') ? (
                                <Paperclip className="h-6 w-6 text-muted-foreground" />
                            ) : (
                                <img src={form.watch('attachmentUrl')} className="h-full w-full object-cover" alt="Attachment" />
                            )}
                        </div>
                        <span className="text-sm font-medium text-green-700">Slip/Gate Pass attached for reference.</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => form.setValue('attachmentUrl', '')} className="text-destructive">Remove</Button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField control={form.control} name="partyName" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase">Source Department (Workshop/Store)</FormLabel><FormControl><Input placeholder="e.g. Truck Workshop" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="destination" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase">Destination Hub (Kahan Bhejna Hai)</FormLabel><FormControl><Input placeholder="e.g. Ashoknagar / Delhi" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="recipientName" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase">Recipient (Kisko Bhejna Hai)</FormLabel><FormControl><Input placeholder="e.g. Jyoti Mahatma Ji" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="productName" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase">Item Name</FormLabel><FormControl><Input placeholder="e.g. Rotary Pump" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase">Qty</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="unit" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs font-bold uppercase">Unit</FormLabel><FormControl><Input placeholder="kg / pc / nag" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="receivedBySenderDate" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase">Sender Received At (Date/Time)</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="dispatchedAt" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase">Dispatch Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="dispatchedBy" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase">Dispatched By (Sender)</FormLabel><FormControl><Input placeholder="Name of purchaser/sender" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="driverName" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase">Driver Name</FormLabel><FormControl><Input placeholder="e.g. Sonu" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="dispatchReason" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase">Reason for Dispatch</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="purchased">Purchased</SelectItem>
                      <SelectItem value="new_stock">New Stock</SelectItem>
                      <SelectItem value="repairing">For Repairing</SelectItem>
                      <SelectItem value="sample">As Sample</SelectItem>
                      <SelectItem value="exchange">For Exchange</SelectItem>
                      <SelectItem value="return">For Return</SelectItem>
                      <SelectItem value="replacement">For Replacement</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="md:col-span-2">
                <FormField control={form.control} name="remark" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs font-bold uppercase">Remarks</FormLabel><FormControl><Input placeholder="Optional notes..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting || isScanning} className="gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                Log Dispatch Movement
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DispatchFormDialog({ 
  orderId, 
  item, 
  isOpen, 
  onClose 
}: { 
  orderId: string; 
  item: any; 
  isOpen: boolean; 
  onClose: () => void 
}) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<DispatchDetailsSchema>({
    resolver: zodResolver(dispatchDetailsSchema),
    defaultValues: {
      status: 'dispatched',
      receivedBySenderDate: item.receivedBySenderDate ? format(safeToDate(item.receivedBySenderDate), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      dispatchedAt: item.dispatchedAt ? format(safeToDate(item.dispatchedAt), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      dispatchedBy: item.dispatchedBy || '',
      driverName: item.driverName || '',
      recipientName: item.recipientName || '',
      dispatchReason: (item.dispatchReason as any) || 'purchased',
    }
  });

  const onSubmit = async (data: DispatchDetailsSchema) => {
    setIsSubmitting(true);
    const result = await updateOrderItemDispatchDetailsAction(orderId, item.id, data);
    if (result.success) {
      toast({ title: 'Dispatch Recorded', description: 'Logistics details have been saved.' });
      onClose();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Logistics Detail: {item.productName}</DialogTitle>
          <DialogDescription>
            Record dispatch details for {item.partyName}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="receivedBySenderDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Sender Received At (Date & Time)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dispatchedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Dispatch Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dispatchedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Dispatched By (Person/Sender)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Rahul/Purchaser" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="recipientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Recipient (Kisko Bhejna Hai)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Jyoti Mahatma Ji" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="driverName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Driver Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Sonu" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dispatchReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Reason for Dispatch</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="purchased">Purchased</SelectItem>
                        <SelectItem value="new_stock">New Stock</SelectItem>
                        <SelectItem value="repairing">For Repairing</SelectItem>
                        <SelectItem value="sample">As Sample</SelectItem>
                        <SelectItem value="exchange">For Exchange</SelectItem>
                        <SelectItem value="return">For Return</SelectItem>
                        <SelectItem value="replacement">For Replacement</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Fulfillment Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="received">Ready to Send</SelectItem>
                        <SelectItem value="dispatched">Dispatched</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                Save Dispatch Info
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function GoodsSendingTable({ allOrders }: GoodsSendingTableProps) {
  const [filterText, setFilterText] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'ready' | 'pending' | 'dispatched' | 'all'>('ready');
  const [dispatchItem, setDispatchItem] = React.useState<any | null>(null);
  const [isQuickDispatchOpen, setIsQuickDispatchOpen] = React.useState(false);

  const flattenedItems = React.useMemo(() => {
    return allOrders.flatMap(order => 
      order.items.map(item => ({
        ...item,
        orderId: order.id,
        partyName: order.partyName,
        sourceLocation: order.sourceLocation,
        orderDate: order.orderDate,
        pageNo: order.pageNo,
        attachmentUrl: order.attachmentUrl,
      }))
    );
  }, [allOrders]);

  const filteredItems = React.useMemo(() => {
    return flattenedItems.filter(item => {
      const matchesSearch = 
        item.productName.toLowerCase().includes(filterText.toLowerCase()) ||
        item.partyName.toLowerCase().includes(filterText.toLowerCase()) ||
        (item.driverName || '').toLowerCase().includes(filterText.toLowerCase()) ||
        (item.recipientName || '').toLowerCase().includes(filterText.toLowerCase());

      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'ready' && item.status === 'received') ||
        (statusFilter === 'pending' && item.status === 'pending') ||
        (statusFilter === 'dispatched' && item.status === 'dispatched');

      return matchesSearch && matchesStatus;
    });
  }, [flattenedItems, filterText, statusFilter]);

  const getReasonLabel = (reason?: string) => {
    if (!reason) return 'Purchased';
    const labels: Record<string, string> = {
      purchased: 'Purchased',
      sample: 'As Sample',
      repairing: 'For Repairing',
      exchange: 'For Exchange',
      return: 'For Return',
      replacement: 'For Replacement',
      new_stock: 'New Stock'
    };
    return labels[reason] || reason;
  };

  return (
    <>
      <Card className="shadow-xl border-t-4 border-t-primary">
        <CardHeader className="bg-muted/30">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black tracking-tight text-primary">Logistics Management</CardTitle>
              <CardDescription>Comprehensive tracking of item movement, drivers, and gate passes.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => setIsQuickDispatchOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Record New Movement
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Item, Dept, Driver or Recipient..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="pl-10 w-full sm:w-[300px] h-10 border-primary/20 shadow-inner"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-[180px] h-10 border-primary/20">
                  <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="View Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ready">Ready to Send (Received)</SelectItem>
                  <SelectItem value="pending">Awaiting Supply</SelectItem>
                  <SelectItem value="dispatched">Sent (Dispatched)</SelectItem>
                  <SelectItem value="all">All Movements</SelectItem>
                </SelectContent>
              </Select>
              {(filterText || statusFilter !== 'ready') && (
                  <Button variant="ghost" className="text-muted-foreground hover:text-destructive h-10" onClick={() => { setFilterText(''); setStatusFilter('ready'); }}>
                      <X className="mr-2 h-4 w-4" /> Reset
                  </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50 border-b border-primary/10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[220px]">Item & Destination</TableHead>
                  <TableHead className="w-[200px]">Sender Details</TableHead>
                  <TableHead className="w-[200px]">Dispatch Info</TableHead>
                  <TableHead className="w-[150px]">Reason & Driver</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-primary/5 transition-colors group">
                      <TableCell>
                        <div className="flex flex-col space-y-1">
                          <span className="font-black text-base text-foreground leading-tight">{item.productName}</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1 px-1.5 py-0.5">
                                  <ArrowRight className="h-3 w-3" /> {item.partyName}
                              </Badge>
                              <span className="text-[11px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">
                                  {item.quantity} {item.unit}
                              </span>
                          </div>
                          {item.remark && <p className="text-[10px] italic text-muted-foreground mt-1 line-clamp-1">"{item.remark}"</p>}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                          <div className="space-y-1.5">
                              <div className="flex items-center gap-2 text-sm">
                                  <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  <span className="font-bold text-muted-foreground">{item.sourceLocation || 'Not Specified'}</span>
                              </div>
                              <div className="flex flex-col space-y-0.5">
                                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-orange-600">
                                      <Clock className="h-3 w-3" /> 
                                      REC: {item.receivedBySenderDate ? format(safeToDate(item.receivedBySenderDate), 'dd MMM, HH:mm') : 'Not Recorded'}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                      <User className="h-3 w-3" /> 
                                      SDR: {item.dispatchedBy || '-'}
                                  </div>
                              </div>
                          </div>
                      </TableCell>

                      <TableCell>
                          <div className="space-y-1.5">
                              <div className="flex items-center gap-2 text-[11px] font-bold">
                                  <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span>SENT: {item.dispatchedAt ? format(safeToDate(item.dispatchedAt), 'dd MMM yyyy') : 'Awaiting'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                                  <span className="bg-muted px-1 rounded">ORD: {format(safeToDate(item.orderDate), 'dd/MM/yy')}</span>
                                  {item.pageNo && <span className="bg-muted px-1 rounded">P:{item.pageNo}</span>}
                              </div>
                          </div>
                      </TableCell>

                      <TableCell>
                          <div className="space-y-1.5">
                              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200 text-[9px] uppercase font-black px-1.5 py-0.5">
                                  {getReasonLabel(item.dispatchReason)}
                              </Badge>
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-foreground">
                                  <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>{item.driverName || 'No Driver'}</span>
                              </div>
                          </div>
                      </TableCell>

                      <TableCell>
                          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>{item.recipientName || 'Not Specified'}</span>
                          </div>
                      </TableCell>
                      
                      <TableCell>
                        {item.status === 'received' && (
                          <div className="flex items-center gap-1.5 text-green-600 font-black text-xs uppercase animate-pulse">
                            <CheckCircle2 className="h-4 w-4" /> Ready to Send
                          </div>
                        )}
                        {item.status === 'pending' && (
                          <div className="flex items-center gap-1.5 text-orange-500 font-bold text-xs uppercase">
                            <Clock className="h-4 w-4" /> Awaiting Supply
                          </div>
                        )}
                        {item.status === 'dispatched' && (
                          <div className="flex items-center gap-1.5 text-blue-600 font-black text-xs uppercase">
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
                          <div className="flex items-center justify-end gap-1">
                              <AttachmentViewer url={item.attachmentUrl} />
                              {item.status === 'dispatched' && <PrintGatePass item={item} />}
                              <Button 
                                size="sm" 
                                variant={item.status === 'received' ? 'default' : 'outline'}
                                className={cn(
                                  "gap-2 font-bold shadow-sm transition-all",
                                  item.status === 'dispatched' ? "opacity-50" : ""
                                )}
                                onClick={() => setDispatchItem(item)}
                              >
                                {item.status === 'dispatched' ? (
                                  <Info className="h-4 w-4" />
                                ) : (
                                  <Truck className="h-4 w-4" />
                                )}
                                {item.status === 'dispatched' ? 'Details' : 'Dispatch'}
                              </Button>
                          </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="bg-muted p-4 rounded-full">
                          <Truck className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-foreground">No dispatch logs found</p>
                          <p className="text-sm text-muted-foreground">Adjust your search or filters to see movements.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { setFilterText(''); setStatusFilter('ready'); }}>
                          Show All Items
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        {dispatchItem && (
          <DispatchFormDialog 
            orderId={dispatchItem.orderId}
            item={dispatchItem}
            isOpen={!!dispatchItem}
            onClose={() => setDispatchItem(null)}
          />
        )}
      </Card>
      <QuickDispatchDialog isOpen={isQuickDispatchOpen} onClose={() => setIsQuickDispatchOpen(false)} />
    </>
  );
}
