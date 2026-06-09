
'use server';

import { 
  serverTimestamp, 
  Timestamp,
  getFirestore,
  collection,
  doc,
  addDoc,
  runTransaction,
  updateDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  writeBatch,
  where,
  getDoc,
} from 'firebase/firestore';

import { getSdks } from '@/firebase/server';
import type { Product, Rate, ProductSchema, UpdateProductSchema, ProductWithRates, BatchProductSchema, Order, OrderItem, CreateOrderSchema, OrderWithItems, DeliveryRecord } from './types';

async function getDb() {
  const { firestore } = getSdks();
  return firestore;
}

const PRODUCTS_COLLECTION = 'products';
const RATES_SUBCOLLECTION = 'rates';
const ORDERS_COLLECTION = 'orders';
const ORDER_ITEMS_SUBCOLLECTION = 'items';
const DELIVERY_LOGS_SUBCOLLECTION = 'deliveries';

const normalizeName = (name: string): string => {
    if (!name) return '';
    return name.toLowerCase().replace(/[\s\/-]/g, '');
}

export const addProduct = async (formData: ProductSchema): Promise<{product: Product, rate: Rate}> => {
  const db = await getDb();
  const { name, unit, partyName, rate, gst, pageNo, billDate } = formData;
  
  const productsRef = collection(db, PRODUCTS_COLLECTION);
  const partyProductsQuery = query(productsRef, where('partyName', '==', partyName));
  const partyProductsSnapshot = await getDocs(partyProductsQuery);
  
  const normalizedNewName = normalizeName(name);
  let existingProductDoc = null;

  for (const doc of partyProductsSnapshot.docs) {
      if (normalizeName(doc.data().name) === normalizedNewName) {
          existingProductDoc = doc;
          break;
      }
  }

  let productId: string;
  let productData: Omit<Product, 'id'>;

  if (existingProductDoc) {
    productId = existingProductDoc.id;
    productData = existingProductDoc.data() as Omit<Product, 'id'>;
    const existingRates = await getProductRates(productId);
    const isDuplicateRate = existingRates.some(r => r.rate === rate && r.gst === gst);
    if (isDuplicateRate) {
        throw new Error(`This rate (${rate} + ${gst}% GST) for '${productData.name}' from '${partyName}' has already been recorded.`);
    }
  } else {
    const newProductData = { name, unit, partyName };
    const newProductRef = await addDoc(collection(db, PRODUCTS_COLLECTION), newProductData);
    productId = newProductRef.id;
    productData = newProductData;
  }

  const rateData = { rate, gst, pageNo, billDate: new Date(billDate), createdAt: new Date() };
  await addDoc(collection(db, PRODUCTS_COLLECTION, productId, RATES_SUBCOLLECTION), { ...rateData, createdAt: serverTimestamp() });

  return { product: { id: productId, ...productData }, rate: { id: '', ...rateData } };
};

export const batchAddProducts = async (formData: BatchProductSchema): Promise<{ addedCount: number; skippedCount: number }> => {
    const db = await getDb();
    const { partyName, billDate, pageNo, products } = formData;
    let addedCount = 0;
    let skippedCount = 0;
    const existingProducts = await getAllProductsWithRates({ onlyLatestRate: false });
    const productMap = new Map(existingProducts.map(p => [`${normalizeName(p.name)}_${normalizeName(p.partyName)}`, { id: p.id, rates: p.rates }]));
    const batch = writeBatch(db);
    for (const product of products) {
        const productKey = `${normalizeName(product.name)}_${normalizeName(partyName)}`;
        const existingProductInfo = productMap.get(productKey);
        let targetProductId: string;
        if (existingProductInfo) {
            targetProductId = existingProductInfo.id;
            const isDuplicateRate = existingProductInfo.rates.some(r => r.rate === product.rate && r.gst === product.gst);
            if (isDuplicateRate) { skippedCount++; continue; }
        } else {
            const newProductRef = doc(collection(db, PRODUCTS_COLLECTION));
            batch.set(newProductRef, { name: product.name, unit: product.unit, partyName: partyName });
            targetProductId = newProductRef.id;
            productMap.set(productKey, { id: targetProductId, rates: [] }); 
        }
        const newRateRef = doc(collection(db, PRODUCTS_COLLECTION, targetProductId, RATES_SUBCOLLECTION));
        batch.set(newRateRef, { rate: product.rate, gst: product.gst, pageNo: pageNo, billDate: new Date(billDate), createdAt: serverTimestamp() });
        addedCount++;
    }
    await batch.commit();
    return { addedCount, skippedCount };
};

