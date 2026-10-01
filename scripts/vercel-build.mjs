import { execSync } from 'node:child_process';

// Migrations are not run here: the shared `staging` branch is migrated only by CI after green tests (#75).
execSync('npx vite build', { stdio: 'inherit' });
