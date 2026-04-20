import { useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
import '@solana/wallet-adapter-react-ui/styles.css'
import './styles/index.css'

import { Nav } from './components/Nav'
import { LandingPage } from './pages/LandingPage'
import { TraderTerminal } from './pages/TraderTerminal'
import { AuctionRoom } from './pages/AuctionRoom'
import { ComplianceView } from './pages/ComplianceView'
import { AdminOpsView } from './pages/AdminOpsView'
import { useAppStore } from './store/useAppStore'

function AppContent() {
  const { activeView } = useAppStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      <Nav />
      {activeView === 'landing'     && <LandingPage />}
      {activeView === 'terminal'    && <TraderTerminal />}
      {activeView === 'auction'     && <AuctionRoom />}
      {activeView === 'compliance'  && <ComplianceView />}
      {activeView === 'admin'       && <AdminOpsView />}
    </div>
  )
}

export default function App() {
  const network = WalletAdapterNetwork.Devnet
  const endpoint = useMemo(() => clusterApiUrl(network), [network])
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], [network])

  return (
    <>
      {/* Animated background */}
      <div className="app-bg" aria-hidden="true" />

      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <AppContent />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </>
  )
}
