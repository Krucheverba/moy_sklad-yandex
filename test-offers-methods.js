// test-offers-methods.js - Тест различных методов получения товаров
require('dotenv').config();
const axios = require('axios');

const TOKEN = process.env.YANDEX_TOKEN;
const CAMPAIGN_ID = process.env.YANDEX_CAMPAIGN_ID;

console.log('=== Тестирование методов получения товаров ===\n');
console.log(`Campaign ID: ${CAMPAIGN_ID}\n`);

async function testMethod(url, method, data, description) {
  console.log(`📝 ${description}`);
  console.log(`   ${method} ${url}`);
  
  try {
    const config = {
      method: method,
      url: url,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const res = await axios(config);
    
    console.log('   ✅ УСПЕХ!');
    console.log(`   Статус: ${res.status}`);
    
    // Показываем структуру ответа
    if (res.data.result) {
      console.log(`   Структура: result.${Object.keys(res.data.result).join(', result.')}`);
      
      // Пробуем найти товары
      const offers = res.data.result.offerMappings || 
                     res.data.result.offerMappingEntries ||
                     res.data.result.offers ||
                     res.data.result.skus ||
                     res.data.result;
      
      if (Array.isArray(offers) && offers.length > 0) {
        console.log(`   Товаров: ${offers.length}`);
        console.log('   Первые 3 товара:');
        offers.slice(0, 3).forEach(offer => {
          const sku = offer.offer?.offerId || offer.offer?.shopSku || offer.shopSku || offer.offerId || 'N/A';
          const name = offer.offer?.name || offer.name || 'N/A';
          console.log(`     - SKU: ${sku}, Название: ${name.substring(0, 40)}`);
        });
      }
    } else if (res.data.offers) {
      console.log(`   Товаров: ${res.data.offers.length}`);
    } else if (res.data.paging) {
      console.log(`   Пагинация: total=${res.data.paging.total}`);
    }
    
    return true;
  } catch (err) {
    console.log(`   ❌ Ошибка: ${err.response?.status || err.message}`);
    if (err.response?.data?.errors) {
      console.log(`   ${err.response.data.errors[0]?.message}`);
    }
    return false;
  }
}

async function runTests() {
  const tests = [];
  
  // Метод 1: GET /campaigns/{id}/offers
  tests.push(await testMethod(
    `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}/offers`,
    'GET',
    null,
    'Метод 1: GET /campaigns/{id}/offers'
  ));
  
  // Метод 2: POST /campaigns/{id}/offers
  tests.push(await testMethod(
    `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}/offers`,
    'POST',
    { page_token: '', limit: 100 },
    'Метод 2: POST /campaigns/{id}/offers'
  ));
  
  // Метод 3: GET /campaigns/{id}/offer-mapping-entries
  tests.push(await testMethod(
    `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}/offer-mapping-entries`,
    'GET',
    null,
    'Метод 3: GET /campaigns/{id}/offer-mapping-entries'
  ));
  
  // Метод 4: POST /campaigns/{id}/offer-mappings
  tests.push(await testMethod(
    `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}/offer-mappings`,
    'POST',
    { offerIds: [] },
    'Метод 4: POST /campaigns/{id}/offer-mappings'
  ));
  
  // Метод 5: GET /campaigns/{id}/stats/skus
  tests.push(await testMethod(
    `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}/stats/skus`,
    'GET',
    null,
    'Метод 5: GET /campaigns/{id}/stats/skus'
  ));
  
  // Метод 6: POST /campaigns/{id}/stats/skus
  tests.push(await testMethod(
    `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}/stats/skus`,
    'POST',
    { shopSkus: [] },
    'Метод 6: POST /campaigns/{id}/stats/skus'
  ));
  
  // Метод 7: GET /campaigns/{id}/offer-cards
  tests.push(await testMethod(
    `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}/offer-cards`,
    'GET',
    null,
    'Метод 7: GET /campaigns/{id}/offer-cards'
  ));
  
  console.log('\n' + '='.repeat(70));
  console.log('ИТОГОВЫЕ РЕЗУЛЬТАТЫ:');
  console.log('='.repeat(70));
  
  const successCount = tests.filter(t => t).length;
  console.log(`\nУспешных методов: ${successCount} из ${tests.length}\n`);
  
  if (successCount > 0) {
    console.log('✅ Найдены рабочие методы для получения товаров!');
    console.log('\n📝 Следующий шаг: обновить generate-mapping.js для использования рабочего метода');
  } else {
    console.log('❌ Ни один метод не работает');
    console.log('\n💡 Возможно, нужно использовать Business API вместо Campaign API');
  }
}

runTests();
