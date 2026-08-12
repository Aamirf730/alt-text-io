import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['netlify-functions-tests/**/*.test.{js,ts}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['**/*.js'],
            exclude: ['node_modules', '*.config.*', '**/*.test.*'],
        },
    },
});
