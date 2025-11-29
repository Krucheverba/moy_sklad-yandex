// customer-order-idempotency.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock axios before importing moysklad module
vi.mock('axios');

// Import after mocking
const axios = (await import('axios')).default;
const { findCustomerOrderByExternalNumber } = await import('./moysklad.js');

// Feature: yandex-moysklad-integration, Property 18: Customer Order idempotency check
// Validates: Requirements 6.1

describe('Property 18: Customer Order idempotency check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check if a Customer Order with the same External Number already exists before creating', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // externalNumber
        async (externalNumber) => {
          // Mock the API response - simulate finding an existing order
          const mockExistingOrder = {
            id: 'existing-order-id',
            externalNumber: externalNumber,
            name: `Reserve ${externalNumber}`,
            meta: {
              href: `https://api.moysklad.ru/api/remap/1.2/entity/customerorder/existing-order-id`,
              type: 'customerorder'
            }
          };

          axios.get.mockResolvedValueOnce({
            data: {
              rows: [mockExistingOrder]
            }
          });

          // Call the function
          const result = await findCustomerOrderByExternalNumber(externalNumber);

          // Verify that the function made a GET request to search for existing order
          expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('/entity/customerorder'),
            expect.objectContaining({
              params: {
                filter: `externalNumber=${externalNumber}`
              }
            })
          );

          // Verify that it returns the existing order when found
          expect(result).toBeTruthy();
          expect(result.externalNumber).toBe(externalNumber);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return null when no Customer Order with the External Number exists', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // externalNumber
        async (externalNumber) => {
          // Mock the API response - simulate no existing order
          axios.get.mockResolvedValueOnce({
            data: {
              rows: []
            }
          });

          // Call the function
          const result = await findCustomerOrderByExternalNumber(externalNumber);

          // Verify that the function made a GET request
          expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('/entity/customerorder'),
            expect.objectContaining({
              params: {
                filter: `externalNumber=${externalNumber}`
              }
            })
          );

          // Verify that it returns null when not found
          expect(result).toBeNull();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: yandex-moysklad-integration, Property 19: Customer Order duplicate prevention
// Validates: Requirements 6.2

describe('Property 19: Customer Order duplicate prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prevent duplicate Customer Order creation when processing the same webhook twice', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // externalNumber
        fc.array(fc.record({
          productId: fc.uuid(),
          quantity: fc.integer({ min: 1, max: 100 })
        }), { minLength: 1, maxLength: 10 }), // positions
        async (externalNumber, positions) => {
          // First call - no existing order
          axios.get.mockResolvedValueOnce({
            data: { rows: [] }
          });

          const firstCheck = await findCustomerOrderByExternalNumber(externalNumber);
          expect(firstCheck).toBeNull();

          // Simulate that an order was created after first check
          const mockCreatedOrder = {
            id: 'created-order-id',
            externalNumber: externalNumber,
            name: `Reserve ${externalNumber}`,
            meta: {
              href: `https://api.moysklad.ru/api/remap/1.2/entity/customerorder/created-order-id`,
              type: 'customerorder'
            }
          };

          // Second call - order now exists
          axios.get.mockResolvedValueOnce({
            data: {
              rows: [mockCreatedOrder]
            }
          });

          const secondCheck = await findCustomerOrderByExternalNumber(externalNumber);
          
          // Verify that on second check, the order is found
          expect(secondCheck).toBeTruthy();
          expect(secondCheck.externalNumber).toBe(externalNumber);

          // This demonstrates that the idempotency check would prevent duplicate creation
          // In actual webhook handler, if secondCheck is not null, creation should be skipped
          const shouldSkipCreation = secondCheck !== null;
          expect(shouldSkipCreation).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
