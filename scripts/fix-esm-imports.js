#!/usr/bin/env node

import { readFileSync, writeFileSync, statSync } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join, extname, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Fix ESM imports by adding .js extensions to relative imports
 */
async function fixEsmImports(dir) {
  const entries = await readdir(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = await stat(fullPath);

    if (stats.isDirectory()) {
      await fixEsmImports(fullPath);
    } else if (extname(entry) === '.js') {
      let content = readFileSync(fullPath, 'utf8');

      // Fix relative imports - add .js extension if not present
      content = content.replace(
        /from\s+['"](\.\S*?)['"];?/g,
        (match, importPath) => {
          // Skip if already has extension or is not a relative import
          if (extname(importPath) || !importPath.startsWith('.')) {
            return match;
          }

          // Check if this is a directory import that should be index.js
          const absolutePath = join(dirname(fullPath), importPath);
          try {
            const stats = statSync(absolutePath + '.js');
            // If .js file exists, add .js extension
            const fixed = match.replace(importPath, importPath + '.js');
            console.log(`Fixed: ${importPath} -> ${importPath}.js in ${relative(process.cwd(), fullPath)}`);
            return fixed;
          } catch {
            try {
              // Check if it's a directory with index.js
              const indexPath = join(absolutePath, 'index.js');
              statSync(indexPath);
              const fixed = match.replace(importPath, importPath + '/index.js');
              console.log(`Fixed directory import: ${importPath} -> ${importPath}/index.js in ${relative(process.cwd(), fullPath)}`);
              return fixed;
            } catch {
              // Default to adding .js extension
              const fixed = match.replace(importPath, importPath + '.js');
              console.log(`Fixed (fallback): ${importPath} -> ${importPath}.js in ${relative(process.cwd(), fullPath)}`);
              return fixed;
            }
          }
        }
      );

      // Also fix dynamic imports
      content = content.replace(
        /import\s*\(\s*['"](\.\S*?)['"]s*\)/g,
        (match, importPath) => {
          if (extname(importPath) || !importPath.startsWith('.')) {
            return match;
          }

          const fixed = match.replace(importPath, importPath + '.js');
          console.log(`Fixed dynamic import: ${importPath} -> ${importPath}.js in ${relative(process.cwd(), fullPath)}`);
          return fixed;
        }
      );

      writeFileSync(fullPath, content, 'utf8');
    }
  }
}

// Run the fix
const distDir = join(__dirname, '..', 'dist');
console.log('Fixing ESM imports in dist directory...');
fixEsmImports(distDir)
  .then(() => {
    console.log('✅ ESM import fixing completed!');
  })
  .catch((error) => {
    console.error('❌ Error fixing ESM imports:', error);
    process.exit(1);
  });
