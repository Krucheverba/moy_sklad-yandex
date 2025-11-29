// test-y0-token.js - Тест токена с префиксом y0_
const axios = require('axios');

const Y0_TOKEN = 'y0__xD7rP4QGLnnOyDcwMmqFTCgt7WvCFs2LDY15Oscyxl-kl6RkB3o58QH';
const CAMPAIGN_ID = '128441417';

console.log('=== Тестирование токена y0_ ===\n');
console.log(`Токен: ${Y0_TOKEN.substring(0, 30)}...`);
console.log(`Campaign ID: ${CAMPAIGN_ID}\n`);

async function testAuth(authHeader, description) {
  console.log(`📝 ${description}`);
  console.log(`   Authorization: ${authHeader.substring(0, 40)}...`);
  
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
        console.log(`     - ID: ${c.id}`);
      });
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

async function testOffers(authHeader) {
  console.log(`\n📝 Тест: Получение товаров`);
  
  try {
    const res = await axios.post(
      `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}/offer-mapping-entries/suggestions`,
      { offerIds: [] },
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
      console.log('   Первые 5 товаров:');
      res.data.result.offerMappingEntries.slice(0, 5).forEach(offer => {
        console.log(`     - SKU: ${offer.offer?.offerId || 'N/A'}, Название: ${offer.offer?.name?.substring(0, 40) || 'N/A'}`);
      });
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
  
  // Тест 1: Bearer (стандарт для OAuth 2.0)
  tests.push(await testAuth(`Bearer ${Y0_TOKEN}`, 'Тест 1: Bearer y0_token'));
  
  // Тест 2: OAuth (старый формат Яндекса)
  tests.push(await testAuth(`OAuth ${Y0_TOKEN}`, 'Тест 2: OAuth y0_token'));
  
  // Тест 3: Без префикса
  tests.push(await testAuth(Y0_TOKEN, 'Тест 3: Без префикса'));
  
  console.log('\n' + '='.repeat(60));
  console.log('РЕЗУЛЬТАТЫ:');
  console.log('='.repeat(60));
  
  const successCount = tests.filter(t => t).length;
  console.log(`Успешных тестов: ${successCount} из ${tests.length}\n`);
  
  if (successCount > 0) {
    // Находим рабочий формат
    let workingAuth = null;
    if (tests[0]) workingAuth = `Bearer ${Y0_TOKEN}`;
    else if (tests[1]) workingAuth = `OAuth ${Y0_TOKEN}`;
    else if (tests[2]) workingAuth = Y0_TOKEN;
    
    if (workingAuth) {
      await testOffers(workingAuth);
      
      console.log('\n🎉 ТОКЕН РАБОТАЕТ!');
      console.log('\n📝 Теперь можно:');
      console.log('1. Запустить генерацию маппинга: node generate-mapping.js');
      console.log('2. Проверить mapping.json');
      console.log('3. Запустить webhook сервер: node index.js');
    }
  } else {
    console.log('❌ Токен y0_ тоже не работает');
    console.log('\n💡 Этот токен может быть:');
    console.log('1. Токеном для другого сервиса Яндекса (не Market)');
    console.log('2. Истёкшим токеном');
    console.log('3. Токеном без прав на Partner API');
    console.log('\n📝 Где вы нашли этот токен?');
  }
}

runTests();
