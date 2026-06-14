'use server';

import { revalidatePath } from 'next/cache';
import {
  addProduct as addProductToDb,
  batchAddProducts as batchAddProductsToDb,
  updateProduct as updateProductInDb,
  deleteProduct as deleteProductFromDb,
  addRate as addRateToDb,
  deleteRate as deleteRateFromDb,
  getAllProductsWithRates,
  importProductsAndRates,
  createOrder as createOrderInDb,
  updateOrder as updateOrderInDb,
  updateOrderItemStatus as updateOrderItemStatusInDb,
  getAllOrdersWithItems as getAllOrdersWithItemsFromDb,
  deleteOrder as deleteOrderFromDb,
  logDeliveryRecord as logDeliveryRecordToDb,
  deleteDeliveryRecord as deleteDeliveryRecordFromDb,
} from './data';
import type { Rate, UpdateProductSchema, ProductWithRates, BatchProductSchema, CreateOrderSchema, OrderItem, OrderWithItems } from './types';
import { productSchema } from './types';
import { z } from 'zod';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

type ProductFormData = z.infer<typeof productSchema>;

async function handleAction<T>(
  action: () => Promise<T>,
  revalidatePaths: string[] = []
): Promise<{ success: true; data: T } | { success: false; message: string }> {
  try {
    const data = await action();
    if (revalidatePaths.length > 0) {
      revalidatePaths.forEach(path => revalidatePath(path));
    }
    return { success: true, data };
  } catch (error) {
    console.error('Action Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message };
  }
}

const mainPaths = ['/', '/dashboard'];
const orderPaths = ['/orders'];

export async function addProductAction(formData: ProductFormData) {
  const result = await handleAction(async () => {
    const { product, rate } = await addProductToDb(formData);
    return { product, rate, message: 'Product added successfully.' };
  }, mainPaths);
  return result.success ? { success: true, ...result.data } : { success: false, message: result.message };
}

export async function batchAddProductsAction(formData: BatchProductSchema) {
    const result = await handleAction(async () => {
        const counts = await batchAddProductsToDb(formData);
        return { counts };
    }, mainPaths);
    return result.success ? { success: true, added: result.data.counts.addedCount, skipped: result.data.counts.skippedCount } : { success: false, message: result.message };
}

export async function addRateAction(productId: string, rate: number, billDate: Date, pageNo: number, gst: number) {
  const result = await handleAction(async () => {
      const newRate = await addRateToDb(productId, rate, billDate, pageNo, gst);
      return { rate: newRate, message: 'Rate added successfully.' };
  }, mainPaths);
  return result.success ? { success: true, ...result.data } : { success: false, message: result.message };
}

export async function updateProductAction(productId: string, latestRateId: string, productData: UpdateProductSchema) {
  const result = await handleAction(() => updateProductInDb(productId, latestRateId, productData), mainPaths);
  return result.success ? { success: true, message: 'Product and rate updated successfully.' } : { success: false, message: result.message };
}

export async function deleteProductAction(productId: string) {
  const result = await handleAction(() => deleteProductFromDb(productId), mainPaths);
  return result.success ? { success: true, message: 'Product deleted successfully.' } : { success: false, message: result.message };
}

export async function deleteRateAction(productId: string, rateId: string) {
  const result = await handleAction(() => deleteRateFromDb(productId, rateId), mainPaths);
  return result.success ? { success: true, message: 'Rate deleted successfully.' } : { success: false, message: result.message };
}

export async function getAllProductsWithRatesAction(): Promise<ProductWithRates[]> {
  try {
    const products = await getAllProductsWithRates();
    return JSON.parse(JSON.stringify(products));
  } catch (error) { 
    console.error("Fetch products failed:", error);
    return []; 
  }
}

export async function createOrderAction(formData: CreateOrderSchema) {
    const result = await handleAction(async () => {
        const order = await createOrderInDb(formData);
        return { order, message: 'Order created successfully.' };
    }, mainPaths.concat(orderPaths));
    return result.success ? { success: true, ...result.data } : { success: false, message: result.message };
}

export async function updateOrderAction(orderId: string, formData: CreateOrderSchema) {
    const result = await handleAction(async () => {
        await updateOrderInDb(orderId, formData);
        return { message: 'Order updated successfully.' };
    }, mainPaths.concat(orderPaths));
    return result.success ? { success: true, message: 'Order updated successfully.' } : { success: false, message: result.message };
}

export async function deleteOrderAction(orderId: string) {
  const result = await handleAction(() => deleteOrderFromDb(orderId), orderPaths);
  return result.success ? { success: true, message: 'Order deleted successfully.' } : { success: false, message: result.message };
}

export async function updateOrderItemStatusAction(orderId: string, itemId: string, status: OrderItem['status']) {
    const result = await handleAction(() => updateOrderItemStatusInDb(orderId, itemId, status), orderPaths);
    return result.success ? { success: true, message: 'Item status updated.' } : { success: false, message: result.message };
}

export async function logDeliveryAction(orderId: string, itemId: string, quantity: number, date: string, remark: string) {
    const result = await handleAction(() => logDeliveryRecordToDb(orderId, itemId, { quantity, deliveryDate: new Date(date), remark }), orderPaths);
    return result.success ? { success: true, message: 'Delivery logged.' } : { success: false, message: result.message };
}

export async function deleteDeliveryRecordAction(orderId: string, itemId: string, logId: string) {
    const result = await handleAction(() => deleteDeliveryRecordFromDb(orderId, itemId, logId), orderPaths);
    return result.success ? { success: true, message: 'Delivery record removed.' } : { success: false, message: result.message };
}

export async function getAllOrdersWithItemsAction(): Promise<OrderWithItems[]> {
    try {
      const orders = await getAllOrdersWithItemsFromDb();
      return JSON.parse(JSON.stringify(orders));
    } catch (error) { 
      console.error("Fetch orders failed:", error);
      return []; 
    }
}

function convertDataForSheet(allProductsWithRates: ProductWithRates[]): (string | number | null)[][] {
    const headers = ['Product Name', 'Rate', 'Unit', 'GST %', 'Final Rate', 'Department Name', 'Page No', 'Bill Date'];
    headers[4] = '=ARRAYFORMULA(IF(ROW(E:E)=1, "Final Rate", IF(ISBLANK(B:B), "", B:B * (1 + D:D))))';
    const excelEpoch = new Date('1899-12-30').getTime();
    const rows = allProductsWithRates.flatMap(product => {
      if (!product.rates) return [];
      return product.rates.map((rate) => {
        const billDate = rate.billDate ? new Date(rate.billDate as string) : null;
        const serialNumber = billDate ? (billDate.getTime() - excelEpoch) / (24 * 60 * 60 * 1000) : null;
        return [product.name, parseFloat(String(rate.rate ?? 0)), product.unit, parseFloat(String(rate.gst ?? 0)) / 100, null, product.partyName, rate.pageNo, serialNumber];
      });
    });
    return [headers, ...rows];
}

function convertOrdersForSheet(allOrders: OrderWithItems[]): (string | number | null)[][] {
    const headers = [
        'Order Date', 
        'Mail Date',
        'Department', 
        'Source', 
        'Page No', 
        'Product Name', 
        'Demand Qty', 
        'Received Qty', 
        'Unit', 
        'Rate', 
        'GST %', 
        'Item Total', 
        'Status'
    ];
    
    const excelEpoch = new Date('1899-12-30').getTime();
    
    const rows = allOrders.flatMap(order => {
        return order.items.map(item => {
            const orderDate = order.orderDate ? new Date(order.orderDate as string) : null;
            const mailDate = order.mailDate ? new Date(order.mailDate as string) : null;
            
            const orderDateSerial = orderDate ? (orderDate.getTime() - excelEpoch) / (24 * 60 * 60 * 1000) : null;
            const mailDateSerial = mailDate ? (mailDate.getTime() - excelEpoch) / (24 * 60 * 60 * 1000) : null;
            
            const rate = item.rate || 0;
            const gst = item.gst || 0;
            const itemTotal = item.quantity * rate * (1 + gst / 100);

            return [
                orderDateSerial,
                mailDateSerial,
                order.partyName,
                order.sourceLocation || '',
                order.pageNo || '',
                item.productName,
                item.quantity,
                item.receivedQuantity || 0,
                item.unit,
                rate,
                gst,
                itemTotal,
                item.status
            ];
        });
    });
    
    return [headers, ...rows];
}

async function findOrCreateSheet(drive: any, sheets: any, name: string): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const searchResponse = await drive.files.list({ q: `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`, fields: 'files(id, webViewLink)' });
  if (searchResponse.data.files?.length) {
    return { spreadsheetId: searchResponse.data.files[0].id, spreadsheetUrl: searchResponse.data.files[0].webViewLink };
  }
  const createResponse = await sheets.spreadsheets.create({ requestBody: { properties: { title: name } }, fields: 'spreadsheetId,spreadsheetUrl' });
  return { spreadsheetId: createResponse.data.spreadsheetId, spreadsheetUrl: createResponse.data.spreadsheetUrl };
}

