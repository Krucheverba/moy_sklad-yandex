// diagnose-yandex-token.js - Диагностика токена Яндекс.Маркет
require('dotenv').config();
const axios = require('axios');

const YANDEX_TOKEN = process.env.YANDEX_TOKEN;
const YANDEX_CAMPAIGN_ID = process.env.YANDEX_CAMPAIGN_ID;

console.log('=== Диагностика токена Яндекс.Маркет ===\n');

// Проверка формата токена
console.log('1. Проверка формата токена:');
console.log(`   Длина токена: ${YANDEX_TOKEN.length} символов`);
console.log(`   Первые 20 символов: ${YANDEX_TOKEN.substring(0, 20)}...`);
console.log(`   Содержит двоеточие: ${YANDEX_TOKEN.includes(':') ? 'ДА ⚠️' : 'НЕТ ✅'}`);

if (YANDEX_TOKEN.includes(':')) {
  console.log('\n   ⚠️  ПРОБЛЕМА: Токен содержит двоеточие!');
  console.log('   Это похоже на client_id:client_secret, а не на OAuth токен.');
  console.log('   OAuth токен должен быть одной строкой без двоеточия.\n');
}

// Тест 1: Получение списка кампаний (базовый эндпоинт)
async function testCampaigns() {
  console.log('\n2. Тест: Получение списка кампаний');
  console.log('   Endpoint: GET /campaigns');
  
  try {
    const res = await axios.get('https://api.partner.market.yandex.ru/campaigns', {
      headers: {
        'Authorization': `OAuth ${YANDEX_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('   ✅ УСПЕХ! Токен работает!');
    console.log(`   Найдено кампаний: ${res.data.campaigns?.length || 0}`);
    return true;
  } catch (err) {
    console.log(`   ❌ ОШИБКА: ${err.response?.status || err.message}`);
    if (err.response?.data) {
      console.log('   Ответ API:', JSON.stringify(err.response.data, null, 2));
    }
    return false;
  }
}

// Тест 2: Получение информации о кампании
async function testCampaignInfo() {
  if (!YANDEX_CAMPAIGN_ID) {
    console.log('\n3. Тест пропущен: YANDEX_CAMPAIGN_ID не указан');
    return false;
  }
  
  console.log(`\n3. Тест: Получение информации о кампании ${YANDEX_CAMPAIGN_ID}`);
  console.log(`   Endpoint: GET /campaigns/${YANDEX_CAMPAIGN_ID}`);
  
  try {
    const res = await axios.get(
      `https://api.partner.market.yandex.ru/campaigns/${YANDEX_CAMPAIGN_ID}`,
      {
        headers: {
          'Authorization': `OAuth ${YANDEX_TOKEN}`,
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('   ✅ УСПЕХ!');
    console.log(`   Кампания: ${res.data.campaign?.domain || res.data.campaign?.business || 'N/A'}`);
    return true;
  } catch (err) {
    console.log(`   ❌ ОШИБКА: ${err.response?.status || err.message}`);
    if (err.response?.data) {
      console.log('   Ответ API:', JSON.stringify(err.response.data, null, 2));
    }
    return false;
  }
}

// Тест 3: Получение товаров (офферов)
async function testOffers() {
  if (!YANDEX_CAMPAIGN_ID) {
    console.log('\n4. Тест пропущен: YANDEX_CAMPAIGN_ID не указан');
    return false;
  }
  
  console.log(`\n4. Тест: Получение товаров кампании ${YANDEX_CAMPAIGN_ID}`);
  console.log(`   Endpoint: POST /campaigns/${YANDEX_CAMPAIGN_ID}/offer-mapping-entries/suggestions`);
  
  try {
    const res = await axios.post(
      `https://api.partner.market.yandex.ru/campaigns/${YANDEX_CAMPAIGN_ID}/offer-mapping-entries/suggestions`,
      {
        offerIds: []
      },
      {
        headers: {
          'Authorization': `OAuth ${YANDEX_TOKEN}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('   ✅ УСПЕХ!');
    console.log(`   Найдено товаров: ${res.data.result?.offerMappingEntries?.length || 0}`);
    return true;
  } catch (err) {
    console.log(`   ❌ ОШИБКА: ${err.response?.status || err.message}`);
    if (err.response?.data) {
      console.log('   Ответ API:', JSON.stringify(err.response.data, null, 2));
    }
    return false;
  }
}

async function runDiagnostics() {
  const test1 = await testCampaigns();
  const test2 = await testCampaignInfo();
  const test3 = await testOffers();
  
  console.log('\n=== Результаты диагностики ===');
  console.log(`Тест 1 (Кампании): ${test1 ? '✅ ПРОШЁЛ' : '❌ НЕ ПРОШЁЛ'}`);
  console.log(`Тест 2 (Инфо о кампании): ${test2 ? '✅ ПРОШЁЛ' : '❌ НЕ ПРОШЁЛ'}`);
  console.log(`Тест 3 (Товары): ${test3 ? '✅ ПРОШЁЛ' : '❌ НЕ ПРОШЁЛ'}`);
  
  if (!test1) {
    console.log('\n📝 Как получить правильный OAuth токен:');
    console.log('1. Перейдите на https://oauth.yandex.ru/');
    console.log('2. Зарегистрируйте приложение для Яндекс.Маркет');
    console.log('3. Получите OAuth токен (это будет длинная строка БЕЗ двоеточия)');
    console.log('4. Обновите YANDEX_TOKEN в файле .env');
    console.log('\nИли используйте существующий токен из личного кабинета Яндекс.Маркет:');
    console.log('1. Войдите в https://partner.market.yandex.ru/');
    console.log('2. Настройки → API → Создать токен');
    console.log('3. Скопируйте токен и обновите .env');
  }
}

runDiagnostics();
