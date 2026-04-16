import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createWeb3Modal } from '@web3modal/wagmi/react'
import { http, type Transport } from 'viem'
import { WagmiProvider, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'

import { appConfig } from './config'

const queryClient = new QueryClient()

const transports: Record<number, Transport> = {
  [appConfig.chain.id]: http(appConfig.rpcUrl),
}

const wagmiConfig = createConfig({
  chains: [appConfig.chain],
  transports,
  connectors: [injected()],
})

// Optional: Web3Modal requires a WalletConnect/Reown project id.
// If not set, the app still works with injected wallets (e.g. MetaMask).
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined
if (projectId) {
  createWeb3Modal({
    wagmiConfig,
    projectId,
    enableAnalytics: false,
  })
}

export function Web3Provider(props: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
    </WagmiProvider>
  )
}

