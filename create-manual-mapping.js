// create-manual-mapping.js - Создание маппинга вручную без API Яндекс.Маркет
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const MOYSKLAD_BASE = process.env.MOYSKLAD_BASE;
const MOYSKLAD_LOGIN = process.env.MOYSKLAD_LOGIN;
const MOYSKLAD_PASSWORD = process.env.MOYSKLAD_PASSWORD;

console.log('=== Создание маппинга товаров (ручной режим) ===\n');
console.log('Этот скрипт создаст маппинг на основе externalCode в МойСклад');
console.log('externalCode должен совпадать с SKU (offerId) из Яндекс.Маркет\n');

async function getMoySkladProducts() {
  console.log('📦 Получение товаров из МойСклад...');
  
  try {
    const auth = Buffer.from(`${MOYSKLAD_LOGIN}:${MOYSKLAD_PASSWORD}`).toString('base64');
    
    let allProducts = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    
    while (hasMore) {
      const res = await axios.get(`${MOYSKLAD_BASE}/entity/product`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        },
        params: {
          limit: limit,
          offset: offset
        }
      });
      
      const products = res.data.rows || [];
      allProducts = allProducts.concat(products);
      
      console.log(`   Получено: ${allProducts.length} товаров...`);
      
      hasMore = products.length === limit;
      offset += limit;
    }
    
    console.log(`✅ Всего товаров в МойСклад: ${allProducts.length}\n`);
    return allProducts;
    
  } catch (err) {
    console.error('❌ Ошибка при получении товаров из МойСклад:', err.message);
    if (err.response) {
      console.error('Статус:', err.response.status);
      console.error('Ответ:', err.response.data);
    }
    throw err;
  }
}

function createMapping(products) {
  console.log('🔗 Создание маппинга...\n');
  
  const mapping = {};
  let mappedCount = 0;
  let unmappedCount = 0;
  
  products.forEach(product => {
    const externalCode = product.externalCode;
    const productId = product.id;
    const name = product.name;
    
    if (externalCode && externalCode.trim() !== '') {
      mapping[externalCode] = productId;
      mappedCount++;
      console.log(`✅ ${externalCode} → ${productId.substring(0, 8)}... (${name})`);
    } else {
      unmappedCount++;
      console.log(`⚠️  Товар без externalCode: ${name} (ID: ${productId.substring(0, 8)}...)`);
    }
  });
  
  console.log(`\n📊 Статистика:`);
  console.log(`   Замаплено: ${mappedCount} товаров`);
  console.log(`   Без externalCode: ${unmappedCount} товаров`);
  
  return mapping;
}

function saveMapping(mapping) {
  console.log('\n💾 Сохранение маппинга в mapping.json...');
  
  try {
    fs.writeFileSync('mapping.json', JSON.stringify(mapping, null, 2), 'utf8');
    console.log('✅ Маппинг сохранён в mapping.json');
    console.log(`   Записей в маппинге: ${Object.keys(mapping).length}`);
  } catch (err) {
    console.error('❌ Ошибка при сохранении маппинга:', err.message);
    throw err;
  }
}

async function main() {
  try {
    const products = await getMoySkladProducts();
    const mapping = createMapping(products);
    saveMapping(mapping);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ГОТОВО!');
    console.log('='.repeat(60));
    console.log('\n📝 Следующие шаги:');
    console.log('1. Убедитесь, что externalCode в МойСклад совпадает с SKU из Яндекс.Маркет');
    console.log('2. Если нужно, обновите externalCode в МойСклад');
    console.log('3. Запустите этот скрипт снова для обновления маппинга');
    console.log('4. Протестируйте webhook с реальным заказом');
    
    console.log('\n💡 Как обновить externalCode в МойСклад:');
    console.log('1. Откройте товар в МойСклад');
    console.log('2. В поле "Код" или "Артикул" укажите SKU из Яндекс.Маркет');
    console.log('3. Сохраните изменения');
    
  } catch (err) {
    console.error('\n❌ Ошибка:', err.message);
    process.exit(1);
  }
}

main();
