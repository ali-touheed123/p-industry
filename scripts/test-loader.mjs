import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Register custom hook for path aliases and extension resolution
register('./test-resolver-hook.mjs', pathToFileURL(import.meta.filename));
