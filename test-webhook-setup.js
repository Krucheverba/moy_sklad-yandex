// test-webhook-setup.js - Проверка возможности настройки webhook для FBS
require('dotenv').config();
const axios = require('axios');

const TOKEN = process.env.YANDEX_TOKEN;
const CAMPAIGN_ID = process.env.YANDEX_CAMPAIGN_ID;

console.log('=== Проверка настройки Webhook для FBS ===\n');
console.log(`Campaign ID: ${CAMPAIGN_ID}`);
console.log(`Model: FBS\n`);

async function testWebhookEndpoints() {
  const testUrl = 'https://example.com/webhook'; // Тестовый URL
  
  const endpoints = [
    {
      name: 'PUT /campaigns/{id}/settings/webhook',
      method: 'PUT',
      url: `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}/settings/webhook`,
      data: {
        url: testUrl,
        events: ['ORDER_CREATED', 'ORDER_STATUS_UPDATED']
      }
    },
    {
      name: 'POST /campaigns/{id}/webhooks',
      method: 'POST',
      url: `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}/webhooks`,
      data: {
        url: testUrl,
        events: ['ORDER_CREATED', 'ORDER_STATUS_UPDATED']
      }
    },
    {
      name: 'GET /campaigns/{id}/settings/webhook (проверка текущих)',
      method: 'GET',
      url: `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}/settings/webhook`,
      data: null
    }
  ];

  for (const endpoint of endpoints) {
    console.log(`\n📝 Тест: ${endpoint.name}`);
    console.log(`   ${endpoint.method} ${endpoint.url}`);
    
    try {
      const config = {
        method: endpoint.method,
        url: endpoint.url,
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };
      
      if (endpoint.data) {
        config.data = endpoint.data;
      }
      
      const response = await axios(config);
      
      console.log('   ✅ УСПЕХ!');
      console.log(`   Статус: ${response.status}`);
      console.log('   Ответ:', JSON.stringify(response.data, null, 2));
      
    } catch (err) {
      console.log(`   ❌ Ошибка: ${err.response?.status || err.message}`);
      if (err.response?.data) {
        console.log('   Детали:', JSON.stringify(err.response.data, null, 2));
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('ВЫВОД:');
  console.log('='.repeat(70));
  console.log('\nЕсли все методы вернули ошибку - webhook настраивается через:');
  console.log('1. Личный кабинет партнера');
  console.log('2. Обращение в поддержку');
  console.log('\n📧 Используйте файл WEBHOOK_REQUEST_FBS.txt для запроса в поддержку');
}

testWebhookEndpoints();
