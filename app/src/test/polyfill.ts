// Pre-setup: runs BEFORE the test environment is configured.
// This fixes the TextEncoder/TextDecoder issue with @noble/hashes
// and @mswjs/interceptors in jsdom.

import { TextEncoder, TextDecoder } from 'node:util'
import { ReadableStream, WritableStream, TransformStream } from 'node:stream/web'

// Apply globally BEFORE any module imports in tests
globalThis.TextEncoder = TextEncoder
globalThis.TextDecoder = TextDecoder as any

if (typeof global !== 'undefined') {
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder as any
}

if (typeof window !== 'undefined') {
  (window as any).TextEncoder = TextEncoder;
  (window as any).TextDecoder = TextDecoder;
}

if (!globalThis.ReadableStream) {
  globalThis.ReadableStream = ReadableStream as any
  globalThis.WritableStream = WritableStream as any
  globalThis.TransformStream = TransformStream as any
}
