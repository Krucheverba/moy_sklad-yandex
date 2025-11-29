# Requirements Document

## Introduction

This document specifies requirements for a one-way integration system from Yandex.Market (Express model) to MoySklad inventory management system. The system automatically processes order webhooks from Yandex.Market and creates corresponding inventory reservations and shipments in MoySklad. When an order is created, inventory is reserved. When a shipping label is printed, inventory is written off. No data flows back from MoySklad to Yandex.Market.

## Glossary

- **Webhook Server**: The Express.js HTTP server that receives webhook notifications from Yandex.Market
- **MoySklad API Client**: The module responsible for communicating with MoySklad REST API
- **Product Mapping**: A JSON file mapping Yandex.Market SKU identifiers to MoySklad product IDs
- **Customer Order**: A MoySklad entity representing inventory reservation for a customer order
- **Demand**: A MoySklad entity representing actual inventory shipment/write-off
- **Webhook Event**: An HTTP POST request from Yandex.Market containing order status information
- **External Number**: A unique identifier linking Yandex order to MoySklad entities
- **Idempotency**: The property ensuring repeated webhook processing produces the same result

## Requirements

### Requirement 1

**User Story:** As a merchant, I want the system to receive webhook notifications from Yandex.Market, so that order events trigger automatic inventory updates in MoySklad.

#### Acceptance Criteria

1. WHEN the Webhook Server starts THEN the system SHALL listen on the configured HTTP port for incoming webhook requests
2. WHEN a webhook request is received at the /webhook endpoint THEN the system SHALL parse the JSON payload and extract order information
3. WHEN the webhook payload is malformed or invalid JSON THEN the system SHALL return HTTP 400 status and log the error
4. WHEN webhook processing completes successfully THEN the system SHALL return HTTP 200 status to acknowledge receipt
5. WHEN webhook processing fails due to system error THEN the system SHALL return HTTP 500 status to trigger Yandex retry mechanism

### Requirement 2

**User Story:** As a merchant, I want webhook requests to be verified for authenticity, so that only legitimate Yandex.Market requests are processed.

#### Acceptance Criteria

1. WHEN a webhook request is received THEN the system SHALL verify the request signature or authentication token
2. WHEN the webhook verification fails THEN the system SHALL return HTTP 403 status and reject the request
3. WHEN the WEBHOOK_SECRET environment variable is not configured THEN the system SHALL log a warning and skip verification
4. WHEN the webhook signature is valid THEN the system SHALL proceed with event processing

### Requirement 3

**User Story:** As a merchant, I want Yandex.Market product SKUs mapped to MoySklad product IDs, so that the system can correctly identify which inventory items to reserve and ship.

#### Acceptance Criteria

1. WHEN the mapping generation script runs THEN the system SHALL fetch all products from MoySklad API
2. WHEN products are fetched from MoySklad THEN the system SHALL extract product ID and externalCode fields
3. WHEN a product has an externalCode value THEN the system SHALL create a mapping entry with externalCode as key and product ID as value
4. WHEN the mapping is generated THEN the system SHALL write the mapping to mapping.json file in valid JSON format
5. WHEN the Webhook Server starts THEN the system SHALL load the Product Mapping from mapping.json file

### Requirement 4

**User Story:** As a merchant, I want inventory reserved in MoySklad when a new order is created in Yandex.Market, so that stock is held for the customer and not oversold.

#### Acceptance Criteria

1. WHEN a webhook with ORDER_CREATED event type is received THEN the system SHALL extract order items and quantities
2. WHEN order items are extracted THEN the system SHALL map each Yandex SKU to MoySklad product ID using the Product Mapping
3. WHEN a SKU is not found in the Product Mapping THEN the system SHALL log an error and skip that item
4. WHEN all items are mapped successfully THEN the system SHALL create a Customer Order in MoySklad with the mapped positions
5. WHEN the Customer Order is created THEN the system SHALL include the Yandex order ID as External Number for tracking

### Requirement 5

**User Story:** As a merchant, I want inventory shipped (written off) in MoySklad when a shipping label is printed for a Yandex order, so that actual stock levels reflect items sent to customers.

