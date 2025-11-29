// test-acma-token.js - Тест токена формата ACMA
const axios = require('axios');

// Токен из личного кабинета Яндекс.Маркет
const ACMA_TOKEN = 'ACMA:MvULdPS7nuzGqd7a3R1ZXciYxpH8kMFcIJpmlzAM:7e8d65cf';
const CAMPAIGN_ID = '128441417';

console.log('=== Тестирование токена ACMA формата ===\n');
console.log(`Токен: ${ACMA_TOKEN.substring(0, 30)}...`);
console.log(`Campaign ID: ${CAMPAIGN_ID}\n`);

async function testFormat(authHeader, description) {
  console.log(`\n📝 Тест: ${description}`);
  console.log(`   Authorization: ${authHeader.substring(0, 50)}...`);
  
  try {
    const res = await axios.get('https://api.partner.market.yandex.ru/campaigns', {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });
    
    console.log('   ✅ УСПЕХ!');
    console.log(`   Статус: ${res.status}`);
    console.log(`   Кампаний: ${res.data.campaigns?.length || 0}`);
    
    if (res.data.campaigns && res.data.campaigns.length > 0) {
      console.log('   Кампании:');
      res.data.campaigns.forEach(c => {
        console.log(`     - ID: ${c.id}, Тип: ${c.business || c.domain || 'N/A'}`);
      });
    }
    
    return true;
  } catch (err) {
    console.log(`   ❌ Ошибка: ${err.response?.status || err.message}`);
    if (err.response?.data) {
      const errorMsg = err.response.data.errors?.[0]?.message || JSON.stringify(err.response.data);
      console.log(`   Сообщение: ${errorMsg}`);
    }
    return false;
  }
}

async function testOffers(authHeader) {
  console.log(`\n📝 Тест: Получение товаров`);
  
  try {
    const res = await axios.post(
      `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}/offer-mapping-entries/suggestions`,
      {
        offerIds: []
      },
      {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('   ✅ УСПЕХ!');
    console.log(`   Товаров: ${res.data.result?.offerMappingEntries?.length || 0}`);
    
    if (res.data.result?.offerMappingEntries?.length > 0) {
      console.log('   Первые 3 товара:');
      res.data.result.offerMappingEntries.slice(0, 3).forEach(offer => {
        console.log(`     - SKU: ${offer.offer?.offerId || 'N/A'}, Название: ${offer.offer?.name || 'N/A'}`);
      });
    }
    
    return true;
  } catch (err) {
    console.log(`   ❌ Ошибка: ${err.response?.status || err.message}`);
    if (err.response?.data) {
      const errorMsg = err.response.data.errors?.[0]?.message || JSON.stringify(err.response.data);
      console.log(`   Сообщение: ${errorMsg}`);
    }
    return false;
  }
}

async function runTests() {
  // Тест 1: OAuth с полным токеном ACMA
  const test1 = await testFormat(`OAuth ${ACMA_TOKEN}`, 'OAuth с полным ACMA токеном');
  
  // Тест 2: Bearer с полным токеном ACMA
  const test2 = await testFormat(`Bearer ${ACMA_TOKEN}`, 'Bearer с полным ACMA токеном');
  
  // Тест 3: Без префикса
  const test3 = await testFormat(ACMA_TOKEN, 'Без префикса (только ACMA токен)');
  
  // Извлекаем части токена
  const parts = ACMA_TOKEN.split(':');
  const clientId = parts[1];
  const clientSecret = parts[2];
  
  // Тест 4: OAuth только с client_id
  const test4 = await testFormat(`OAuth ${clientId}`, 'OAuth только с client_id (средняя часть)');
  
  // Тест 5: OAuth с client_id:client_secret (без ACMA)
  const test5 = await testFormat(`OAuth ${clientId}:${clientSecret}`, 'OAuth с client_id:client_secret');
  
  console.log('\n' + '='.repeat(60));
  console.log('РЕЗУЛЬТАТЫ:');
  console.log('='.repeat(60));
  
  const tests = [test1, test2, test3, test4, test5];
  const successCount = tests.filter(t => t).length;
  console.log(`Успешных тестов: ${successCount} из ${tests.length}`);
  
  // Если хотя бы один тест прошёл, пробуем получить товары
  if (successCount > 0) {
    const workingAuth = test1 ? `OAuth ${ACMA_TOKEN}` : 
                        test2 ? `Bearer ${ACMA_TOKEN}` :
                        test3 ? ACMA_TOKEN :
                        test4 ? `OAuth ${clientId}` :
                        `OAuth ${clientId}:${clientSecret}`;
    
    await testOffers(workingAuth);
    
    console.log('\n✅ ТОКЕН РАБОТАЕТ!');
    console.log('\n📝 Обновите .env файл:');
    console.log(`YANDEX_TOKEN=${ACMA_TOKEN}`);
  } else {
    console.log('\n❌ Ни один формат не сработал!');
  }
}

runTests();
