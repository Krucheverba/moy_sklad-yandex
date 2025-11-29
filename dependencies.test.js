// dependencies.test.js
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Feature: yandex-moysklad-integration, Property 34: Dependency declaration
// Validates: Requirements 10.3

describe('Property 34: Dependency declaration', () => {
  it('should have all imported packages declared in package.json dependencies', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('index.js', 'moysklad.js', 'generate-mapping.js'),
        (filename) => {
          // Read the source file
          const filePath = path.join(__dirname, filename);
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          
          // Extract all require() statements
          const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
          const imports = [];
          let match;
          
          while ((match = requireRegex.exec(fileContent)) !== null) {
            const importName = match[1];
            // Skip relative imports (starting with ./ or ../)
            if (!importName.startsWith('.') && !importName.startsWith('/')) {
              imports.push(importName);
            }
          }
          
          // Read package.json
          const packageJson = JSON.parse(
            fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8')
          );
          
          const dependencies = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies
          };
          
          // Check that all non-builtin imports are in dependencies
          const builtinModules = [
            'fs', 'path', 'http', 'https', 'crypto', 'util', 
            'stream', 'events', 'buffer', 'url', 'querystring',
            'os', 'child_process', 'cluster', 'net', 'dns',
            'readline', 'zlib', 'assert', 'tty', 'vm'
          ];
          
          for (const importName of imports) {
            // Skip Node.js builtin modules
            if (builtinModules.includes(importName)) {
              continue;
            }
            
            // Check if the import is declared in dependencies
            expect(
              dependencies,
              `Package "${importName}" imported in ${filename} should be declared in package.json dependencies`
            ).toHaveProperty(importName);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
