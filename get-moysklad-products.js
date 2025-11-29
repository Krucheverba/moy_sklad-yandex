// get-moysklad-products.js - Получить товары из МойСклад
require('dotenv').config();
const axios = require('axios');

const {
  MOYSKLAD_BASE,
  MOYSKLAD_LOGIN,
  MOYSKLAD_PASSWORD
} = process.env;

if (!MOYSKLAD_BASE || !MOYSKLAD_LOGIN || !MOYSKLAD_PASSWORD) {
  console.error('❌ Не заполнены переменные МойСклад в .env!');
  process.exit(1);
}

async function getProducts() {
  try {
    const url = `${MOYSKLAD_BASE}/entity/product?limit=100`;
    console.log('Запрос к МойСклад API...');
    
    // Попробуем Bearer токен
    const res = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${MOYSKLAD_PASSWORD}`,
        'Accept': 'application/json;charset=utf-8'
      }
    });

    console.log(`\n✅ Получено товаров: ${res.data.rows.length}`);
    console.log('\n📦 Список товаров:\n');
    
    res.data.rows.forEach((product, index) => {
      console.log(`${index + 1}. Название: ${product.name}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   Артикул: ${product.article || 'не указан'}`);
      console.log(`   Внешний код: ${product.externalCode || 'не указан'}`);
      console.log('');
    });

    console.log('\n💡 Для создания маппинга нужно:');
    console.log('1. В МойСклад заполнить поле "Внешний код" (externalCode) для каждого товара');
    console.log('2. Использовать тот же код (SKU/offerId) в Яндекс.Маркет');
    console.log('3. Запустить npm start для генерации маппинга');
    
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    if (err.response) {
      console.error('Статус:', err.response.status);
      console.error('Ответ:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

getProducts();
