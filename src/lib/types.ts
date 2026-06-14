
import { z } from "zod";

const billDateSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "A valid bill date is required.",
});

export const productSchema = z.object({
  name: z.string().min(3, { message: "Product name must be at least 3 characters." }),
  unit: z.string().min(1, { message: "Unit is required." }),
  partyName: z.string().min(3, { message: "Department name must be at least 3 characters." }),
  rate: z.coerce.number().min(0.01, { message: "Rate must be a positive number." }),
  gst: z.coerce.number().min(0, { message: "GST must be a positive number." }),
  pageNo: z.coerce.number().int().min(1, { message: "Page number must be at least 1." }),
  billDate: billDateSchema,
});

export type ProductSchema = z.infer<typeof productSchema>;

export const updateProductSchema = z.object({
  name: z.string().min(3, { message: "Product name must be at least 3 characters." }),
  unit: z.string().min(1, { message: "Unit is required." }),
  partyName: z.string().min(3, { message: "Department name must be at least 3 characters." }),
  rate: z.coerce.number().min(0.01, { message: "Rate must be a positive number." }),
  gst: z.coerce.number().min(0, { message: "GST must be a positive number." }),
  pageNo: z.coerce.number().int().min(1, { message: "Page number must be at least 1." }),
  billDate: billDateSchema,
});

export type UpdateProductSchema = z.infer<typeof updateProductSchema>;

const batchProductEntrySchema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters."),
    unit: z.string().min(1, "Unit is required."),
    rate: z.coerce.number().min(0.01, "Base rate is required."),
    gst: z.coerce.number().min(0, "GST is required."),
    finalRate: z.coerce.number().min(0.01, "Final rate is required."),
});

export const batchProductSchema = z.object({
    partyName: z.string().min(3, "Department name is required."),
    billDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "A valid bill date is required." }),
    pageNo: z.coerce.number().int().min(1, "Page number is required."),
    products: z.array(batchProductEntrySchema).min(1, "At least one product must be added."),
});

export type BatchProductSchema = z.infer<typeof batchProductSchema>;

export type Product = {
  id: string;
  name: string;
  unit: string;
  partyName: string;
};

export type Rate = {
  id: string;
  rate: number;
  gst: number;
  pageNo: number;
  billDate: Date | string;
  createdAt: Date | string; 
};

export type ProductWithRates = Product & { rates: Rate[] };

// --- Order Schemas and Types ---

export const orderItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, "Product name is required."),
  unit: z.string().min(1, "Unit is required."),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0."),
  remark: z.string().optional(),
  rate: z.coerce.number().optional(),
  gst: z.coerce.number().optional(),
});
export type OrderItemSchema = z.infer<typeof orderItemSchema>;

export const dispatchDetailsSchema = z.object({
  receivedBySenderDate: z.string().optional(),
  dispatchedAt: z.string().optional(),
  dispatchedBy: z.string().optional(),
  driverName: z.string().optional(),
  recipientName: z.string().optional(),
  dispatchReason: z.enum(['purchased', 'sample', 'repairing', 'exchange', 'return', 'replacement', 'new_stock']).default('purchased'),
  status: z.enum(['pending', 'received', 'dispatched', 'cancelled']).default('dispatched'),
});
export type DispatchDetailsSchema = z.infer<typeof dispatchDetailsSchema>;

export const createOrderSchema = z.object({
  partyName: z.string().min(1, "Department name is required."),
  sourceLocation: z.string().optional(),
  orderDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "A valid order date is required." }),
  mailDate: z.string().optional(),
  status: z.enum(['pending', 'completed', 'cancelled']),
  pageNo: z.coerce.number().int().min(1, "Page number is required.").optional(),
  attachmentUrl: z.string().optional().or(z.literal("")).describe("Data URI or URL of the attached JPG/PDF"),
  items: z.array(orderItemSchema).min(1, "Order must contain at least one item."),
});
export type CreateOrderSchema = z.infer<typeof createOrderSchema>;

export const quickDispatchSchema = z.object({
  partyName: z.string().min(1, "Department is required."),
  destination: z.string().min(1, "Destination is required."),
  productName: z.string().min(1, "Item name is required."),
  quantity: z.coerce.number().min(0.01, "Quantity is required."),
  unit: z.string().min(1, "Unit is required."),
  receivedBySenderDate: z.string().min(1, "Received date is required."),
  dispatchedAt: z.string().min(1, "Dispatch date is required."),
  dispatchedBy: z.string().min(1, "Sender name is required."),
  driverName: z.string().min(1, "Driver name is required."),
  recipientName: z.string().optional(),
  dispatchReason: z.enum(['purchased', 'sample', 'repairing', 'exchange', 'return', 'replacement', 'new_stock']).default('purchased'),
  remark: z.string().optional(),
  attachmentUrl: z.string().optional().or(z.literal("")).describe("URL of the attached gate pass slip"),
});
export type QuickDispatchSchema = z.infer<typeof quickDispatchSchema>;

export type DeliveryRecord = {
  id: string;
  quantity: number;
  deliveryDate: Date | string;
  remark?: string;
  createdAt: Date | string;
};

export type OrderItem = {
  id: string;
  productId?: string;
  productName: string;
  unit: string;
  quantity: number;
  receivedQuantity?: number;
  remark?: string;
  rate?: number;
  gst?: number;
  status: 'pending' | 'received' | 'dispatched' | 'cancelled';
  deliveries?: DeliveryRecord[];
  
  // New logistics fields
  receivedBySenderDate?: Date | string;
  dispatchedAt?: Date | string;
  dispatchedBy?: string;
  driverName?: string;
  recipientName?: string;
  dispatchReason?: string;
};

export type Order = {
  id: string;
  partyName: string;
  sourceLocation?: string;
  orderDate: Date | string;
  mailDate?: Date | string;
  status: 'pending' | 'completed' | 'cancelled';
  totalAmount: number;
  pageNo?: number;
  attachmentUrl?: string;
  createdAt: Date | string; 
};

export type OrderWithItems = Order & { items: OrderItem[] };
