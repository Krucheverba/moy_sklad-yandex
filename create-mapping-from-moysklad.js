// create-mapping-from-moysklad.js - Создать маппинг только из МойСклад
require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

const {
  MOYSKLAD_BASE,
  MOYSKLAD_LOGIN,
  MOYSKLAD_PASSWORD
} = process.env;

async function createMapping() {
  try {
    const url = `${MOYSKLAD_BASE}/entity/product?limit=1000`;
    console.log('Получение товаров из МойСклад...');
    
    const res = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${MOYSKLAD_PASSWORD}`,
        'Accept': 'application/json;charset=utf-8'
      }
    });

    const mapping = {};
    let count = 0;
    
    res.data.rows.forEach(product => {
      if (product.externalCode) {
        mapping[product.externalCode] = product.id;
        count++;
      }
    });

    fs.writeFileSync('mapping.json', JSON.stringify(mapping, null, 2), 'utf-8');
    console.log(`\n✅ Создан mapping.json с ${count} товарами`);
    console.log('\n💡 Теперь убедитесь, что в Яндекс.Маркет используются те же SKU (offerId)');
    
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
  }
}

createMapping();
