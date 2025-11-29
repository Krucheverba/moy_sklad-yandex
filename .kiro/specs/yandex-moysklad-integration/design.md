# Design Document

## Overview

The Yandex.Market to MoySklad integration is a Node.js webhook server that receives order events from Yandex.Market and automatically manages inventory in MoySklad. The system follows a unidirectional data flow: Yandex → Integration Server → MoySklad.

The architecture consists of three main components:
1. **Webhook Server** - Express.js HTTP server handling incoming webhooks
2. **MoySklad API Client** - Module for creating reservations and shipments
3. **Product Mapping Service** - Utility for generating and loading SKU mappings

## Architecture

### High-Level Architecture

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────┐
│  Yandex.Market  │────────>│  Integration Server  │────────>│  MoySklad   │
│   (Webhooks)    │  HTTPS  │   (Node.js/Express)  │  HTTPS  │    (API)    │
└─────────────────┘         └──────────────────────┘         └─────────────┘
                                      │
                                      │ reads
                                      ▼
                              ┌──────────────┐
                              │ mapping.json │
                              └──────────────┘
```

### Component Interaction Flow

**Order Creation Flow:**
```
1. Yandex sends ORDER_CREATED webhook
2. Webhook Server validates request
3. Extract order items and map SKUs to MoySklad product IDs
4. Check if Customer Order already exists (idempotency)
5. Create Customer Order in MoySklad (reserves inventory)
6. Return HTTP 200 to Yandex
```

**Label Printing Flow:**
```
1. Yandex sends label print webhook
2. Webhook Server validates request
3. Extract order items and map SKUs to MoySklad product IDs
4. Find existing Customer Order by External Number
5. Check if Demand already exists (idempotency)
6. Create Demand linked to Customer Order (writes off inventory)
7. Return HTTP 200 to Yandex
```

## Components and Interfaces

### 1. Webhook Server (index.js)

**Responsibilities:**
- Listen for HTTP POST requests on /webhook endpoint
- Validate webhook authenticity
- Route events to appropriate handlers
- Return appropriate HTTP status codes

**Key Functions:**

```javascript
// Verify webhook signature/token
function verifyWebhook(req: Request): boolean

// Extract and map order positions from Yandex webhook
function mapPositionsFromYandex(yandexOrder: Object): Array<{productId: string, quantity: number}>

// Handle ORDER_CREATED event
async function handleOrderCreated(order: Object): Promise<void>

// Handle label print event
async function handleLabelPrint(order: Object): Promise<void>
```

**HTTP Endpoints:**

- `POST /webhook` - Receives all webhook events from Yandex.Market
  - Request: JSON payload with order data
  - Response: 200 (success), 400 (bad request), 403 (forbidden), 500 (error)

### 2. MoySklad API Client (moysklad.js)

**Responsibilities:**
- Communicate with MoySklad REST API
- Create Customer Orders (reservations)
- Create Demands (shipments/write-offs)
- Search for existing entities by External Number
- Handle API errors and retries

**Key Functions:**

```javascript
// Create a Customer Order (reservation)
async function createCustomerOrder(params: {
  externalNumber: string,
  storeId: string,
  orgId: string,
  positions: Array<{productId: string, quantity: number}>,
  description: string
}): Promise<Object>

// Create a Demand (shipment/write-off)
async function createDemand(params: {
  externalNumber: string,
  storeId: string,
  orgId: string,
  positions: Array<{productId: string, quantity: number}>,
  customerOrderId?: string,
  description: string
}): Promise<Object>

// Find Customer Order by External Number
async function findCustomerOrderByExternalNumber(externalNumber: string): Promise<Object | null>

// Find Demand by External Number
async function findDemandByExternalNumber(externalNumber: string): Promise<Object | null>
```

**API Integration:**
- Base URL: `https://api.moysklad.ru/api/remap/1.2`
- Authentication: HTTP Basic Auth
- Content-Type: application/json

### 3. Product Mapping Service (generate-mapping.js)

**Responsibilities:**
- Fetch all products from MoySklad API
- Generate mapping from externalCode to product ID
- Write mapping to JSON file
- Validate mapping completeness

**Key Functions:**

