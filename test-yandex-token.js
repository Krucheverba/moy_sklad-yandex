// test-yandex-token.js - Тест разных форматов токена
require('dotenv').config();
const axios = require('axios');

const YANDEX_TOKEN = process.env.YANDEX_TOKEN;
const YANDEX_CAMPAIGN_ID = process.env.YANDEX_CAMPAIGN_ID;

async function testToken(authFormat, description) {
  console.log(`\n=== Тест: ${description} ===`);
  
  try {
    const url = `https://api.partner.market.yandex.ru/campaigns/${YANDEX_CAMPAIGN_ID}/stats/skus`;
    console.log(`URL: ${url}`);
    console.log(`Auth: ${authFormat}`);
    
    const res = await axios.get(url, {
      headers: {
        'Authorization': authFormat,
        'Accept': 'application/json'
      }
    });
    
    console.log('✅ УСПЕХ!');
    console.log('Статус:', res.status);
    return true;
  } catch (err) {
    console.log('❌ Ошибка:', err.response?.status || err.message);
    if (err.response?.data) {
      console.log('Ответ:', JSON.stringify(err.response.data, null, 2));
    }
    return false;
  }
}

async function runTests() {
  console.log('Тестирование токена Яндекс.Маркет...');
  console.log(`Campaign ID: ${YANDEX_CAMPAIGN_ID}`);
  console.log(`Token (первые 20 символов): ${YANDEX_TOKEN.substring(0, 20)}...`);
  
  // Тест 1: OAuth формат
  await testToken(`OAuth ${YANDEX_TOKEN}`, 'OAuth формат');
  
  // Тест 2: Bearer формат
  await testToken(`Bearer ${YANDEX_TOKEN}`, 'Bearer формат');
  
  // Тест 3: Без префикса
  await testToken(YANDEX_TOKEN, 'Без префикса');
  
  console.log('\n=== Тесты завершены ===');
}

runTests();
