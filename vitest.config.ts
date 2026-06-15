import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['tests/game.test.ts', 'node_modules'],
  },
});