```javascript
// Fetch all products from MoySklad
async function getMoySkladProducts(): Promise<Array<{id: string, externalCode: string, name: string}>>

// Generate and save mapping file
async function generateMapping(): Promise<void>

// Load mapping from file (used by webhook server)
function loadMapping(): Object
```

## Data Models

### Yandex Webhook Event

```javascript
{
  type: "ORDER_CREATED" | "ORDER_STATUS_UPDATED",
  order: {
    id: string,              // Yandex order ID
    items: [
      {
        offerId: string,     // SKU identifier
        count: number        // Quantity
      }
    ],
    status: string           // Order status
  }
}
```

### Product Mapping

```javascript
{
  "YANDEX-SKU-001": "moysklad-product-uuid-1",
  "YANDEX-SKU-002": "moysklad-product-uuid-2"
}
```

### MoySklad Customer Order

```javascript
{
  name: string,
  externalNumber: string,
  organization: {
    meta: {
      href: string,
      type: "organization"
    }
  },
  store: {
    meta: {
      href: string,
      type: "store"
    }
  },
  positions: [
    {
      quantity: number,
      assortment: {
        meta: {
          href: string,
          type: "product"
        }
      }
    }
  ]
}
```

### MoySklad Demand

```javascript
{
  name: string,
  externalNumber: string,
  organization: {
    meta: {
      href: string,
      type: "organization"
    }
  },
  store: {
    meta: {
      href: string,
      type: "store"
    }
  },
  customerOrder: {        // Optional link to Customer Order
    meta: {
      href: string,
      type: "customerorder"
    }
  },
  positions: [
    {
      quantity: number,
      assortment: {
        meta: {
          href: string,
          type: "product"
        }
      }
    }
  ]
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Valid webhook parsing succeeds

*For any* valid JSON webhook payload with order information, parsing should extract order data without throwing errors.
**Validates: Requirements 1.2**

### Property 2: Malformed webhooks return 400

*For any* malformed or invalid JSON payload, the webhook endpoint should return HTTP 400 status.
**Validates: Requirements 1.3**

### Property 3: Successful processing returns 200

*For any* webhook that processes without system errors, the endpoint should return HTTP 200 status.
**Validates: Requirements 1.4**

### Property 4: System errors return 500

*For any* webhook processing that encounters a system error, the endpoint should return HTTP 500 status.
**Validates: Requirements 1.5**

### Property 5: Invalid signatures return 403

*For any* webhook request with an invalid signature or authentication token, the system should return HTTP 403 status.
**Validates: Requirements 2.2**

### Property 6: Valid signatures allow processing

*For any* webhook request with a valid signature, the system should proceed with event processing.
**Validates: Requirements 2.4**

### Property 7: Product field extraction

*For any* valid product data from MoySklad API, the system should extract product ID and externalCode fields.
**Validates: Requirements 3.2**

### Property 8: Mapping entry creation

*For any* product with an externalCode value, the system should create a mapping entry with externalCode as key and product ID as value.
**Validates: Requirements 3.3**

### Property 9: Mapping JSON validity

*For any* generated product mapping, writing to file and reading back should produce an equivalent mapping object (round-trip property).
**Validates: Requirements 3.4**

### Property 10: Order item extraction

*For any* valid ORDER_CREATED webhook, the system should extract order items and quantities without errors.
**Validates: Requirements 4.1**

### Property 11: SKU to product ID mapping

*For any* order items with SKUs present in the product mapping, the system should successfully map each SKU to its corresponding MoySklad product ID.
**Validates: Requirements 4.2**

### Property 12: Unmapped SKU handling

*For any* SKU not found in the product mapping, the system should skip that item and log an error.
**Validates: Requirements 4.3**

### Property 13: Customer Order creation with positions

*For any* successfully mapped order items, the system should create a Customer Order in MoySklad containing all mapped positions.
**Validates: Requirements 4.4**

### Property 14: Customer Order external number

*For any* created Customer Order, the externalNumber field should match the Yandex order ID.
**Validates: Requirements 4.5**

### Property 15: Label print event extraction

*For any* valid label printing webhook, the system should extract order identifier and items without errors.
**Validates: Requirements 5.1**

### Property 16: Demand creation with positions

*For any* successfully mapped shipment items, the system should create a Demand in MoySklad containing all mapped positions.
**Validates: Requirements 5.4**

### Property 17: Demand external number

*For any* created Demand, the externalNumber field should match the Yandex order ID.
**Validates: Requirements 5.5**

### Property 18: Customer Order idempotency check

*For any* ORDER_CREATED webhook, the system should check if a Customer Order with the same External Number already exists before creating a new one.
**Validates: Requirements 6.1**

### Property 19: Customer Order duplicate prevention

*For any* ORDER_CREATED webhook processed twice with the same External Number, only one Customer Order should exist in MoySklad.
**Validates: Requirements 6.2**

### Property 20: Demand idempotency check

*For any* label print webhook, the system should check if a Demand with the same External Number already exists before creating a new one.
**Validates: Requirements 6.3**

### Property 21: Demand duplicate prevention

*For any* label print webhook processed twice with the same External Number, only one Demand should exist in MoySklad.
**Validates: Requirements 6.4**

### Property 22: API error resilience

*For any* idempotency check that fails due to API error, the system should log the error and proceed with creation attempt.
**Validates: Requirements 6.5**

### Property 23: Customer Order search for linking

*For any* Demand creation, the system should search for a Customer Order with matching External Number.
**Validates: Requirements 7.1**

### Property 24: Demand linking when Customer Order found

*For any* Demand creation where a matching Customer Order exists, the Demand should include a reference to that Customer Order.
**Validates: Requirements 7.2**

### Property 25: Demand creation without link

*For any* Demand creation where no matching Customer Order is found, the Demand should still be created without a Customer Order reference, and a warning should be logged.
**Validates: Requirements 7.3**

### Property 26: Missing required config causes exit

*For any* required environment variable that is missing, the system should log an error and exit with non-zero status.
**Validates: Requirements 8.2**

### Property 27: MoySklad API uses environment config

*For any* MoySklad API request, the system should use MOYSKLAD_BASE, MOYSKLAD_LOGIN, and MOYSKLAD_PASSWORD from environment variables.
**Validates: Requirements 8.4**

### Property 28: Entity creation uses environment IDs

*For any* MoySklad entity creation (Customer Order or Demand), the system should use STORE_ID and ORG_ID from environment variables.
**Validates: Requirements 8.5**

### Property 29: Error logging includes context

*For any* operation failure, the system should log the error with context information including order ID and operation type.
**Validates: Requirements 9.1**

### Property 30: API error logging includes details

*For any* MoySklad API request failure, the system should log the HTTP status code and response body.
**Validates: Requirements 9.2**

### Property 31: Webhook logging

*For any* received webhook, the system should log the event type and order identifier.
**Validates: Requirements 9.3**

### Property 32: Success logging

*For any* successfully created Customer Order or Demand, the system should log the MoySklad entity ID or href.
**Validates: Requirements 9.4**

### Property 33: Stack trace logging

*For any* unexpected error, the system should log the full error stack trace.
**Validates: Requirements 9.5**

### Property 34: Dependency declaration

*For any* package imported in the application code, that package should be declared in package.json dependencies.
**Validates: Requirements 10.3**

## Error Handling

### Webhook Processing Errors

1. **Malformed JSON**: Return 400, log error, do not retry
2. **Invalid Signature**: Return 403, log warning, do not retry
3. **Missing SKU Mapping**: Skip item, log error, continue processing other items
4. **MoySklad API Error**: Return 500, log full error details, allow Yandex to retry
5. **Network Timeout**: Return 500, log timeout, allow retry

### MoySklad API Errors

1. **Authentication Failure (401)**: Log credentials issue, return 500
2. **Not Found (404)**: Log entity not found, handle gracefully based on context
3. **Rate Limiting (429)**: Implement exponential backoff, retry up to 3 times
4. **Server Error (500+)**: Log error, return 500 to trigger webhook retry
5. **Validation Error (400)**: Log validation details, return 500

### Idempotency Handling

1. **Duplicate Customer Order**: Skip creation, log info, return 200
2. **Duplicate Demand**: Skip creation, log info, return 200
3. **Search Failure**: Log error, attempt creation anyway to avoid data loss

### Configuration Errors

1. **Missing Required Env Vars**: Log error message, exit with code 1
2. **Invalid Env Var Format**: Log validation error, exit with code 1
3. **Missing Mapping File**: Log error, exit with code 1

## Testing Strategy

### Unit Testing

The system will use **Vitest** as the testing framework for unit tests. Unit tests will cover:

1. **Webhook parsing logic**: Test extraction of order data from various webhook formats
2. **SKU mapping function**: Test mapping logic with known mappings and missing SKUs
3. **MoySklad request builders**: Test that request bodies are constructed correctly
4. **Configuration loading**: Test environment variable loading and validation
5. **Error handling**: Test that errors are caught and logged appropriately

Unit tests will use mocked HTTP clients to avoid actual API calls.

### Property-Based Testing

The system will use **fast-check** as the property-based testing library for JavaScript/Node.js. Property-based tests will verify universal properties across randomly generated inputs.

**Configuration**: Each property-based test will run a minimum of 100 iterations.

**Tagging**: Each property-based test will include a comment tag in the format:
`// Feature: yandex-moysklad-integration, Property {number}: {property_text}`

