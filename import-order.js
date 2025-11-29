// import-order.js - Ручной импорт заказа из Яндекс.Маркет в МойСклад
require('dotenv').config();
const { createCustomerOrder } = require('./moysklad');
const mapping = require('./mapping.json');

const STORE_ID = process.env.STORE_ID;
const ORG_ID = process.env.ORG_ID;

// Функция для маппинга товаров
function mapPositions(items) {
  const positions = [];
  const unmapped = [];
  
  for (const item of items) {
    const sku = item.offerId || item.sku;
    const quantity = item.count || item.quantity || 1;
    const productId = mapping[sku];
    
    if (productId) {
      positions.push({ productId, quantity });
      console.log(`  ✓ ${sku} -> ${quantity} шт.`);
    } else {
      unmapped.push(sku);
      console.log(`  ✗ ${sku} - НЕ НАЙДЕН в маппинге!`);
    }
  }
  
  if (unmapped.length > 0) {
    console.log(`\n⚠️ Незамапленные SKU: ${unmapped.join(', ')}`);
  }
  
  return positions;
}

// Функция импорта заказа
async function importOrder(orderId, items) {
  console.log(`\n=== Импорт заказа ${orderId} ===`);
  console.log('Товары:');
  
  const positions = mapPositions(items);
  
  if (positions.length === 0) {
    console.log('❌ Нет замапленных товаров для импорта!');
    return;
  }
  
  try {
    console.log(`\nСоздание Заказа покупателя в МойСклад...`);
    const result = await createCustomerOrder({
      externalNumber: orderId,
      storeId: STORE_ID,
      orgId: ORG_ID,
      positions,
      description: `Заказ из Яндекс.Маркет FBS #${orderId}`
    });
    
    console.log(`✅ Заказ создан в МойСклад!`);
    console.log(`   ID: ${result.id}`);
    console.log(`   Ссылка: https://online.moysklad.ru/app/#customerorder/edit?id=${result.id}`);
  } catch (err) {
    console.error(`❌ Ошибка создания заказа: ${err.message}`);
  }
}

// Пример использования:
// Замените данные на реальные из ваших заказов Яндекс.Маркет

const order1 = {
  id: 'YANDEX-ORDER-1',  // Замените на реальный номер заказа
  items: [
    { offerId: '1-IxiodciXeIaS5RgRrkC1', count: 2 },  // Замените на реальные SKU
    // Добавьте другие товары из заказа
  ]
};

const order2 = {
  id: 'YANDEX-ORDER-2',  // Замените на реальный номер заказа
  items: [
    { offerId: 'rKNiggKniacGxq8p9fyQi0', count: 1 },  // Замените на реальные SKU
  ]
};

// Запуск импорта
async function main() {
  console.log('🚀 Импорт заказов из Яндекс.Маркет в МойСклад\n');
  
  // Раскомментируйте и заполните данными ваших заказов:
  // await importOrder(order1.id, order1.items);
  // await importOrder(order2.id, order2.items);
  
  console.log('\n💡 Инструкция:');
  console.log('1. Откройте этот файл (import-order.js)');
  console.log('2. Замените order1 и order2 на данные ваших реальных заказов');
  console.log('3. Раскомментируйте строки с await importOrder(...)');
  console.log('4. Запустите: node import-order.js');
}

main();