export const updateProduct = async (productId: string, latestRateId: string, updateData: UpdateProductSchema): Promise<void> => {
  const db = await getDb();
  const productDocRef = doc(db, PRODUCTS_COLLECTION, productId);
  const rateDocRef = doc(db, PRODUCTS_COLLECTION, productId, RATES_SUBCOLLECTION, latestRateId);
  const { name, unit, partyName, rate, gst, pageNo, billDate } = updateData;
  const batch = writeBatch(db);
  batch.update(productDocRef, { name, unit, partyName });
  batch.update(rateDocRef, { rate, gst, pageNo, billDate: new Date(billDate) });
  await batch.commit();
};

export const deleteProduct = async (productId: string): Promise<void> => {
  const db = await getDb();
  const productDocRef = doc(db, PRODUCTS_COLLECTION, productId);
  const ratesSnapshot = await getDocs(collection(productDocRef, RATES_SUBCOLLECTION));
  const batch = writeBatch(db);
  ratesSnapshot.forEach((rateDoc) => batch.delete(rateDoc.ref));
  batch.delete(productDocRef);
  await batch.commit();
};

export const getProductRates = async (productId: string): Promise<Rate[]> => {
  const db = await getDb();
  const ratesCol = collection(db, PRODUCTS_COLLECTION, productId, RATES_SUBCOLLECTION);
  const q = query(ratesCol, orderBy('createdAt', 'desc'));
  const ratesSnapshot = await getDocs(q);
  return ratesSnapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : new Date();
      const billDate = (data.billDate as Timestamp)?.toDate ? (data.billDate as Timestamp).toDate() : new Date();
      return { id: doc.id, rate: data.rate, gst: data.gst, pageNo: data.pageNo, billDate, createdAt } as Rate;
  });
};

export const addRate = async (productId: string, rate: number, billDate: Date, pageNo: number, gst: number): Promise<Rate> => {
    const db = await getDb();
    const existingRates = await getProductRates(productId);
    if (existingRates.some(r => r.rate === rate && r.gst === gst)) {
        throw new Error('This rate for this product has already been recorded.');
    }
    const newRateData = { rate, gst, pageNo, billDate, createdAt: serverTimestamp() };
    const newRateRef = await addDoc(collection(doc(db, PRODUCTS_COLLECTION, productId), RATES_SUBCOLLECTION), newRateData);
    return { id: newRateRef.id, rate, gst, pageNo, billDate, createdAt: new Date() };
};

export const deleteRate = async (productId: string, rateId: string): Promise<void> => {
  const db = await getDb();
  await deleteDoc(doc(db, PRODUCTS_COLLECTION, productId, RATES_SUBCOLLECTION, rateId));
};

export const getAllProductsWithRates = async (options?: { onlyLatestRate: boolean }): Promise<ProductWithRates[]> => {
    const db = await getDb();
    const productsSnapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
    const results: ProductWithRates[] = [];
    for (const pDoc of productsSnapshot.docs) {
        const rates = await getProductRates(pDoc.id);
        results.push({ id: pDoc.id, ...pDoc.data() as any, rates: options?.onlyLatestRate ? rates.slice(0, 1) : rates });
    }
    return results;
};

export async function importProductsAndRates(rows: any[][]) {
  const db = await getDb();
  let added = 0, updated = 0, skipped = 0;
  const existingProductsData = await getAllProductsWithRates({ onlyLatestRate: false });
  const productCheckMap = existingProductsData.reduce((acc, p) => {
    acc[`${normalizeName(p.name)}_${normalizeName(p.partyName)}`] = { id: p.id, rates: p.rates };
    return acc;
  }, {} as any);
  const batch = writeBatch(db);
  for (const row of rows) {
    const [name, partyName, unit, billDateISO, pageNoStr, rateStr, gstStr] = row;
    const rate = parseFloat(rateStr), pageNo = parseInt(pageNoStr, 10), gst = parseFloat(gstStr);
    if (!name || !partyName || !unit || !billDateISO || isNaN(rate) || isNaN(pageNo) || isNaN(gst)) { skipped++; continue; }
    const productKey = `${normalizeName(name)}_${normalizeName(partyName)}`;
    const existing = productCheckMap[productKey];
    if (existing) {
      if (existing.rates.some((r: any) => r.rate === rate && r.gst === gst)) { skipped++; }
      else {
        batch.set(doc(collection(db, PRODUCTS_COLLECTION, existing.id, RATES_SUBCOLLECTION)), { rate, gst, pageNo, billDate: new Date(billDateISO), createdAt: serverTimestamp() });
        updated++;
      }
    } else {
      const pRef = doc(collection(db, PRODUCTS_COLLECTION));
      batch.set(pRef, { name, partyName, unit });
      batch.set(doc(collection(pRef, RATES_SUBCOLLECTION)), { rate, gst, pageNo, billDate: new Date(billDateISO), createdAt: serverTimestamp() });
      added++;
    }
  }
  await batch.commit();
  return { added, updated, skipped };
}

