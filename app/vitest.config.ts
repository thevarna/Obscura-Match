import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'playwright'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**', 'src/store/**', 'src/components/**'],
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
    'import.meta.env.VITE_TEE_URL':         JSON.stringify('https://devnet-tee.magicblock.app'),
    'import.meta.env.VITE_TEE_WS_URL':      JSON.stringify('wss://devnet-tee.magicblock.app'),
    'import.meta.env.VITE_TEE_VALIDATOR':   JSON.stringify('MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo'),
    'import.meta.env.VITE_CLUSTER':         JSON.stringify('devnet'),
    'import.meta.env.VITE_PAYMENTS_API':    JSON.stringify('https://payments.magicblock.app/v1/spl'),
    'import.meta.env.VITE_PERMISSION_PROGRAM': JSON.stringify('ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1'),
    'import.meta.env.VITE_DELEGATION_PROGRAM': JSON.stringify('DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh'),
    'import.meta.env.VITE_USDC_MINT':       JSON.stringify('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
    'import.meta.env.VITE_SOL_MINT':        JSON.stringify('So11111111111111111111111111111111111111112'),
  },
  resolve: {
    alias: { stream: 'stream-browserify', buffer: 'buffer' },
  },
})
