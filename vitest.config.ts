import { defineConfig } from 'vitest/config';
export default defineConfig({ build: { assetsInlineLimit: 0 }, test: { include: ['tests/unit/**/*.test.ts'], coverage: { reporter: ['text'] } } });
