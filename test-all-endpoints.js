// test-all-endpoints.js - Тест всех возможных API endpoints и методов авторизации
const axios = require('axios');

const ADMIN_TOKEN = 'ACMA:WCSq2NS4Xil0luGi8eNhXlBLWcLPrug2D7YfcbEx:f6f02b98';
const CAMPAIGN_ID = '128441417';

console.log('=== Полное тестирование всех вариантов API ===\n');

const parts = ADMIN_TOKEN.split(':');
const clientId = parts[1];
const clientSecret = parts[2];

async function testEndpoint(url, method, headers, data, description) {
  console.log(`\n📝 ${description}`);
  console.log(`   ${method} ${url}`);
  
  try {
    const config = {
      method: method,
      url: url,
      headers: headers
    };
    
    if (data) {
      config.data = data;
    }
    
    const res = await axios(config);
    
    console.log('   ✅ УСПЕХ!');
    console.log(`   Статус: ${res.status}`);
    
    // Показываем первые данные
    if (res.data.campaigns) {
      console.log(`   Кампаний: ${res.data.campaigns.length}`);
    } else if (res.data.result) {
      console.log(`   Результат получен`);
    } else if (res.data.businesses) {
      console.log(`   Бизнесов: ${res.data.businesses.length}`);
    }
    
    return { success: true, auth: headers.Authorization, url: url };
  } catch (err) {
    console.log(`   ❌ Ошибка: ${err.response?.status || err.message}`);
    if (err.response?.data?.errors) {
      console.log(`   ${err.response.data.errors[0]?.message}`);
    }
    return { success: false };
  }
}

async function runAllTests() {
  const results = [];
  
  // Различные форматы авторизации
  const authFormats = [
    { header: `OAuth ${ADMIN_TOKEN}`, name: 'OAuth ACMA:xxx:xxx' },
    { header: `OAuth ${clientId}`, name: 'OAuth client_id' },
    { header: `OAuth ${clientId}:${clientSecret}`, name: 'OAuth client_id:secret' },
    { header: `Bearer ${ADMIN_TOKEN}`, name: 'Bearer ACMA:xxx:xxx' },
    { header: `Bearer ${clientId}`, name: 'Bearer client_id' },
    { header: `Bearer ${clientId}:${clientSecret}`, name: 'Bearer client_id:secret' },
    { header: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, name: 'Basic Auth' },
    { header: ADMIN_TOKEN, name: 'Без префикса ACMA' },
    { header: `${clientId}:${clientSecret}`, name: 'Без префикса client_id:secret' },
  ];
  
  // Различные endpoints
  const endpoints = [
    { url: 'https://api.partner.market.yandex.ru/campaigns', method: 'GET', name: 'GET /campaigns' },
    { url: 'https://api.partner.market.yandex.ru/businesses', method: 'GET', name: 'GET /businesses' },
    { url: `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}`, method: 'GET', name: 'GET /campaigns/{id}' },
    { url: `https://api.partner.market.yandex.ru/campaigns/${CAMPAIGN_ID}/offers`, method: 'GET', name: 'GET /campaigns/{id}/offers' },
  ];
  
  console.log('🔍 Тестирование комбинаций...\n');
  console.log(`Всего тестов: ${authFormats.length * endpoints.length}`);
  console.log('Это займёт около минуты...\n');
  
  let testCount = 0;
  
  for (const auth of authFormats) {
    for (const endpoint of endpoints) {
      testCount++;
      
      const result = await testEndpoint(
        endpoint.url,
        endpoint.method,
        {
          'Authorization': auth.header,
          'Accept': 'application/json'
        },
        null,
        `Тест ${testCount}: ${auth.name} + ${endpoint.name}`
      );
      
      if (result.success) {
        results.push(result);
      }
      
      // Небольшая задержка, чтобы не перегружать API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('ИТОГОВЫЕ РЕЗУЛЬТАТЫ:');
  console.log('='.repeat(70));
  
  if (results.length > 0) {
    console.log(`\n✅ НАЙДЕНО ${results.length} РАБОЧИХ КОМБИНАЦИЙ!\n`);
    
    results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.url}`);
      console.log(`   Auth: ${r.auth.substring(0, 50)}...`);
    });
    
    console.log('\n🎉 ТОКЕН РАБОТАЕТ!');
    console.log('\n📝 Обновите код для использования рабочего метода авторизации');
    
  } else {
    console.log('\n❌ НИ ОДНА КОМБИНАЦИЯ НЕ СРАБОТАЛА\n');
    console.log('💡 Возможные причины:');
    console.log('1. Токен ACMA предназначен для другого API (не Partner API)');
    console.log('2. Токен работает только через веб-интерфейс, а не через REST API');
    console.log('3. Нужен другой тип токена (настоящий OAuth токен)');
    console.log('4. API требует дополнительные заголовки или параметры');
    
    console.log('\n📞 Рекомендации:');
    console.log('1. Обратитесь в поддержку Яндекс.Маркет с вопросом:');
    console.log('   "Как использовать токен ACMA:xxx:xxx для Partner API?"');
    console.log('2. Спросите, как получить OAuth токен для Partner API');
    console.log('3. Уточните, какой тип токена нужен для REST API');
    
    console.log('\n🔗 Полезные ссылки:');
    console.log('- Документация: https://yandex.ru/dev/market/partner-api/doc/dg/concepts/about.html');
    console.log('- Поддержка: https://yandex.ru/support/market-tech/');
  }
}

runAllTests();
