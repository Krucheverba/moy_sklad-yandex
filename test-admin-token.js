// test-admin-token.js - Тест токена администратора
const axios = require('axios');

// Токен администратора из Я.Продавец
const ADMIN_TOKEN = 'ACMA:WCSq2NS4Xil0luGi8eNhXlBLWcLPrug2D7YfcbEx:f6f02b98';
const CAMPAIGN_ID = '128441417';

console.log('=== Тестирование токена администратора ===\n');
console.log(`Токен: ${ADMIN_TOKEN.substring(0, 30)}...`);
console.log(`Campaign ID: ${CAMPAIGN_ID}\n`);

// Извлекаем части токена
const parts = ADMIN_TOKEN.split(':');
const clientId = parts[1];
const clientSecret = parts[2];

console.log(`Client ID: ${clientId.substring(0, 20)}...`);
console.log(`Client Secret: ${clientSecret}\n`);

async function testFormat(authHeader, description) {
  console.log(`📝 Тест: ${description}`);
  
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
      console.log(`   Сообщение: ${err.response.data.errors[0]?.message}`);
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
        console.log(`     - SKU: ${offer.offer?.offerId || 'N/A'}`);
      });
    }
    
    return true;
  } catch (err) {
    console.log(`   ❌ Ошибка: ${err.response?.status || err.message}`);
    if (err.response?.data?.errors) {
      console.log(`   Сообщение: ${err.response.data.errors[0]?.message}`);
    }
    return false;
  }
}

async function runTests() {
  const tests = [];
  
  // Тест 1: OAuth с полным токеном
  tests.push(await testFormat(`OAuth ${ADMIN_TOKEN}`, 'OAuth с полным ACMA токеном'));
  
  // Тест 2: OAuth только с client_id
  tests.push(await testFormat(`OAuth ${clientId}`, 'OAuth только с client_id'));
  
  // Тест 3: OAuth с client_id:client_secret
  tests.push(await testFormat(`OAuth ${clientId}:${clientSecret}`, 'OAuth с client_id:client_secret'));
  
  // Тест 4: Bearer с полным токеном
  tests.push(await testFormat(`Bearer ${ADMIN_TOKEN}`, 'Bearer с полным ACMA токеном'));
  
  // Тест 5: Basic Auth
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  tests.push(await testFormat(`Basic ${basicAuth}`, 'Basic Auth'));
  
  console.log('\n' + '='.repeat(60));
  console.log('РЕЗУЛЬТАТЫ:');
  console.log('='.repeat(60));
  
  const successCount = tests.filter(t => t).length;
  console.log(`Успешных тестов: ${successCount} из ${tests.length}\n`);
  
  if (successCount > 0) {
    // Находим рабочий формат
    let workingAuth = null;
    if (tests[0]) workingAuth = `OAuth ${ADMIN_TOKEN}`;
    else if (tests[1]) workingAuth = `OAuth ${clientId}`;
    else if (tests[2]) workingAuth = `OAuth ${clientId}:${clientSecret}`;
    else if (tests[3]) workingAuth = `Bearer ${ADMIN_TOKEN}`;
    else if (tests[4]) workingAuth = `Basic ${basicAuth}`;
    
    if (workingAuth) {
      await testOffers(workingAuth);
      
      console.log('\n✅ ТОКЕН АДМИНИСТРАТОРА РАБОТАЕТ!');
      console.log('\n📝 Теперь можно:');
      console.log('1. Запустить генерацию маппинга: node generate-mapping.js');
      console.log('2. Проверить mapping.json');
      console.log('3. Запустить webhook сервер: node index.js');
    }
  } else {
    console.log('❌ Токен администратора тоже не работает!');
    console.log('\n💡 Возможные причины:');
    console.log('1. Токен создан не для Partner API');
    console.log('2. Токен истёк');
    console.log('3. У токена нет нужных прав');
    console.log('\n📝 Попробуйте создать токен заново в разделе API');
  }
}

runTests();