#### Acceptance Criteria

1. WHEN a webhook indicating label printing is received THEN the system SHALL extract the order identifier and items
2. WHEN the label print event is detected THEN the system SHALL extract order items and quantities
3. WHEN order items are extracted THEN the system SHALL map each Yandex SKU to MoySklad product ID using the Product Mapping
4. WHEN all items are mapped successfully THEN the system SHALL create a Demand in MoySklad with the mapped positions
5. WHEN the Demand is created THEN the system SHALL include the Yandex order ID as External Number for tracking

### Requirement 6

**User Story:** As a merchant, I want the system to handle duplicate webhook deliveries gracefully, so that the same order does not create multiple reservations or shipments.

#### Acceptance Criteria

1. WHEN processing an ORDER_CREATED webhook THEN the system SHALL check if a Customer Order with the same External Number already exists in MoySklad
2. WHEN a Customer Order with the External Number already exists THEN the system SHALL skip creation and return success status
3. WHEN processing an ORDER_STATUS_UPDATED webhook for shipment THEN the system SHALL check if a Demand with the same External Number already exists
4. WHEN a Demand with the External Number already exists THEN the system SHALL skip creation and return success status
5. WHEN checking for existing entities fails due to API error THEN the system SHALL log the error and proceed with creation attempt

### Requirement 7

**User Story:** As a merchant, I want the Demand entity linked to the corresponding Customer Order in MoySklad, so that shipments are properly associated with reservations.

#### Acceptance Criteria

1. WHEN creating a Demand for order shipment THEN the system SHALL search for the Customer Order with matching External Number in MoySklad
2. WHEN the matching Customer Order is found THEN the system SHALL include a reference to that Customer Order in the Demand entity
3. WHEN the matching Customer Order is not found THEN the system SHALL create the Demand without Customer Order reference and log a warning
4. WHEN the Demand is linked to Customer Order THEN the MoySklad system SHALL automatically handle inventory reservation conversion

### Requirement 8

**User Story:** As a system administrator, I want all configuration stored in environment variables, so that the system can be deployed to different environments without code changes.

#### Acceptance Criteria

1. WHEN the system starts THEN the system SHALL load configuration from environment variables or .env file
2. WHEN required environment variables are missing THEN the system SHALL log an error message and exit with non-zero status
3. WHEN the Webhook Server starts THEN the system SHALL use the PORT environment variable or default to 3000
4. WHEN making MoySklad API requests THEN the system SHALL use MOYSKLAD_BASE, MOYSKLAD_LOGIN, and MOYSKLAD_PASSWORD from environment
5. WHEN creating MoySklad entities THEN the system SHALL use STORE_ID and ORG_ID from environment variables

### Requirement 9

**User Story:** As a developer, I want comprehensive error handling and logging, so that I can diagnose and fix issues when they occur.

#### Acceptance Criteria

1. WHEN any operation fails THEN the system SHALL log the error with context information including order ID and operation type
2. WHEN a MoySklad API request fails THEN the system SHALL log the HTTP status code and response body
3. WHEN a webhook is received THEN the system SHALL log the event type and order identifier
4. WHEN a Customer Order or Demand is created successfully THEN the system SHALL log the MoySklad entity ID or href
5. WHEN an unexpected error occurs THEN the system SHALL log the full error stack trace for debugging

### Requirement 10

**User Story:** As a developer, I want the codebase to use consistent module system and have all dependencies properly declared, so that the application runs without module resolution errors.

#### Acceptance Criteria

1. WHEN the package.json specifies module type THEN the system SHALL use ES modules (import/export) consistently across all files
2. WHEN the package.json specifies CommonJS THEN the system SHALL use CommonJS (require/module.exports) consistently across all files
3. WHEN the application code imports a package THEN the system SHALL have that package declared in package.json dependencies
4. WHEN the application starts THEN the system SHALL successfully load all required modules without import errors
5. WHEN running npm install THEN the system SHALL install all dependencies needed for the application to function
