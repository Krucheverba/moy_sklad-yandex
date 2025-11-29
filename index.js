// index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
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

// Handle ORDER_CREATED event - create Customer Order (reservation)
async function handleOrderCreated(notification, externalNumber) {
  console.log(`[ORDER_CREATED] Processing order: orderId="${externalNumber}"`);
  console.log(`[ORDER_CREATED] Campaign ID: ${notification.campaignId}, Created at: ${notification.createdAt}`);
  
  // Check if Customer Order already exists (idempotency)
  try {
    const existingOrder = await findCustomerOrderByExternalNumber(externalNumber);
    if (existingOrder) {
      console.log(`[ORDER_CREATED] Customer Order already exists: orderId="${externalNumber}", skipping creation`);
      return { status: 200, message: 'already exists' };
    }
  } catch (err) {
    console.error(`[ORDER_CREATED] Error checking existing Customer Order: orderId="${externalNumber}", error="${err.message}"`);
    if (err.stack) console.error(err.stack);
  }
  
  const positions = mapPositionsFromYandex(notification);

  if (positions.length === 0) {
    console.error(`[ORDER_CREATED] No mapped positions found: orderId="${externalNumber}"`);
    throw new Error('No mapped products found for order');
  }
  
  console.log(`[ORDER_CREATED] Mapped positions: orderId="${externalNumber}", count=${positions.length}`);

  // Создаём customerorder — резерв в МойСклад
  const co = await createCustomerOrder({
    externalNumber,
    storeId: STORE_ID,
    orgId: ORG_ID,
    positions,
    description: `Reserve for Yandex order ${externalNumber}`
  });

  console.log(`[ORDER_CREATED] Success: orderId="${externalNumber}", entityId="${co.id || 'unknown'}"`);
  return { status: 200, message: 'reserved' };
}

// Handle label print event - create Demand (shipment)
async function handleLabelPrint(notification, externalNumber) {
  console.log(`[LABEL_PRINT] Processing order: orderId="${externalNumber}"`);
  
  // Check if Demand already exists (idempotency)
  try {
    const existingDemand = await findDemandByExternalNumber(externalNumber);
    if (existingDemand) {
      console.log(`[LABEL_PRINT] Demand already exists: orderId="${externalNumber}", skipping creation`);
      return { status: 200, message: 'already exists' };
    }
  } catch (err) {
    console.error(`[LABEL_PRINT] Error checking existing Demand: orderId="${externalNumber}", error="${err.message}"`);
    if (err.stack) console.error(err.stack);
  }
  
  const positions = mapPositionsFromYandex(notification);
  
  if (positions.length === 0) {
    console.error(`[LABEL_PRINT] No mapped positions found: orderId="${externalNumber}"`);
    throw new Error('No mapped products found for order');
  }
  
  console.log(`[LABEL_PRINT] Mapped positions: orderId="${externalNumber}", count=${positions.length}`);

  const demand = await createDemand({
    externalNumber,
    storeId: STORE_ID,
    orgId: ORG_ID,
    positions,
    description: `Shipment (demand) for Yandex order ${externalNumber}`
  });

  console.log(`[LABEL_PRINT] Success: orderId="${externalNumber}", entityId="${demand.id || 'unknown'}"`);
  return { status: 200, message: 'shipped' };
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

      // Статусы, которые триггерят создание Отгрузки
      const triggerStatuses = ['READY_TO_SHIP', 'DELIVERY', 'PROCESSING'];

      if (triggerStatuses.includes(newStatus)) {
        const result = await handleLabelPrint(event, externalNumber);
      } else {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