**Coverage**: Each correctness property listed above will be implemented as a property-based test.

**Generators**: Custom generators will be created for:
- Yandex webhook payloads (valid and invalid)
- Product mappings
- MoySklad API responses
- Order items with various SKU formats

### Integration Testing

Integration tests will verify end-to-end flows:

1. **Full order creation flow**: Send ORDER_CREATED webhook, verify Customer Order created in MoySklad
2. **Full shipment flow**: Send label print webhook, verify Demand created and linked to Customer Order
3. **Idempotency**: Send duplicate webhooks, verify only one entity created
4. **Error recovery**: Simulate API failures, verify proper error handling and retries

Integration tests will use a test MoySklad account or mocked API server.

### Manual Testing

Manual testing checklist:

1. Deploy to staging environment
2. Configure Yandex.Market webhook to point to staging server
3. Create test order in Yandex.Market
4. Verify Customer Order appears in MoySklad with correct items and quantities
5. Print shipping label in Yandex.Market
6. Verify Demand appears in MoySklad linked to Customer Order
7. Verify inventory is correctly written off
8. Test duplicate webhook delivery
9. Test with unmapped SKUs
10. Monitor logs for errors

## Security Considerations

1. **Webhook Verification**: Implement signature verification using WEBHOOK_SECRET
2. **Credentials Storage**: Store MoySklad credentials in environment variables, never in code
3. **HTTPS Only**: Ensure webhook endpoint only accepts HTTPS connections in production
4. **Rate Limiting**: Implement rate limiting on webhook endpoint to prevent abuse
5. **Input Validation**: Validate all webhook payload data before processing
6. **Logging**: Avoid logging sensitive data (passwords, tokens) in error messages

