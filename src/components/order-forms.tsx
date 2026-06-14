
'use client';

import * as React from 'react';
import { z } from 'zod';
import { useForm, useFieldArray, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';

import { createOrderAction, updateOrderAction, deleteOrderAction } from '@/lib/actions';
import type { Product, CreateOrderSchema, OrderWithItems, ProductWithRates } from '@/lib/types';
import { createOrderSchema } from '@/lib/types';

import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2, Printer, Camera, Sparkles, FileUp, Loader2, Image as ImageIcon, Mail, Calculator, Paperclip } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { safeToDate } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { scanOrder } from '@/ai/flows/scan-order-flow';
import { Separator } from './ui/separator';
import { getAllProductsWithRatesAction } from '@/lib/actions';

function OrderItemRow({ index, remove, productOptions }: { index: number; remove: (index: number) => void; productOptions: {value: string; label: string;}[] }) {
  const { control, setValue, watch } = useFormContext<CreateOrderSchema>();
  const [isFetchingRate, setIsFetchingRate] = React.useState(false);
  
  const qty = watch(`items.${index}.quantity`) || 0;
  const rate = watch(`items.${index}.rate`) || 0;
  const gst = watch(`items.${index}.gst`) || 0;
  const rowTotal = qty * rate * (1 + gst / 100);

  const handleProductNameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    const allProducts = (control as any)._options.context as Product[];
    const product = allProducts?.find(p => p.name.toLowerCase() === newName.toLowerCase());

    if (product) {
        setValue(`items.${index}.productId`, product.id);
        setValue(`items.${index}.unit`, product.unit);
        
        // Fetch real-time latest rate from DB
        setIsFetchingRate(true);
        try {
            const productsWithRates = await getAllProductsWithRatesAction();
            const fullProduct = productsWithRates.find(p => p.id === product.id);
            if (fullProduct && fullProduct.rates && fullProduct.rates.length > 0) {
                const latest = fullProduct.rates[0];
                setValue(`items.${index}.rate`, latest.rate);
                setValue(`items.${index}.gst`, latest.gst);
            }
        } finally {
            setIsFetchingRate(false);
        }
    } else {
        setValue(`items.${index}.productId`, undefined);
    }
  };

  return (
    <div className="relative grid grid-cols-12 gap-x-3 gap-y-2 border p-3 rounded-md bg-muted/20">
        <div className="col-span-12 md:col-span-4">
             <FormField
                control={control}
                name={`items.${index}.productName`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Product Name</FormLabel>
                        <FormControl>
                            <Input 
                                {...field}
                                onChange={(e) => {
                                    field.onChange(e);
                                    handleProductNameChange(e);
                                }}
                                placeholder="Start typing..."
                                list={`product-suggestions-${index}`}
                                className="h-8"
                            />
                        </FormControl>
                        <datalist id={`product-suggestions-${index}`}>
                            {productOptions.map((option) => (
                                <option key={option.value} value={option.label} />
                            ))}
                        </datalist>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        <div className="col-span-4 md:col-span-1">
            <FormField
                control={control}
                name={`items.${index}.unit`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Unit</FormLabel>
                        <FormControl>
                            <Input placeholder="kg" {...field} className="h-8 text-center" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        <div className="col-span-4 md:col-span-1">
            <FormField
                control={control}
                name={`items.${index}.quantity`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Qty</FormLabel>
                        <FormControl>
                            <Input type="number" step="any" {...field} className="h-8 text-center" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        <div className="col-span-4 md:col-span-2">
            <FormField
                control={control}
                name={`items.${index}.rate`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                            {isFetchingRate ? <Loader2 className="h-2 w-2 animate-spin" /> : 'Rate'}
                        </FormLabel>
                        <FormControl>
                            <Input type="number" step="any" {...field} value={field.value ?? ''} className="h-8" placeholder="0.00" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        <div className="col-span-4 md:col-span-1">
            <FormField
                control={control}
                name={`items.${index}.gst`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">GST %</FormLabel>
                        <FormControl>
                            <Input type="number" step="any" {...field} value={field.value ?? ''} className="h-8 text-center" placeholder="0" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        <div className="col-span-6 md:col-span-2">
            <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Row Total</span>
                <div className="h-8 flex items-center font-mono font-bold text-xs bg-white/50 border rounded px-2">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rowTotal)}
                </div>
            </div>
        </div>
        
        <div className="col-span-12 md:col-span-11 mt-1">
            <FormField
                control={control}
                name={`items.${index}.remark`}
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Input placeholder="Add a note for this item..." {...field} className="h-7 text-xs italic bg-transparent border-none shadow-none focus-visible:ring-0 px-0" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <div className="absolute top-2 right-2">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => remove(index)}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    </div>
  )
}

export function OrderFormDialog({ 
    order,
    isOpen, 
    setIsOpen, 
    departmentNameOptions, 
    allProducts 
}: { 
    order?: OrderWithItems;
    isOpen: boolean; 
    setIsOpen: (open: boolean) => void; 
    departmentNameOptions: string[]; 
    allProducts: Product[] 
}) {
    const { toast } = useToast();
    const isEditing = !!order;
    const [isScanning, setIsScanning] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    
    const form = useForm<CreateOrderSchema>({
        resolver: zodResolver(createOrderSchema),
        defaultValues: {
            partyName: '',
            sourceLocation: '',
            orderDate: format(new Date(), 'yyyy-MM-dd'),
            mailDate: '',
            status: 'pending',
            pageNo: undefined,
            attachmentUrl: '',
            items: [{ productName: '', unit: '', quantity: 1, remark: '', rate: undefined, gst: undefined }]
        },
        context: allProducts
    });

    const { fields, append, remove, replace } = useFieldArray({
        control: form.control,
        name: "items",
    });

    // Calculate total order estimate
    const items = form.watch('items');
    const orderTotal = React.useMemo(() => {
        return items.reduce((sum, item) => {
            const q = item.quantity || 0;
            const r = item.rate || 0;
            const g = item.gst || 0;
            return sum + (q * r * (1 + g / 100));
        }, 0);
    }, [items]);

    React.useEffect(() => {
        if (isOpen) {
            if (isEditing && order) {
                form.reset({
                    partyName: order.partyName,
                    sourceLocation: order.sourceLocation || '',
                    orderDate: format(safeToDate(order.orderDate), 'yyyy-MM-dd'),
                    mailDate: order.mailDate ? format(safeToDate(order.mailDate), 'yyyy-MM-dd') : '',
                    status: order.status,
                    pageNo: order.pageNo,
                    attachmentUrl: order.attachmentUrl || '',
                    items: order.items.map(item => ({
                        productName: item.productName,
                        unit: item.unit,
                        quantity: item.quantity,
                        productId: item.productId,
                        remark: item.remark || '',
                        rate: item.rate,
                        gst: item.gst
                    }))
                });
            } else {
                form.reset({
                    partyName: '',
                    sourceLocation: '',
                    orderDate: format(new Date(), 'yyyy-MM-dd'),
                    mailDate: '',
                    status: 'pending',
                    pageNo: undefined,
                    attachmentUrl: '',
                    items: [{ productName: '', unit: '', quantity: 1, remark: '', rate: undefined, gst: undefined }]
                });
            }
        }
    }, [isOpen, isEditing, order, form]);
    
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dt7vbeobv'; 
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'unsigned_preset'; 

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);

        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.error?.message || `API Error: ${response.status}`);
            }

            form.setValue('attachmentUrl', data.secure_url);
            toast({ title: "File Uploaded", description: "Slip successfully stored." });
        } catch (error: any) {
            toast({ 
                variant: 'destructive', 
                title: "Upload Failed", 
                description: error.message 
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleScanWithAI = async () => {
        const photoUrl = form.getValues('attachmentUrl');
        if (!photoUrl) {
            toast({ variant: 'destructive', title: "No File", description: "Please upload a photo first." });
            return;
        }

        setIsScanning(true);
        try {
            const result = await scanOrder({ photoDataUri: photoUrl });
            if (result.items && result.items.length > 0) {
                // For scanned items, we need to match with existing products to get rates
                const productsWithRates = await getAllProductsWithRatesAction();
                
                const itemsWithRates = result.items.map(item => {
                    const match = productsWithRates.find(p => normalizeName(p.name) === normalizeName(item.productName));
                    return {
                        productName: item.productName,
                        unit: item.unit,
                        quantity: item.quantity,
                        remark: item.remark,
                        rate: match?.rates?.[0]?.rate,
                        gst: match?.rates?.[0]?.gst
                    };
                });

                replace(itemsWithRates);
                if (result.partyName) form.setValue('partyName', result.partyName);
                toast({ title: "Scan Complete", description: `Found ${result.items.length} items.` });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: "Scan Failed", description: "Could not read the list." });
        } finally {
            setIsScanning(false);
        }
    };

    const normalizeName = (name: string): string => {
        if (!name) return '';
        return name.toLowerCase().replace(/[\s\/-]/g, '');
    }

    const productOptions = React.useMemo(() => 
        allProducts
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(p => ({ value: p.id, label: p.name })),
        [allProducts]
    );

    const locationOptions = ["Indore", "Gwalior", "Delhi", "Ashoknagar"];

    const onSubmit = async (data: CreateOrderSchema) => {
        setIsSubmitting(true);
        let result;
        if (isEditing && order) {
            result = await updateOrderAction(order.id, data);
        } else {
            result = await createOrderAction(data);
        }
        
        if(result.success) {
            toast({ title: isEditing ? "Order Updated" : "Order Created", description: "Saved successfully." });
            setIsOpen(false);
            form.reset();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
        setIsSubmitting(false);
    }

    return (
        <Form {...form}>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <DialogTitle>{isEditing ? 'Edit Order' : 'Create New Order'}</DialogTitle>
                                <DialogDescription>
                                    Manage demands and track estimated costs.
                                </DialogDescription>
                            </div>
                            <div className="flex gap-2">
                                <label className="cursor-pointer">
                                    <Input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
                                    <Button type="button" variant="outline" size="sm" className="gap-2" asChild disabled={isUploading}>
                                        <span>
                                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                                            {isUploading ? 'Uploading...' : 'Upload Slip (Optional)'}
                                        </span>
                                    </Button>
                                </label>
                                {form.watch('attachmentUrl') && (
                                    <Button 
                                        type="button" 
                                        variant="secondary" 
                                        size="sm" 
                                        className="gap-2 bg-purple-100 text-purple-700 hover:bg-purple-200"
                                        onClick={handleScanWithAI}
                                        disabled={isScanning || isUploading}
                                    >
                                        {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                        AI Scan
                                    </Button>
                                )}
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto px-1 flex-1">
                        {form.watch('attachmentUrl') && (
                            <div className="p-3 border rounded-lg bg-green-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded border bg-white overflow-hidden flex items-center justify-center">
                                        {form.watch('attachmentUrl').endsWith('.pdf') ? (
                                            <Paperclip className="h-6 w-6 text-muted-foreground" />
                                        ) : (
                                            <img src={form.watch('attachmentUrl')} className="h-full w-full object-cover" alt="Attachment" />
                                        )}
                                    </div>
                                    <span className="text-sm font-medium text-green-700">Slip attached for reference.</span>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => form.setValue('attachmentUrl', '')} className="text-destructive">Remove</Button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-card shadow-sm">
                            <FormField
                                control={form.control}
                                name="partyName"
                                render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Department</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Langar / Hospital..." {...field} list="dept-suggestions" />
                                        </FormControl>
                                        <datalist id="dept-suggestions">
                                            {departmentNameOptions.map((dept) => (
                                            <option key={dept} value={dept} />
                                            ))}
                                        </datalist>
                                      <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="sourceLocation"
                                render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Source Hub</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Indore/Delhi..." {...field} list="source-suggestions" />
                                        </FormControl>
                                        <datalist id="source-suggestions">
                                            {locationOptions.map((loc) => (
                                            <option key={loc} value={loc} />
                                            ))}
                                        </datalist>
                                      <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <FormField
                                    control={form.control}
                                    name="orderDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Demand Date</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="mailDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Mail Date</FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-muted/30 p-2 rounded-t-lg border-x border-t">
                                <h3 className="font-bold text-sm flex items-center gap-2 px-2">
                                    ITEMS & PRICING 
                                    <span className="text-xs font-normal text-muted-foreground">({fields.length})</span>
                                </h3>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => append({ productName: '', unit: '', quantity: 1, remark: '', rate: undefined, gst: undefined })}
                                >
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add Row
                                </Button>
                            </div>
                            <ScrollArea className="h-[40vh] pr-4 border rounded-b-lg p-2 bg-muted/5">
                                <div className="space-y-3">
                                    {fields.map((field, index) => (
                                        <OrderItemRow key={field.id} index={index} remove={remove} productOptions={productOptions} />
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border rounded-lg bg-primary/5">
                            <div className="flex items-center gap-2 text-sm">
                                <Calculator className="h-4 w-4 text-primary" />
                                <span className="font-medium text-muted-foreground uppercase">Estimated Order Total (Incl. GST):</span>
                            </div>
                            <div className="text-2xl font-black text-primary">
                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(orderTotal)}
                            </div>
                        </div>

                        <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
                            <DialogClose asChild><Button type="button" variant="ghost" disabled={isSubmitting}>Cancel</Button></DialogClose>
                            <Button type="submit" className="min-w-[150px]" disabled={isSubmitting || fields.length === 0 || isUploading}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {isSubmitting ? 'Saving...' : (isEditing ? 'Update Order' : 'Create Order')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Form>
    )
}

export function DeleteOrderDialog({
  order,
  isOpen,
  setIsOpen,
}: {
  order: OrderWithItems | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!order) return;
    setIsDeleting(true);
    const result = await deleteOrderAction(order.id);
    if (result.success) {
      toast({ title: 'Deleted', description: 'Order has been removed.' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
    setIsDeleting(false);
    setIsOpen(false);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this order?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the order for <span className="font-bold text-foreground">{order?.partyName}</span> and all its item records.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className='bg-destructive hover:bg-destructive/90'>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function PrintOrderSlip({ order }: { order: OrderWithItems }) {
    const printRef = React.useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const content = printRef.current?.innerHTML;
        const win = window.open('', '', 'height=700,width=900');
        if (!win) return;
        
        win.document.write(`
            <html>
                <head>
                    <title>Goods Demand Slip - ${order.partyName}</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px; }
                        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid black; padding-bottom: 10px; }
                        .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
                        .header h2 { margin: 5px 0; font-size: 18px; }
                        .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold; flex-wrap: wrap; gap: 10px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                        th, td { border: 1px solid black; padding: 10px; text-align: left; }
                        th { background-color: #f0f0f0; }
                        .footer { margin-top: 50px; display: flex; justify-content: space-between; }
                        .sig { border-top: 1px solid black; width: 200px; text-align: center; padding-top: 5px; }
                        .stamp { border: 2px solid blue; color: blue; padding: 10px; font-size: 12px; width: fit-content; text-transform: uppercase; }
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

    return (
        <>
            <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
            </Button>
            <div ref={printRef} className="hidden">
                <div className="header">
                    <h2>SHRI ANANDPUR TRUST</h2>
                    <h1>GOODS DEMAND SLIP</h1>
                    <p>Department: {order.partyName}</p>
                </div>
                <div className="meta">
                    <div>SOURCE: {order.sourceLocation || 'N/A'}</div>
                    <div>PAGE NO: {order.pageNo || '-'}</div>
                    <div>DATE: {format(safeToDate(order.orderDate), 'dd-MM-yyyy')}</div>
                    {order.mailDate && <div>MAIL DATE: {format(safeToDate(order.mailDate), 'dd-MM-yyyy')}</div>}
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: '50px' }}>S.N.</th>
                            <th>ITEM NAME</th>
                            <th style={{ width: '100px' }}>QTY</th>
                            <th style={{ width: '100px' }}>UNIT</th>
                            <th style={{ width: '150px' }}>REMARKS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((item, i) => (
                            <tr key={item.id}>
                                <td>{i + 1}</td>
                                <td>{item.productName}</td>
                                <td>{item.quantity}</td>
                                <td>{item.unit}</td>
                                <td>{item.remark || ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="footer">
                    <div className="sig">Sign. of Store Incharge</div>
                    <div className="stamp">
                        SHRI ANANDPUR TRUST<br/>
                        STORE DEPARTMENT<br/>
                        {format(new Date(), 'dd-MM-yyyy')}
                    </div>
                    <div className="sig">Sign. of Authorized Person</div>
                </div>
            </div>
        </>
    );
}

export function PrintPendingSummary({ orders, source }: { orders: OrderWithItems[], source: string }) {
    const printRef = React.useRef<HTMLDivElement>(null);

    const pendingItems = React.useMemo(() => {
        const items: Array<{ productName: string; unit: string; pendingQty: number; depts: string[] }> = [];
        
        orders.forEach(order => {
            order.items.forEach(item => {
                const pending = Math.max(0, item.quantity - (item.receivedQuantity || 0));
                if (pending > 0 && item.status !== 'cancelled') {
                    const existing = items.find(i => i.productName.toLowerCase() === item.productName.toLowerCase() && i.unit.toLowerCase() === item.unit.toLowerCase());
                    if (existing) {
                        existing.pendingQty += pending;
                        if (!existing.depts.includes(order.partyName)) {
                            existing.depts.push(order.partyName);
                        }
                    } else {
                        items.push({
                            productName: item.productName,
                            unit: item.unit,
                            pendingQty: pending,
                            depts: [order.partyName]
                        });
                    }
                }
            });
        });
        
        return items.sort((a, b) => a.productName.localeCompare(b.productName));
    }, [orders]);

    const handlePrint = () => {
        const content = printRef.current?.innerHTML;
        const win = window.open('', '', 'height=700,width=900');
        if (!win) return;
        
        win.document.write(`
            <html>
                <head>
                    <title>Pending Summary - ${source}</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px; }
                        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid black; padding-bottom: 10px; }
                        .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
                        .header h2 { margin: 5px 0; font-size: 18px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid black; padding: 8px; text-align: left; }
                        th { background-color: #f0f0f0; }
                        .footer { margin-top: 30px; text-align: right; font-style: italic; font-size: 12px; }
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

    if (pendingItems.length === 0) return null;

    return (
        <>
            <Button variant="outline" size="sm" className="gap-2 text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
                Print Pending List (${source === 'all' ? 'All' : source})
            </Button>
            <div ref={printRef} className="hidden">
                <div className="header">
                    <h2>SHRI ANANDPUR TRUST</h2>
                    <h1>PENDING GOODS SUMMARY</h1>
                    <p>SOURCE: {source === 'all' ? 'ALL LOCATIONS' : source.toUpperCase()}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: '50px' }}>S.N.</th>
                            <th>ITEM NAME</th>
                            <th style={{ width: '100px' }}>PENDING QTY</th>
                            <th style={{ width: '100px' }}>UNIT</th>
                            <th>DEPARTMENTS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pendingItems.map((item, i) => (
                            <tr key={i}>
                                <td>{i + 1}</td>
                                <td>{item.productName}</td>
                                <td><strong>{item.pendingQty}</strong></td>
                                <td>{item.unit}</td>
                                <td style={{ fontSize: '11px' }}>{item.depts.join(', ')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="footer">
                    Report Generated on: {format(new Date(), 'dd-MM-yyyy HH:mm')}
                </div>
            </div>
        </>
    );
}

export function MailPendingSummary({ orders, source }: { orders: OrderWithItems[], source: string }) {
    const pendingItems = React.useMemo(() => {
        const items: Array<{ productName: string; unit: string; pendingQty: number; depts: string[] }> = [];
        
        orders.forEach(order => {
            order.items.forEach(item => {
                const pending = Math.max(0, item.quantity - (item.receivedQuantity || 0));
                if (pending > 0 && item.status !== 'cancelled') {
                    const existing = items.find(i => i.productName.toLowerCase() === item.productName.toLowerCase() && i.unit.toLowerCase() === item.unit.toLowerCase());
                    if (existing) {
                        existing.pendingQty += pending;
                        if (!existing.depts.includes(order.partyName)) {
                            existing.depts.push(order.partyName);
                        }
                    } else {
                        items.push({
                            productName: item.productName,
                            unit: item.unit,
                            pendingQty: pending,
                            depts: [order.partyName]
                        });
                    }
                }
            });
        });
        
        return items.sort((a, b) => a.productName.localeCompare(b.productName));
    }, [orders]);

    const handleMail = () => {
        const dateStr = format(new Date(), 'dd-MM-yyyy');
        const subject = encodeURIComponent(`Pending Goods Demand - ${source === 'all' ? 'All Locations' : source} - ${dateStr}`);
        
        let body = `SHRI ANANDPUR TRUST\nPENDING GOODS SUMMARY\nSOURCE: ${source === 'all' ? 'ALL LOCATIONS' : source.toUpperCase()}\nGenerated on: ${dateStr}\n\n`;
        body += `S.N. | ITEM NAME | PENDING QTY | UNIT | DEPARTMENTS\n`;
        body += `------------------------------------------------------------\n`;
        
        pendingItems.forEach((item, i) => {
            body += `${i + 1}. ${item.productName} | ${item.pendingQty} | ${item.unit} | ${item.depts.join(', ')}\n`;
        });
        
        body += `\n------------------------------------------------------------\n`;
        body += `Please arrange these items for the Trust as soon as possible.\n`;
        
        window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;
    };

    if (pendingItems.length === 0) return null;

    return (
        <Button variant="outline" size="sm" className="gap-2 text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100" onClick={handleMail}>
            <Mail className="h-4 w-4" />
            Mail Pending List (${source === 'all' ? 'All' : source})
        </Button>
    );
}
