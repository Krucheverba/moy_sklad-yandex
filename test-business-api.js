// test-business-api.js - Тест Business API (новый API Яндекс.Маркет)
const axios = require('axios');

const ACMA_TOKEN = 'ACMA:MvULdPS7nuzGqd7a3R1ZXciYxpH8kMFcIJpmlzAM:7e8d65cf';
const CAMPAIGN_ID = '128441417';

console.log('=== Тестирование Business API (новый формат) ===\n');

// Извлекаем части токена
const parts = ACMA_TOKEN.split(':');
const clientId = parts[1];
const clientSecret = parts[2];

async function testBusinessAPI() {
  console.log('📝 Тест 1: Business API - Получение бизнесов');
  console.log('   Endpoint: GET /businesses');
  console.log('   Auth: Basic Auth (client_id:client_secret)\n');
  
  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const res = await axios.get('https://api.partner.market.yandex.ru/businesses', {
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('   ✅ УСПЕХ!');
    console.log(`   Статус: ${res.status}`);
    console.log(`   Бизнесов: ${res.data.businesses?.length || 0}`);
    
    if (res.data.businesses && res.data.businesses.length > 0) {
      console.log('   Бизнесы:');
      res.data.businesses.forEach(b => {
        console.log(`     - ID: ${b.id}, Название: ${b.name || 'N/A'}`);
      });
      return res.data.businesses[0].id;
    }
    
    return null;
  } catch (err) {
    console.log(`   ❌ Ошибка: ${err.response?.status || err.message}`);
    if (err.response?.data) {
      console.log('   Ответ:', JSON.stringify(err.response.data, null, 2));
    }
    return null;
  }
}

async function testCampaignsWithBasicAuth() {
  console.log('\n📝 Тест 2: Partner API с Basic Auth');
  console.log('   Endpoint: GET /campaigns');
  console.log('   Auth: Basic Auth\n');
  
  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const res = await axios.get('https://api.partner.market.yandex.ru/campaigns', {
      headers: {
        'Authorization': `Basic ${basicAuth}`,
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
    if (err.response?.data) {
      console.log('   Ответ:', JSON.stringify(err.response.data, null, 2));
    }
    return false;
  }
}

async function testOffersWithBasicAuth(businessId) {
  console.log('\n📝 Тест 3: Получение товаров через Business API');
  console.log(`   Endpoint: POST /businesses/${businessId}/offer-mappings`);
  console.log('   Auth: Basic Auth\n');
  
  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const res = await axios.post(
      `https://api.partner.market.yandex.ru/businesses/${businessId}/offer-mappings`,
      {
        offerIds: []
      },
      {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('   ✅ УСПЕХ!');
    console.log(`   Товаров: ${res.data.result?.offerMappings?.length || 0}`);
    
    if (res.data.result?.offerMappings?.length > 0) {
      console.log('   Первые 3 товара:');
      res.data.result.offerMappings.slice(0, 3).forEach(offer => {
        console.log(`     - SKU: ${offer.offer?.shopSku || 'N/A'}, Название: ${offer.offer?.name || 'N/A'}`);
      });
    }
    
    return true;
  } catch (err) {
    console.log(`   ❌ Ошибка: ${err.response?.status || err.message}`);
    if (err.response?.data) {
      console.log('   Ответ:', JSON.stringify(err.response.data, null, 2));
    }
    return false;
  }
}

async function testCampaignOffersWithBasicAuth() {
  console.log('\n📝 Тест 4: Получение товаров через Campaign API с Basic Auth');
  console.log(`   Endpoint: POST /campaigns/${CAMPAIGN_ID}/offer-mapping-entries/suggestions`);
  console.log('   Auth: Basic Auth\n');
  
  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const res = await axios.post(
      `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}/offer-mapping-entries/suggestions`,
      {
        offerIds: []
      },
      {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
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
      console.log('   Ответ:', JSON.stringify(err.response.data, null, 2));
    }
    return false;
  }
}

async function runTests() {
  console.log(`Client ID: ${clientId.substring(0, 20)}...`);
  console.log(`Client Secret: ${clientSecret}\n`);
  
  const businessId = await testBusinessAPI();
  const test2 = await testCampaignsWithBasicAuth();
  const test4 = await testCampaignOffersWithBasicAuth();
  
  if (businessId) {
    await testOffersWithBasicAuth(businessId);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('ИТОГ:');
  console.log('='.repeat(60));
  
  if (test2 || test4) {
    console.log('✅ Basic Auth работает!');
    console.log('\n📝 Используйте в коде:');
    console.log(`const basicAuth = Buffer.from('${clientId}:${clientSecret}').toString('base64');`);
    console.log(`headers: { 'Authorization': 'Basic ' + basicAuth }`);
  } else {
    console.log('❌ Токен не работает ни с одним методом авторизации');
    console.log('\n💡 Возможные причины:');
    console.log('1. Токен истёк или был отозван');
    console.log('2. У токена нет необходимых прав доступа');
    console.log('3. Токен создан для другого типа API');
    console.log('\n📝 Попробуйте:');
    console.log('1. Создать новый токен в личном кабинете');
    console.log('2. Убедиться, что выбраны все права доступа');
    console.log('3. Обратиться в поддержку Яндекс.Маркет');
  }
}

runTests();