## Deployment Considerations

1. **Environment Variables**: Ensure all required env vars are set before deployment
2. **Mapping File**: Generate mapping.json before starting webhook server
3. **Process Management**: Use PM2 or similar to keep server running and restart on crashes
4. **Monitoring**: Set up monitoring for webhook endpoint availability and error rates
5. **Logging**: Configure log aggregation (e.g., Winston + CloudWatch/Papertrail)
6. **Reverse Proxy**: Use nginx or similar as reverse proxy for SSL termination

## Performance Considerations

1. **Webhook Response Time**: Respond to webhooks within 5 seconds to avoid timeouts
2. **Async Processing**: Process webhooks asynchronously if operations take longer than 5 seconds
3. **Connection Pooling**: Reuse HTTP connections to MoySklad API
4. **Caching**: Cache product mapping in memory, reload periodically
5. **Batch Operations**: If processing multiple orders, consider batching MoySklad API calls

## Future Enhancements

1. **Webhook Queue**: Implement queue (e.g., Redis/Bull) for reliable webhook processing
2. **Retry Logic**: Add automatic retry with exponential backoff for failed MoySklad operations
3. **Admin Dashboard**: Create simple web UI to view webhook history and errors
4. **Mapping Sync**: Automatically refresh product mapping periodically
5. **Order Status Sync**: Optionally sync more order statuses (cancellations, returns)
6. **Metrics**: Add Prometheus metrics for monitoring webhook processing rates and errors