export async function exportToGoogleSheetAction(accessToken: string) {
  try {
    const oAuth2Client = new OAuth2Client();
    oAuth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
    const { spreadsheetId, spreadsheetUrl } = await findOrCreateSheet(drive, sheets, 'Rate Record Live Data');
    const allProductsWithRates = await getAllProductsWithRates();
    const values = convertDataForSheet(allProductsWithRates);
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'Sheet1' });
    await sheets.spreadsheets.values.update({ spreadsheetId, range: 'Sheet1', valueInputOption: 'USER_ENTERED', requestBody: { values } });
    return { success: true, message: `Data exported!`, link: spreadsheetUrl };
  } catch (error: any) { return { success: false, message: error.message }; }
}

export async function exportOrdersToGoogleSheetAction(accessToken: string) {
    try {
      const oAuth2Client = new OAuth2Client();
      oAuth2Client.setCredentials({ access_token: accessToken });
      const drive = google.drive({ version: 'v3', auth: oAuth2Client });
      const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
      
      const { spreadsheetId, spreadsheetUrl } = await findOrCreateSheet(drive, sheets, 'Trust Orders Live Data');
      
      const allOrders = await getAllOrdersWithItemsFromDb();
      const values = convertOrdersForSheet(allOrders);
      
      // We use Sheet1 for exports
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'Sheet1' });
      await sheets.spreadsheets.values.update({ 
          spreadsheetId, 
          range: 'Sheet1', 
          valueInputOption: 'USER_ENTERED', 
          requestBody: { values } 
      });
      
      return { success: true, message: `Orders exported!`, link: spreadsheetUrl };
    } catch (error: any) { 
      return { success: false, message: error.message }; 
    }
}

export async function importFromGoogleSheetAction(accessToken: string) {
  try {
    const oAuth2Client = new OAuth2Client();
    oAuth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
    const { spreadsheetId } = await findOrCreateSheet(drive, sheets, 'Rate Record Live Data');
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Sheet1!A:H', valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER' });
    const rows = response.data.values;
    if (!rows || rows.length < 2) return { success: true, message: 'Sheet is empty.' };
    const mapped = rows.slice(1).map(row => {
      const [name, rate, unit, gstRaw, , partyName, pageNo, dateSerial] = row;
      const excelEpoch = new Date('1899-12-30').getTime();
      const billDateISO = dateSerial ? new Date(Math.round(Number(dateSerial) * 86400000) + excelEpoch).toISOString() : '';
      return [name, partyName, unit, billDateISO, pageNo, rate, Number(gstRaw) * 100];
    });
    const result = await importProductsAndRates(mapped);
    orderPaths.concat(mainPaths).forEach(p => revalidatePath(p));
    return { success: true, message: `Import complete. Added: ${result.added}, Updated: ${result.updated}, Skipped: ${result.skipped}.` };
  } catch (error: any) { return { success: false, message: error.message }; }
}
