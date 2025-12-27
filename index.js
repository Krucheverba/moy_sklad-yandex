// index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
const { createCustomerOrder, createDemand, findCustomerOrderByExternalNumber, findDemandByExternalNumber } = require('./moysklad');
const mapping = require('./mapping.json');

// Validate required environment variables
const requiredEnvVars = [
  'MOYSKLAD_BASE',
  'MOYSKLAD_LOGIN',
  'MOYSKLAD_PASSWORD',
  'STORE_ID',
  'ORG_ID'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`[CONFIG] Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('[CONFIG] Please set all required environment variables in .env file or environment');
  process.exit(1);
}

// Log configuration (without sensitive values)
console.log('[CONFIG] Configuration loaded successfully');
console.log(`[CONFIG] MoySklad Base URL: ${process.env.MOYSKLAD_BASE}`);
console.log(`[CONFIG] MoySklad Login: ${process.env.MOYSKLAD_LOGIN}`);
console.log(`[CONFIG] Store ID: ${process.env.STORE_ID}`);
console.log(`[CONFIG] Organization ID: ${process.env.ORG_ID}`);
console.log(`[CONFIG] Webhook Secret: ${process.env.WEBHOOK_SECRET ? 'configured' : 'not configured (verification disabled)'}`);
console.log(`[CONFIG] Port: ${process.env.PORT || 3000}`);

// Validate product mapping
console.log('[MAPPING] Validating product mapping...');

if (!mapping || typeof mapping !== 'object') {
  console.error('[MAPPING] Invalid mapping.json format: expected an object');
  process.exit(1);
}

const mappingCount = Object.keys(mapping).length;
console.log(`[MAPPING] Product mapping loaded: ${mappingCount} SKU mappings`);

if (mappingCount === 0) {
  console.warn('[MAPPING] ⚠️ WARNING: Product mapping is empty!');
  console.warn('[MAPPING] Run "npm start" to generate mapping.json before starting the server');
  console.warn('[MAPPING] Server will start but all orders will be skipped due to missing SKU mappings');
}

const app = express();

// Custom JSON parser with error handling
app.use((req, res, next) => {
  bodyParser.json()(req, res, (err) => {
    if (err) {
      console.error(`[WEBHOOK] Malformed JSON: error="${err.message}"`);
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    next();
  });
});

const STORE_ID = process.env.STORE_ID;
const ORG_ID = process.env.ORG_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// In-memory cache для хранения items между вебхуками
// Яндекс не передаёт items в ORDER_STATUS_UPDATED, поэтому сохраняем их из ORDER_CREATED
const orderItemsCache = new Map();

// Verify webhook signature using HMAC-SHA256
function verifyWebhook(req) {
  // Check if WEBHOOK_SECRET is configured
  if (!WEBHOOK_SECRET) {
    console.warn('[WEBHOOK] WEBHOOK_SECRET not configured, skipping verification');
    return true;
  }
  
  // Get signature from headers (common header names for webhook signatures)
  const signature = req.headers['x-signature'] || 
                   req.headers['x-hub-signature'] || 
                   req.headers['x-yandex-signature'];
  
  if (!signature) {
    console.warn('[WEBHOOK] No signature header found in request');
    return false;
  }
  
  try {
    // Create HMAC hash of request body
    const body = JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    hmac.update(body);
    const expectedSignature = hmac.digest('hex');
    
    // Compare signatures (constant-time comparison to prevent timing attacks)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    
    if (!isValid) {
      console.warn('[WEBHOOK] Signature verification failed');
    }
    
    return isValid;
  } catch (err) {
    console.error(`[WEBHOOK] Error during signature verification: error="${err.message}"`);
    return false;
  }
}

function mapPositionsFromYandex(yandexNotification) {
  // Обрабатываем структуру от Яндекса согласно документации:
  // { notificationType, orderId, campaignId, items: [{ offerId, count }], createdAt }
  const positions = [];
  if (!yandexNotification.items || !Array.isArray(yandexNotification.items)) {
    console.warn('[MAPPING] No items array in notification');
    return positions;
  }

  const orderId = yandexNotification.orderId || 'unknown';
  const unmappedSkus = [];

  for (const item of yandexNotification.items) {
    const offerId = item.offerId; // SKU товара
    const qty = item.count || 1; // Количество
    const productId = mapping[offerId];
    
    if (!productId) {
      console.error(`[MAPPING] Unmapped SKU: orderId="${orderId}", sku="${offerId}", quantity="${qty}"`);
      unmappedSkus.push(offerId);
      continue;
    }
    
    console.log(`[MAPPING] Mapped: SKU="${offerId}" -> ProductID="${productId}", qty=${qty}`);
    positions.push({ productId, quantity: qty });
  }
  
  // Логируем итоговую статистику
  if (unmappedSkus.length > 0) {
    console.warn(`[MAPPING] Order has unmapped SKUs: orderId="${orderId}", unmappedCount=${unmappedSkus.length}, mappedCount=${positions.length}, unmappedSkus=[${unmappedSkus.join(', ')}]`);
  }
  
  return positions;
}

// Handle ORDER_CREATED event - save items to cache
async function handleOrderCreated(notification, externalNumber) {
  console.log(`[ORDER_CREATED] Processing order: orderId="${externalNumber}"`);
  console.log(`[ORDER_CREATED] Campaign ID: ${notification.campaignId}, Created at: ${notification.createdAt}`);
  
  // Сохраняем items в кэш для последующего использования
  // Яндекс не передаёт items в ORDER_STATUS_UPDATED, поэтому сохраняем их здесь
  if (notification.items && Array.isArray(notification.items)) {
    orderItemsCache.set(externalNumber, notification.items);
    console.log(`[ORDER_CREATED] Saved ${notification.items.length} items to cache: orderId="${externalNumber}"`);
  } else {
    console.warn(`[ORDER_CREATED] No items in notification: orderId="${externalNumber}"`);
  }
  
  console.log(`[ORDER_CREATED] Order registered, waiting for PROCESSING status: orderId="${externalNumber}"`);
  return { status: 200, message: 'items_cached' };
}

// Handle PROCESSING status - create Customer Order (reserve)
async function handleProcessing(notification, externalNumber) {
  console.log(`[PROCESSING] Processing order: orderId="${externalNumber}"`);
  
  // Check if Customer Order already exists (idempotency)
  try {
    const existingOrder = await findCustomerOrderByExternalNumber(externalNumber);
    if (existingOrder) {
      console.log(`[PROCESSING] Customer Order already exists: orderId="${externalNumber}", skipping creation`);
      return { status: 200, message: 'already exists' };
    }
  } catch (err) {
    console.error(`[PROCESSING] Error checking existing Customer Order: orderId="${externalNumber}", error="${err.message}"`);
    if (err.stack) console.error(err.stack);
  }
  
  // Восстанавливаем items из кэша
  const cachedItems = orderItemsCache.get(externalNumber);
  if (!cachedItems) {
    console.error(`[PROCESSING] No cached items found: orderId="${externalNumber}"`);
    throw new Error('No cached items found for order');
  }
  
  // Создаём временный notification объект с items для маппинга
  const notificationWithItems = { ...notification, items: cachedItems };
  const positions = mapPositionsFromYandex(notificationWithItems);

  if (positions.length === 0) {
    console.error(`[PROCESSING] No mapped positions found: orderId="${externalNumber}"`);
    throw new Error('No mapped products found for order');
  }
  
  console.log(`[PROCESSING] Mapped positions: orderId="${externalNumber}", count=${positions.length}`);

  // Создаём Customer Order — резерв в МойСклад
  const co = await createCustomerOrder({
    externalNumber,
    storeId: STORE_ID,
    orgId: ORG_ID,
    positions,
    description: `Reserve for Yandex order ${externalNumber}`
  });

  console.log(`[PROCESSING] Customer Order created (reserve applied): orderId="${externalNumber}", entityId="${co.id || 'unknown'}"`);
  return { status: 200, message: 'reserved' };
}

// Handle PICKUP status - create Demand (shipment)
async function handlePickup(notification, externalNumber) {
  console.log(`[PICKUP] Processing order: orderId="${externalNumber}"`);
  
  // Check if Demand already exists (idempotency)
  try {
    const existingDemand = await findDemandByExternalNumber(externalNumber);
    if (existingDemand) {
      console.log(`[PICKUP] Demand already exists: orderId="${externalNumber}", skipping creation`);
      return { status: 200, message: 'already exists' };
    }
  } catch (err) {
    console.error(`[PICKUP] Error checking existing Demand: orderId="${externalNumber}", error="${err.message}"`);
    if (err.stack) console.error(err.stack);
  }
  
  // Восстанавливаем items из кэша
  const cachedItems = orderItemsCache.get(externalNumber);
  if (!cachedItems) {
    console.error(`[PICKUP] No cached items found: orderId="${externalNumber}"`);
    throw new Error('No cached items found for order');
  }
  
  // Создаём временный notification объект с items для маппинга
  const notificationWithItems = { ...notification, items: cachedItems };
  const positions = mapPositionsFromYandex(notificationWithItems);
  
  if (positions.length === 0) {
    console.error(`[PICKUP] No mapped positions found: orderId="${externalNumber}"`);
    throw new Error('No mapped products found for order');
  }
  
  console.log(`[PICKUP] Mapped positions: orderId="${externalNumber}", count=${positions.length}`);

  const demand = await createDemand({
    externalNumber,
    storeId: STORE_ID,
    orgId: ORG_ID,
    positions,
    description: `Shipment (demand) for Yandex order ${externalNumber}`
  });

  console.log(`[PICKUP] Demand created (товар списан): orderId="${externalNumber}", entityId="${demand.id || 'unknown'}"`);
  
  // Очищаем кэш после успешной отгрузки
  orderItemsCache.delete(externalNumber);
  console.log(`[PICKUP] Cleared items cache: orderId="${externalNumber}"`);
  
  return { status: 200, message: 'shipped' };
}

// Handle CANCELLED status - delete Customer Order (remove reserve)
async function handleCancelled(notification, externalNumber) {
  console.log(`[CANCELLED] Processing order: orderId="${externalNumber}"`);
  
  try {
    // Ищем существующий Customer Order
    const existingOrder = await findCustomerOrderByExternalNumber(externalNumber);
    
    if (!existingOrder) {
      console.log(`[CANCELLED] Customer Order not found: orderId="${externalNumber}", nothing to delete`);
      // Очищаем кэш на всякий случай
      orderItemsCache.delete(externalNumber);
      return { status: 200, message: 'not_found' };
    }
    
    // Удаляем Customer Order (резерв автоматически снимется)
    const deleteUrl = existingOrder.meta.href;
    await axios.delete(deleteUrl, { headers: getAuthHeaders() });
    
    console.log(`[CANCELLED] Customer Order deleted (reserve removed): orderId="${externalNumber}", entityId="${existingOrder.id}"`);
    
    // Очищаем кэш
    orderItemsCache.delete(externalNumber);
    console.log(`[CANCELLED] Cleared items cache: orderId="${externalNumber}"`);
    
    return { status: 200, message: 'deleted' };
    
  } catch (err) {
    console.error(`[CANCELLED] Error deleting Customer Order: orderId="${externalNumber}", error="${err.message}"`);
    if (err.stack) console.error(err.stack);
    throw err;
  }
}

// Helper function to get auth headers (needed for axios.delete in handleCancelled)
function getAuthHeaders() {
  const token = process.env.MOYSKLAD_PASSWORD;
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json;charset=utf-8',
    'Content-Type': 'application/json'
  };
}

app.post('/webhook', async (req, res) => {
  const startTime = new Date().toISOString();
  let notificationType = null;
  let orderId = null;
  
  try {
    // Validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      console.error('[WEBHOOK] Invalid request body: body is missing or not an object');
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const event = req.body;
    notificationType = event.notificationType;
    orderId = event.orderId;
    
    // Log webhook receipt
    console.log(`[WEBHOOK] Received notification: type="${notificationType}", orderId="${orderId || 'N/A'}"`);
    console.log(`[WEBHOOK] Full payload:`, JSON.stringify(event, null, 2));

    // Handle PING notification (проверка работоспособности)
    if (notificationType === 'PING') {
      console.log('[WEBHOOK] PING received - responding with integration info');
      return res.status(200).json({
        version: '1.0.0',
        name: 'Yandex-MoySklad Integration',
        time: startTime
      });
    }

    // Handle ORDER_CREATED event
    if (notificationType === 'ORDER_CREATED') {
      const externalNumber = `YM-${orderId}`;
      const result = await handleOrderCreated(event, externalNumber);
      
      // Яндекс требует ответ 200 OK с JSON
      return res.status(200).json({
        version: '1.0.0',
        name: 'Yandex-MoySklad Integration',
        time: startTime,
        status: 'processed',
        orderId: orderId
      });
    }

    // Handle ORDER_STATUS_UPDATED event
    if (notificationType === 'ORDER_STATUS_UPDATED') {
      const externalNumber = `YM-${orderId}`;
      const newStatus = event.status || event.newStatus;
      
      console.log(`[ORDER_STATUS_UPDATED] Processing order: orderId="${externalNumber}", newStatus="${newStatus}"`);

      // PROCESSING - создаём Customer Order (резерв)
      if (newStatus === 'PROCESSING') {
        await handleProcessing(event, externalNumber);
      }
      // PICKUP или DELIVERED - создаём Demand (отгрузка)
      // PICKUP = FBS самовывоз, DELIVERED = Экспресс доставка
      else if (newStatus === 'PICKUP' || newStatus === 'DELIVERED') {
        await handlePickup(event, externalNumber);
      }
      // CANCELLED - удаляем Customer Order (снимаем резерв)
      else if (newStatus === 'CANCELLED') {
        await handleCancelled(event, externalNumber);
      }
      else {
        console.log(`[ORDER_STATUS_UPDATED] Status ignored: orderId="${externalNumber}", status="${newStatus}"`);
      }

      return res.status(200).json({
        version: '1.0.0',
        name: 'Yandex-MoySklad Integration',
        time: startTime,
        status: 'processed',
        orderId: orderId
      });
    }

    // Прочие события — просто подтверждаем получение
    console.log(`[WEBHOOK] Event type not handled: type="${notificationType}"`);
    return res.status(200).json({
      version: '1.0.0',
      name: 'Yandex-MoySklad Integration',
      time: startTime,
      status: 'received'
    });
    
  } catch (err) {
    // Log error with full context
    console.error(`[WEBHOOK] System error: notificationType="${notificationType}", orderId="${orderId}", error="${err.message}"`);
    if (err.stack) console.error(err.stack);
    
    // Всё равно возвращаем 200, чтобы Яндекс не повторял запрос
    return res.status(200).json({
      version: '1.0.0',
      name: 'Yandex-MoySklad Integration',
      time: startTime,
      status: 'error',
      error: err.message
    });
  }
});

// Обработчик для GET запросов (для проверки что сервер работает)
app.get('/webhook', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Webhook endpoint is ready',
    version: '1.0.0'
  });
});

// Яндекс требует endpoint /notification для проверки интеграции
// GET endpoint для /notification (Яндекс проверяет доступность)
app.get('/notification', (req, res) => {
  console.log('[NOTIFICATION] GET request received from Yandex verification');
  res.status(200).json({
    version: '1.0.0',
    name: 'Yandex-MoySklad Integration',
    time: new Date().toISOString()
  });
});

// POST endpoint для /notification (основной endpoint для webhook от Яндекса)
app.post('/notification', async (req, res) => {
  const startTime = new Date().toISOString();
  let notificationType = null;
  let orderId = null;
  
  try {
    // Validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      console.error('[NOTIFICATION] Invalid request body: body is missing or not an object');
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const event = req.body;
    notificationType = event.notificationType;
    orderId = event.orderId;
    
    // Log webhook receipt
    console.log(`[NOTIFICATION] Received notification: type="${notificationType}", orderId="${orderId || 'N/A'}"`);
    console.log(`[NOTIFICATION] Full payload:`, JSON.stringify(event, null, 2));

    // Handle PING notification (проверка работоспособности)
    if (notificationType === 'PING') {
      console.log('[NOTIFICATION] PING received - responding with integration info');
      return res.status(200).json({
        version: '1.0.0',
        name: 'Yandex-MoySklad Integration',
        time: startTime
      });
    }

    // Handle ORDER_CREATED event
    if (notificationType === 'ORDER_CREATED') {
      const externalNumber = `YM-${orderId}`;
      const result = await handleOrderCreated(event, externalNumber);
      
      // Яндекс требует ответ 200 OK с JSON
      return res.status(200).json({
        version: '1.0.0',
        name: 'Yandex-MoySklad Integration',
        time: startTime,
        status: 'processed',
        orderId: orderId
      });
    }

    // Handle ORDER_STATUS_UPDATED event
    if (notificationType === 'ORDER_STATUS_UPDATED') {
      const externalNumber = `YM-${orderId}`;
      const newStatus = event.status || event.newStatus;
      
      console.log(`[NOTIFICATION] ORDER_STATUS_UPDATED: orderId="${externalNumber}", newStatus="${newStatus}"`);

      // PROCESSING - создаём Customer Order (резерв)
      if (newStatus === 'PROCESSING') {
        await handleProcessing(event, externalNumber);
      }
      // PICKUP или DELIVERED - создаём Demand (отгрузка)
      // PICKUP = FBS самовывоз, DELIVERED = Экспресс доставка
      else if (newStatus === 'PICKUP' || newStatus === 'DELIVERED') {
        await handlePickup(event, externalNumber);
      }
      // CANCELLED - удаляем Customer Order (снимаем резерв)
      else if (newStatus === 'CANCELLED') {
        await handleCancelled(event, externalNumber);
      }
      else {
        console.log(`[NOTIFICATION] Status ignored: orderId="${externalNumber}", status="${newStatus}"`);
      }

      return res.status(200).json({
        version: '1.0.0',
        name: 'Yandex-MoySklad Integration',
        time: startTime,
        status: 'processed',
        orderId: orderId
      });
    }

    // Прочие события — просто подтверждаем получение
    console.log(`[NOTIFICATION] Event type not handled: type="${notificationType}"`);
    return res.status(200).json({
      version: '1.0.0',
      name: 'Yandex-MoySklad Integration',
      time: startTime,
      status: 'received'
    });
    
  } catch (err) {
    // Log error with full context
    console.error(`[NOTIFICATION] System error: notificationType="${notificationType}", orderId="${orderId}", error="${err.message}"`);
    if (err.stack) console.error(err.stack);
    
    // Всё равно возвращаем 200, чтобы Яндекс не повторял запрос
    return res.status(200).json({
      version: '1.0.0',
      name: 'Yandex-MoySklad Integration',
      time: startTime,
      status: 'error',
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
