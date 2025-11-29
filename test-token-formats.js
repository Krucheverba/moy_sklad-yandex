// test-token-formats.js - Тестирование различных форматов авторизации
require('dotenv').config();
const axios = require('axios');

const YANDEX_TOKEN = process.env.YANDEX_TOKEN;
const YANDEX_CAMPAIGN_ID = process.env.YANDEX_CAMPAIGN_ID;

console.log('=== Тестирование различных форматов токена ===\n');
console.log(`Токен: ${YANDEX_TOKEN.substring(0, 20)}...`);
console.log(`Campaign ID: ${YANDEX_CAMPAIGN_ID}\n`);

// Разделяем токен на части (если есть двоеточие)
const [clientId, clientSecret] = YANDEX_TOKEN.split(':');

async function testFormat(config, description) {
  console.log(`\n📝 Тест: ${description}`);
  console.log(`   URL: https://api.partner.market.yandex.ru/campaigns`);
  
  try {
    const res = await axios.get('https://api.partner.market.yandex.ru/campaigns', config);
    
    console.log('   ✅ УСПЕХ!');
    console.log(`   Статус: ${res.status}`);
    console.log(`   Кампаний: ${res.data.campaigns?.length || 0}`);
    
    if (res.data.campaigns && res.data.campaigns.length > 0) {
      console.log('   Первая кампания:', res.data.campaigns[0].id);
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
  const tests = [];
  
  // Тест 1: OAuth с полным токеном
  tests.push(await testFormat({
    headers: {
      'Authorization': `OAuth ${YANDEX_TOKEN}`,
      'Accept': 'application/json'
    }
  }, 'OAuth с полным токеном (client_id:client_secret)'));
  
  // Тест 2: OAuth только с client_id
  if (clientId && clientSecret) {
    tests.push(await testFormat({
      headers: {
        'Authorization': `OAuth ${clientId}`,
        'Accept': 'application/json'
      }
    }, 'OAuth только с client_id (первая часть до двоеточия)'));
  }
  
  // Тест 3: Bearer с полным токеном
  tests.push(await testFormat({
    headers: {
      'Authorization': `Bearer ${YANDEX_TOKEN}`,
      'Accept': 'application/json'
    }
  }, 'Bearer с полным токеном'));
  
  // Тест 4: Bearer только с client_id
  if (clientId && clientSecret) {
    tests.push(await testFormat({
      headers: {
        'Authorization': `Bearer ${clientId}`,
        'Accept': 'application/json'
      }
    }, 'Bearer только с client_id'));
  }
  
  // Тест 5: Basic Auth (client_id:client_secret в base64)
  if (clientId && clientSecret) {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    tests.push(await testFormat({
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Accept': 'application/json'
      }
    }, 'Basic Auth (client_id:client_secret в base64)'));
  }
  
  // Тест 6: Без префикса
  tests.push(await testFormat({
    headers: {
      'Authorization': YANDEX_TOKEN,
      'Accept': 'application/json'
    }
  }, 'Без префикса (только токен)'));
  
  // Тест 7: В query параметре
  tests.push(await testFormat({
    params: {
      'oauth_token': YANDEX_TOKEN
    },
    headers: {
      'Accept': 'application/json'
    }
  }, 'В query параметре oauth_token'));
  
  // Тест 8: В query параметре (только client_id)
  if (clientId && clientSecret) {
    tests.push(await testFormat({
      params: {
        'oauth_token': clientId
      },
      headers: {
        'Accept': 'application/json'
      }
    }, 'В query параметре oauth_token (только client_id)'));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('РЕЗУЛЬТАТЫ:');
  console.log('='.repeat(60));
  
  const successCount = tests.filter(t => t).length;
  console.log(`Успешных тестов: ${successCount} из ${tests.length}`);
  
  if (successCount === 0) {
    console.log('\n❌ Ни один формат не сработал!');
    console.log('\n💡 Рекомендации:');
    console.log('1. Проверьте, что токен действительно валидный');
    console.log('2. Получите новый OAuth токен через личный кабинет Яндекс.Маркет');
    console.log('3. Прочитайте инструкцию в файле YANDEX_TOKEN_GUIDE.md');
    console.log('\n📖 Документация: https://yandex.ru/dev/market/partner-api/doc/dg/concepts/authorization.html');
  }
}

runTests();
