import { execSync } from 'node:child_process';

if (process.env.VERCEL_ENV === 'preview') {
    if (!process.env.DATABASE_URL_UNPOOLED) {
        console.error('DATABASE_URL_UNPOOLED is not set for preview build');
        process.exit(1);
    }

    execSync('npx drizzle-kit migrate', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_UNPOOLED },
    });
}

execSync('npx vite build', { stdio: 'inherit' });
