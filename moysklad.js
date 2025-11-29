// moysklad.js
const axios = require('axios');
require('dotenv').config();

const base = process.env.MOYSKLAD_BASE;
const token = process.env.MOYSKLAD_PASSWORD; // Bearer token

// Helper function to get auth headers
function getAuthHeaders() {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json;charset=utf-8',
    'Content-Type': 'application/json'
  };
}

async function createCustomerOrder({externalNumber, storeId, orgId, positions, description}) {
  // Validate required parameters
  if (!externalNumber || !storeId || !orgId || !positions || positions.length === 0) {
    throw new Error('Missing required parameters for Customer Order creation');
  }
  
  // Validate positions format
  positions.forEach((p, index) => {
    if (!p.productId || !p.quantity) {
      throw new Error(`Invalid position at index ${index}: missing productId or quantity`);
    }
  });
  
  // positions: [{productId, quantity}]
  const agentId = process.env.DEFAULT_AGENT_ID;
  
  const body = {
    name: `Reserve ${externalNumber}`,
    externalNumber,
    organization: { meta: { href: `${base}/entity/organization/${orgId}`, type: "organization" } },
    agent: { meta: { href: `${base}/entity/counterparty/${agentId}`, type: "counterparty" } },
    store: { meta: { href: `${base}/entity/store/${storeId}`, type: "store" } },
    description: description || 'Reserve from Yandex order',
    positions: positions.map(p => ({
      quantity: p.quantity,
      assortment: { meta: { href: `${base}/entity/product/${p.productId}`, type: "product" } }
    }))
  };

  const url = `${base}/entity/customerorder`;
  try {
    const res = await axios.post(url, body, { headers: getAuthHeaders() });
    console.log(`[MOYSKLAD] Customer Order created: orderId="${externalNumber}", entityId="${res.data.id || 'unknown'}", entityHref="${res.data.meta?.href || 'unknown'}"`);
    return res.data;
  } catch (err) {
    const statusCode = err.response?.status || 'unknown';
    const responseBody = JSON.stringify(err.response?.data || {});
    console.error(`[MOYSKLAD] Failed to create Customer Order: orderId="${externalNumber}", operation="create_customer_order", statusCode="${statusCode}", responseBody=${responseBody}, error="${err.message}"`);
    if (err.stack) console.error(err.stack);
    throw err;
  }
}

async function createDemand({externalNumber, storeId, orgId, positions, description}) {
  // Validate required parameters
  if (!externalNumber || !storeId || !orgId || !positions || positions.length === 0) {
    throw new Error('Missing required parameters for Demand creation');
  }
  
  // Validate positions format
  positions.forEach((p, index) => {
    if (!p.productId || !p.quantity) {
      throw new Error(`Invalid position at index ${index}: missing productId or quantity`);
    }
  });
  
  // positions: [{productId, quantity}]
  
  // Search for corresponding Customer Order by externalNumber
  let customerOrder = null;
  try {
    customerOrder = await findCustomerOrderByExternalNumber(externalNumber);
    if (customerOrder) {
      console.log(`[MOYSKLAD] Found Customer Order for linking: orderId="${externalNumber}", customerOrderHref="${customerOrder.meta?.href || customerOrder.id}"`);
    } else {
      console.warn(`[MOYSKLAD] Customer Order not found: orderId="${externalNumber}", creating Demand without link`);
    }
  } catch (err) {
    console.warn(`[MOYSKLAD] Failed to search for Customer Order: orderId="${externalNumber}", operation="search_customer_order", error="${err.message}", creating Demand without link`);
  }
  
  const agentId = process.env.DEFAULT_AGENT_ID;
  
  const body = {
    name: `Shipment ${externalNumber}`,
    externalNumber,
    organization: { meta: { href: `${base}/entity/organization/${orgId}`, type: "organization" } },
    agent: { meta: { href: `${base}/entity/counterparty/${agentId}`, type: "counterparty" } },
    store: { meta: { href: `${base}/entity/store/${storeId}`, type: "store" } },
    description: description || 'Shipment for Yandex order',
    positions: positions.map(p => ({
      quantity: p.quantity,
      assortment: { meta: { href: `${base}/entity/product/${p.productId}`, type: "product" } }
    }))
  };
  
  // Include customerOrder reference if found
  if (customerOrder && customerOrder.meta && customerOrder.meta.href) {
    body.customerOrder = {
      meta: {
        href: customerOrder.meta.href,
        type: "customerorder"
      }
    };
  }

  const url = `${base}/entity/demand`;
  try {
    const res = await axios.post(url, body, { headers: getAuthHeaders() });
    console.log(`[MOYSKLAD] Demand created: orderId="${externalNumber}", entityId="${res.data.id || 'unknown'}", entityHref="${res.data.meta?.href || 'unknown'}"`);
    return res.data;
  } catch (err) {
    const statusCode = err.response?.status || 'unknown';
    const responseBody = JSON.stringify(err.response?.data || {});
    console.error(`[MOYSKLAD] Failed to create Demand: orderId="${externalNumber}", operation="create_demand", statusCode="${statusCode}", responseBody=${responseBody}, error="${err.message}"`);
    if (err.stack) console.error(err.stack);
    throw err;
  }
}

async function findCustomerOrderByExternalNumber(externalNumber) {
  try {
    const url = `${base}/entity/customerorder`;
    const res = await axios.get(url, {
      headers: getAuthHeaders(),
      params: {
        filter: `externalNumber=${externalNumber}`
      }
    });
    
    if (res.data && res.data.rows && res.data.rows.length > 0) {
      return res.data.rows[0];
    }
    return null;
  } catch (err) {
    const statusCode = err.response?.status || 'unknown';
    const responseBody = JSON.stringify(err.response?.data || {});
    console.error(`[MOYSKLAD] Failed to search Customer Order: orderId="${externalNumber}", operation="find_customer_order", statusCode="${statusCode}", responseBody=${responseBody}, error="${err.message}"`);
    if (err.stack) console.error(err.stack);
    throw err;
  }
}

async function findDemandByExternalNumber(externalNumber) {
  try {
    const url = `${base}/entity/demand`;
    const res = await axios.get(url, {
      headers: getAuthHeaders(),
      params: {
        filter: `externalNumber=${externalNumber}`
      }
    });
    
    if (res.data && res.data.rows && res.data.rows.length > 0) {
      return res.data.rows[0];
    }
    return null;
  } catch (err) {
    const statusCode = err.response?.status || 'unknown';
    const responseBody = JSON.stringify(err.response?.data || {});
    console.error(`[MOYSKLAD] Failed to search Demand: orderId="${externalNumber}", operation="find_demand", statusCode="${statusCode}", responseBody=${responseBody}, error="${err.message}"`);
    if (err.stack) console.error(err.stack);
    throw err;
  }
}

module.exports = { createCustomerOrder, createDemand, findCustomerOrderByExternalNumber, findDemandByExternalNumber };
