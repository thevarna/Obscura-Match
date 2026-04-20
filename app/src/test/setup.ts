import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Polyfill TextEncoder/Decoder for @solana packages in jsdom
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder as unknown as typeof global.TextEncoder
global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder

// Mock @solana/wallet-adapter-react so components can render without Provider errors
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: null, connected: false,
    disconnect: vi.fn(), signMessage: vi.fn(),
    wallet: null,
  }),
  useConnection: () => ({ connection: {} }),
  ConnectionProvider: ({ children }: any) => children,
  WalletProvider: ({ children }: any) => children,
}))

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  WalletModalProvider: ({ children }: any) => children,
  useWalletModal: () => ({ setVisible: vi.fn() }),
}))

// Suppress console.warn in tests
global.console.warn = vi.fn()
