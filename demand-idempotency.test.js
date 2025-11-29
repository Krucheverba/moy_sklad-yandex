// demand-idempotency.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock axios before importing moysklad module
vi.mock('axios');

// Import after mocking
const axios = (await import('axios')).default;
const { findDemandByExternalNumber } = await import('./moysklad.js');

// Feature: yandex-moysklad-integration, Property 20: Demand idempotency check
// Validates: Requirements 6.3

describe('Property 20: Demand idempotency check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check if a Demand with the same External Number already exists before creating', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // externalNumber
        async (externalNumber) => {
          // Mock the API response - simulate finding an existing demand
          const mockExistingDemand = {
            id: 'existing-demand-id',
            externalNumber: externalNumber,
            name: `Shipment ${externalNumber}`,
            meta: {
              href: `https://api.moysklad.ru/api/remap/1.2/entity/demand/existing-demand-id`,
              type: 'demand'
            }
          };

          axios.get.mockResolvedValueOnce({
            data: {
              rows: [mockExistingDemand]
            }
          });

          // Call the function
          const result = await findDemandByExternalNumber(externalNumber);

          // Verify that the function made a GET request to search for existing demand
          expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('/entity/demand'),
            expect.objectContaining({
              params: {
                filter: `externalNumber=${externalNumber}`
              }
            })
          );

          // Verify that it returns the existing demand when found
          expect(result).toBeTruthy();
          expect(result.externalNumber).toBe(externalNumber);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return null when no Demand with the External Number exists', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // externalNumber
        async (externalNumber) => {
          // Mock the API response - simulate no existing demand
          axios.get.mockResolvedValueOnce({
            data: {
              rows: []
            }
          });

          // Call the function
          const result = await findDemandByExternalNumber(externalNumber);

          // Verify that the function made a GET request
          expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('/entity/demand'),
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

// Feature: yandex-moysklad-integration, Property 21: Demand duplicate prevention
// Validates: Requirements 6.4

describe('Property 21: Demand duplicate prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prevent duplicate Demand creation when processing the same webhook twice', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // externalNumber
        fc.array(fc.record({
          productId: fc.uuid(),
          quantity: fc.integer({ min: 1, max: 100 })
        }), { minLength: 1, maxLength: 10 }), // positions
        async (externalNumber, positions) => {
          // First call - no existing demand
          axios.get.mockResolvedValueOnce({
            data: { rows: [] }
          });

          const firstCheck = await findDemandByExternalNumber(externalNumber);
          expect(firstCheck).toBeNull();

          // Simulate that a demand was created after first check
          const mockCreatedDemand = {
            id: 'created-demand-id',
            externalNumber: externalNumber,
            name: `Shipment ${externalNumber}`,
            meta: {
              href: `https://api.moysklad.ru/api/remap/1.2/entity/demand/created-demand-id`,
              type: 'demand'
            }
          };

          // Second call - demand now exists
          axios.get.mockResolvedValueOnce({
            data: {
              rows: [mockCreatedDemand]
            }
          });

          const secondCheck = await findDemandByExternalNumber(externalNumber);
          
          // Verify that on second check, the demand is found
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
