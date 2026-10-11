import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(fileURLToPath(import.meta.url), '../..');

export async function resolve(specifier, context, nextResolve) {
  // Handle @/ path alias
  if (specifier.startsWith('@/')) {
    const relativePath = specifier.slice(2);
    const candidatePaths = [
      path.join(projectRoot, 'src', relativePath + '.ts'),
      path.join(projectRoot, 'src', relativePath + '.tsx'),
      path.join(projectRoot, 'src', relativePath, 'index.ts'),
      path.join(projectRoot, 'src', relativePath),
    ];
    for (const p of candidatePaths) {
      if (existsSync(p)) {
        return {
          url: pathToFileURL(p).href,
          shortCircuit: true,
        };
      }
    }
  }

  // Handle relative imports without extension (e.g. '../types/receipt')
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const candidatePaths = [
      path.resolve(parentDir, specifier + '.ts'),
      path.resolve(parentDir, specifier + '.tsx'),
      path.resolve(parentDir, specifier + '.mjs'),
      path.resolve(parentDir, specifier + '.js'),
      path.resolve(parentDir, specifier, 'index.ts'),
    ];
    for (const p of candidatePaths) {
      if (existsSync(p)) {
        return {
          url: pathToFileURL(p).href,
          shortCircuit: true,
        };
      }
    }
  }

  return nextResolve(specifier, context);
}