// --- Order & Delivery Logic ---

export const getDeliveryRecords = async (orderId: string, itemId: string): Promise<DeliveryRecord[]> => {
    const db = await getDb();
    const logsCol = collection(db, ORDERS_COLLECTION, orderId, ORDER_ITEMS_SUBCOLLECTION, itemId, DELIVERY_LOGS_SUBCOLLECTION);
    const q = query(logsCol, orderBy('deliveryDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            quantity: data.quantity,
            deliveryDate: (data.deliveryDate as Timestamp)?.toDate?.() || new Date(data.deliveryDate),
            remark: data.remark || '',
            createdAt: (data.createdAt as Timestamp)?.toDate?.() || new Date(),
        };
    });
};

export const getOrderItems = async (orderId: string): Promise<OrderItem[]> => {
    const db = await getDb();
    const itemsCol = collection(db, ORDERS_COLLECTION, orderId, ORDER_ITEMS_SUBCOLLECTION);
    const snapshot = await getDocs(itemsCol);
    const results: OrderItem[] = [];
    for (const iDoc of snapshot.docs) {
        const data = iDoc.data();
        const deliveries = await getDeliveryRecords(orderId, iDoc.id);
        const receivedQuantity = deliveries.reduce((sum, d) => sum + d.quantity, 0);
        results.push({ id: iDoc.id, ...data, receivedQuantity, deliveries } as any);
    }
    return results;
};

export const getAllOrdersWithItems = async (): Promise<OrderWithItems[]> => {
    const db = await getDb();
    const q = query(collection(db, ORDERS_COLLECTION), orderBy('orderDate', 'desc'));
    const snapshot = await getDocs(q);
    const results: OrderWithItems[] = [];
    for (const oDoc of snapshot.docs) {
        const data = oDoc.data();
        const items = await getOrderItems(oDoc.id);
        results.push({ 
            id: oDoc.id, 
            ...data, 
            orderDate: (data.orderDate as Timestamp).toDate(),
            mailDate: data.mailDate ? (data.mailDate as Timestamp).toDate() : undefined,
            createdAt: (data.createdAt as Timestamp).toDate(), 
            items 
        } as any);
    }
    return results;
};

export const logDeliveryRecord = async (orderId: string, itemId: string, record: { quantity: number; deliveryDate: Date; remark: string }): Promise<void> => {
    const db = await getDb();
    const itemRef = doc(db, ORDERS_COLLECTION, orderId, ORDER_ITEMS_SUBCOLLECTION, itemId);
    const logsCol = collection(itemRef, DELIVERY_LOGS_SUBCOLLECTION);
    
    await runTransaction(db, async (transaction) => {
        // 1. READ FIRST
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) throw new Error("Item not found");
        
        const data = itemDoc.data();
        const reqQty = data?.quantity || 0;
        const currentReceived = data?.receivedQuantity || 0;
        const totalReceived = currentReceived + record.quantity;
        
        // Auto-update status based on new total
        let newStatus = data?.status || 'pending';
        if (totalReceived >= reqQty) newStatus = 'received';
        else if (totalReceived > 0) newStatus = 'dispatched';
        
        // 2. WRITE SECOND
        const newLogRef = doc(logsCol);
        transaction.set(newLogRef, { ...record, createdAt: serverTimestamp() });
        transaction.update(itemRef, { receivedQuantity: totalReceived, status: newStatus });
    });
};

export const deleteDeliveryRecord = async (orderId: string, itemId: string, logId: string): Promise<void> => {
    const db = await getDb();
    const itemRef = doc(db, ORDERS_COLLECTION, orderId, ORDER_ITEMS_SUBCOLLECTION, itemId);
    const logRef = doc(itemRef, DELIVERY_LOGS_SUBCOLLECTION, logId);
    
    await runTransaction(db, async (transaction) => {
        // 1. READ FIRST
        const logDoc = await transaction.get(logRef);
        const itemDoc = await transaction.get(itemRef);
        
        if (!logDoc.exists() || !itemDoc.exists()) return;
        
        const removedQty = logDoc.data().quantity || 0;
        const currentReceived = itemDoc.data().receivedQuantity || 0;
        const totalReceived = Math.max(0, currentReceived - removedQty);
        
        const reqQty = itemDoc.data().quantity || 0;
        let newStatus = itemDoc.data().status || 'pending';
        if (totalReceived === 0) newStatus = 'pending';
        else if (totalReceived < reqQty) newStatus = 'dispatched';
        else newStatus = 'received';

        // 2. WRITE SECOND
        transaction.delete(logRef);
        transaction.update(itemRef, { receivedQuantity: totalReceived, status: newStatus });
    });
};

