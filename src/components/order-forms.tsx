
'use client';

import * as React from 'react';
import { z } from 'zod';
import { useForm, useFieldArray, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';

import { createOrderAction, deleteOrderAction } from '@/lib/actions';
import type { Product, CreateOrderSchema, OrderWithItems } from '@/lib/types';
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
import { PlusCircle, Trash2, Printer } from 'lucide-react';
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

function OrderItemRow({ index, remove, productOptions }: { index: number; remove: (index: number) => void; productOptions: {value: string; label: string;}[] }) {
  const { control, setValue } = useFormContext<CreateOrderSchema>();
  
  const handleProductNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    const allProducts = (control as any)._options.context as Product[];
    const product = allProducts.find(p => p.name.toLowerCase() === newName.toLowerCase());

    if (product) {
        setValue(`items.${index}.productId`, product.id);
        setValue(`items.${index}.unit`, product.unit);
    } else {
        setValue(`items.${index}.productId`, undefined);
    }
  };

  return (
    <div className="relative grid grid-cols-12 gap-x-3 gap-y-2 border p-3 rounded-md bg-muted/20">
        <div className="col-span-12 md:col-span-6">
             <FormField
                control={control}
                name={`items.${index}.productName`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs">Product Name</FormLabel>
                        <FormControl>
                            <Input 
                                {...field}
                                onChange={(e) => {
                                    field.onChange(e);
                                    handleProductNameChange(e);
                                }}
                                placeholder="Start typing..."
                                list={`product-suggestions-${index}`}
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
        <div className="col-span-6 md:col-span-2">
            <FormField
                control={control}
                name={`items.${index}.unit`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs">Unit</FormLabel>
                        <FormControl>
                            <Input placeholder="kg/pc" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        <div className="col-span-4 md:col-span-3">
            <FormField
                control={control}
                name={`items.${index}.quantity`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs">Quantity</FormLabel>
                        <FormControl>
                            <Input type="number" step="any" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <div className="col-span-2 md:col-span-1 flex items-end justify-end">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                onClick={() => remove(index)}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    </div>
  )
}

export function CreateOrderDialog({ isOpen, setIsOpen, departmentNameOptions, allProducts }: { isOpen: boolean; setIsOpen: (open: boolean) => void; departmentNameOptions: string[]; allProducts: Product[] }) {
    const { toast } = useToast();
    
    const form = useForm<CreateOrderSchema>({
        resolver: zodResolver(createOrderSchema),
        defaultValues: {
            partyName: '',
            sourceLocation: '',
            orderDate: format(new Date(), 'yyyy-MM-dd'),
            mailDate: '',
            status: 'pending',
            pageNo: undefined,
            items: [{ productName: '', unit: '', quantity: 1 }]
        },
        context: allProducts
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    });
    
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const productOptions = React.useMemo(() => 
        allProducts
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(p => ({ value: p.id, label: p.name })),
        [allProducts]
    );

    const locationOptions = ["Indore", "Gwalior", "Delhi", "Ashoknagar"];

    const onSubmit = async (data: CreateOrderSchema) => {
        setIsSubmitting(true);
        const result = await createOrderAction(data);
        
        if(result.success) {
            toast({ title: "Order Created", description: "The order has been saved successfully." });
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
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Create New Order</DialogTitle>
                        <DialogDescription>
                            Enter department and required items. Prices are not tracked here.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto px-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-card">
                            <FormField
                                control={form.control}
                                name="partyName"
                                render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Department Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Type department..." {...field} list="dept-suggestions" />
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
                                      <FormLabel>Source (Indore/Gwalior/etc)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Where to buy from?" {...field} list="source-suggestions" />
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
                            <FormField
                                control={form.control}
                                name="orderDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Demand Date</FormLabel>
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
                                        <FormLabel>Date of Mail (Optional)</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="pageNo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Page No.</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                placeholder="Bill page"
                                                {...field}
                                                value={field.value ?? ''}
                                                onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold">Required Items</h3>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ productName: '', unit: '', quantity: 1 })}
                                >
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add Another Item
                                </Button>
                            </div>
                            <ScrollArea className="h-[45vh] pr-4 border rounded-lg p-2">
                                <div className="space-y-3">
                                    {fields.map((field, index) => (
                                        <OrderItemRow key={field.id} index={index} remove={remove} productOptions={productOptions} />
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                        
                        <DialogFooter className="sticky bottom-0 bg-background pt-2">
                            <DialogClose asChild><Button type="button" variant="ghost" disabled={isSubmitting}>Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting || fields.length === 0}>{isSubmitting ? 'Saving...' : 'Create Order'}</Button>
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
            This will permanently delete the order for <span className="font-bold text-foreground">{order?.partyName}</span> and all its item status records.
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
                                <td></td>
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
