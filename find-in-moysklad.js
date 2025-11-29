// find-in-moysklad.js - Поиск товара в МойСклад
require('dotenv').config();
const axios = require('axios');

const { MOYSKLAD_BASE, MOYSKLAD_PASSWORD } = process.env;
const SEARCH_NAME = 'Takayama';

async function findInMoySklad() {
  try {
    // Поиск по названию
    const url = `${MOYSKLAD_BASE}/entity/product?filter=name~${SEARCH_NAME}`;
    
    console.log(`Поиск товаров с "${SEARCH_NAME}" в МойСклад...\n`);
    
    const res = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${MOYSKLAD_PASSWORD}`,
        'Accept': 'application/json;charset=utf-8'
      }
    });

    const products = res.data.rows || [];
    
    if (products.length === 0) {
      console.log('❌ Товары не найдены');
      return;
    }
    
    console.log(`✅ Найдено товаров: ${products.length}\n`);
    
    products.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   ID: ${p.id}`);
      console.log(`   Артикул: ${p.article || 'не указан'}`);
      console.log(`   Код: ${p.code || 'не указан'}`);
      console.log(`   Внешний код: ${p.externalCode || 'не указан'}`);
      console.log('');
    });

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
  }
}

findInMoySklad();