export const createOrder = async (orderData: CreateOrderSchema): Promise<OrderWithItems> => {
    const db = await getDb();
    const { partyName, sourceLocation, orderDate, mailDate, status, items, pageNo } = orderData;
    const newOrderRef = await addDoc(collection(db, ORDERS_COLLECTION), {
        partyName, 
        sourceLocation: sourceLocation || '', 
        orderDate: new Date(orderDate), 
        mailDate: mailDate ? new Date(mailDate) : null,
        status, 
        totalAmount: 0, 
        pageNo, 
        createdAt: serverTimestamp()
    });
    const batch = writeBatch(db);
    items.forEach(item => {
        const iRef = doc(collection(newOrderRef, ORDER_ITEMS_SUBCOLLECTION));
        batch.set(iRef, { 
            productName: item.productName, 
            unit: item.unit, 
            quantity: item.quantity, 
            remark: item.remark || '',
            status: 'pending', 
            receivedQuantity: 0 
        });
    });
    await batch.commit();
    return { id: newOrderRef.id, ...orderData, items: [], createdAt: new Date(), totalAmount: 0 } as any;
};

export const updateOrder = async (orderId: string, orderData: CreateOrderSchema): Promise<void> => {
    const db = await getDb();
    const orderRef = doc(db, ORDERS_COLLECTION, orderId);
    const { partyName, sourceLocation, orderDate, mailDate, items, pageNo } = orderData;

    await runTransaction(db, async (transaction) => {
        // Update main order doc
        transaction.update(orderRef, {
            partyName,
            sourceLocation: sourceLocation || '',
            orderDate: new Date(orderDate),
            mailDate: mailDate ? new Date(mailDate) : null,
            pageNo,
        });

        // For items:
        const itemsSnapshot = await getDocs(collection(orderRef, ORDER_ITEMS_SUBCOLLECTION));
        const existingItems = itemsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        for (const item of items) {
            const existing = existingItems.find(ei => (ei as any).productName === item.productName);
            if (existing) {
                const iRef = doc(db, ORDERS_COLLECTION, orderId, ORDER_ITEMS_SUBCOLLECTION, existing.id);
                transaction.update(iRef, { unit: item.unit, quantity: item.quantity, remark: item.remark || '' });
            } else {
                const iRef = doc(collection(orderRef, ORDER_ITEMS_SUBCOLLECTION));
                transaction.set(iRef, { 
                    productName: item.productName, 
                    unit: item.unit, 
                    quantity: item.quantity, 
                    remark: item.remark || '',
                    status: 'pending', 
                    receivedQuantity: 0 
                });
            }
        }

        for (const ei of existingItems) {
            const stillExists = items.some(i => i.productName === (ei as any).productName);
            if (!stillExists) {
                const iRef = doc(db, ORDERS_COLLECTION, orderId, ORDER_ITEMS_SUBCOLLECTION, ei.id);
                transaction.delete(iRef);
            }
        }
    });
};

export const deleteOrder = async (orderId: string): Promise<void> => {
  const db = await getDb();
  const orderRef = doc(db, ORDERS_COLLECTION, orderId);
  const itemsSnapshot = await getDocs(collection(orderRef, ORDER_ITEMS_SUBCOLLECTION));
  
  const batch = writeBatch(db);
  
  for (const iDoc of itemsSnapshot.docs) {
      const logsSnapshot = await getDocs(collection(iDoc.ref, DELIVERY_LOGS_SUBCOLLECTION));
      logsSnapshot.forEach(l => batch.delete(l.ref));
      batch.delete(iDoc.ref);
  }
  
  batch.delete(orderRef);
  await batch.commit();
};

export const updateOrderItemStatus = async (orderId: string, itemId: string, status: OrderItem['status']): Promise<void> => {
    const db = await getDb();
    await updateDoc(doc(db, ORDERS_COLLECTION, orderId, ORDER_ITEMS_SUBCOLLECTION, itemId), { status });
};
