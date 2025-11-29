// poll-orders.js - Периодический опрос новых заказов из Яндекс.Маркет
require('dotenv').config();
const axios = require('axios');
const { createCustomerOrder, findCustomerOrderByExternalNumber } = require('./moysklad');
const mapping = require('./mapping.json');

const YANDEX_TOKEN = process.env.YANDEX_TOKEN;
const YANDEX_CAMPAIGN_ID = process.env.YANDEX_CAMPAIGN_ID;
const STORE_ID = process.env.STORE_ID;
const ORG_ID = process.env.ORG_ID;

// Получить новые заказы из Яндекс.Маркет
async function getNewOrders() {
  try {
    // API для получения заказов (FBS)
    const url = `https://api.partner.market.yandex.ru/campaigns/${YANDEX_CAMPAIGN_ID}/orders`;
    
    const res = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${YANDEX_TOKEN}`,
        'Accept': 'application/json'
      },
      params: {
        status: 'PROCESSING',  // Новые заказы в обработке
        limit: 50
      }
    });
    
    return res.data.orders || [];
  } catch (err) {
    console.error('❌ Ошибка получения заказов:', err.message);
    if (err.response) {
      console.error('Статус:', err.response.status);
      console.error('Ответ:', JSON.stringify(err.response.data, null, 2));
    }
    return [];
  }
}

// Обработать заказ
async function processOrder(order) {
  const orderId = order.id;
  console.log(`\n📦 Заказ ${orderId}`);
  
  // Проверить, не создан ли уже
  try {
    const existing = await findCustomerOrderByExternalNumber(orderId);
    if (existing) {
      console.log(`  ⏭️  Уже создан в МойСклад, пропускаем`);
      return;
    }
  } catch (err) {
    console.log(`  ⚠️  Ошибка проверки: ${err.message}`);
  }
  
  // Маппинг товаров
  const positions = [];
  const unmapped = [];
  
  for (const item of order.items || []) {
    const sku = item.offerId || item.shopSku;
    const quantity = item.count || 1;
    const productId = mapping[sku];
    
    if (productId) {
      positions.push({ productId, quantity });
      console.log(`  ✓ ${sku}: ${quantity} шт`);
    } else {
      unmapped.push(sku);
      console.log(`  ✗ ${sku}: НЕ НАЙДЕН`);
    }
  }
  
  if (positions.length === 0) {
    console.log(`  ❌ Нет замапленных товаров`);
    return;
  }
  
  // Создать заказ в МойСклад
  try {
    const result = await createCustomerOrder({
      externalNumber: orderId,
      storeId: STORE_ID,
      orgId: ORG_ID,
      positions,
      description: `Заказ из Яндекс.Маркет FBS #${orderId}`
    });
    
    console.log(`  ✅ Создан в МойСклад: ${result.id}`);
  } catch (err) {
    console.log(`  ❌ Ошибка создания: ${err.message}`);
  }
}

// Основная функция
async function main() {
  console.log('🔄 Проверка новых заказов из Яндекс.Маркет...\n');
  
  const orders = await getNewOrders();
  console.log(`Найдено заказов: ${orders.length}`);
  
  for (const order of orders) {
    await processOrder(order);
  }
  
  console.log('\n✅ Готово!');
}

main();
