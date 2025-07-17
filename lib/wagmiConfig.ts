import { http, createConfig } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'
import { createMiniAppWagmiConnector } from '@farcaster/miniapp-wagmi-connector'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'your-project-id'

// Farcaster miniapp connector
const miniAppConnector = createMiniAppWagmiConnector({
  name: 'SlitherMatch',
  description: 'Multiplayer snake game on Base',
  icon: 'https://slithermatch.vercel.app/icon.png',
})

export const config = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    miniAppConnector,
    injected({
      target: 'metaMask',
    }),
    coinbaseWallet({
      appName: 'SlitherMatch',
      appLogoUrl: 'https://slithermatch.vercel.app/icon.png',
      preference: 'smartWalletOnly',
    }),
    walletConnect({
      projectId,
      metadata: {
        name: 'SlitherMatch',
        description: 'Multiplayer snake game on Base with $1 USDC entry',
        url: 'https://slithermatch.vercel.app',
        icons: ['https://slithermatch.vercel.app/icon.png']
      }
    }),
  ],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
})

// Contract addresses
export const CONTRACT_ADDRESSES = {
  [base.id]: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_BASE || '',
  [baseSepolia.id]: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_BASE_SEPOLIA || '',
}

// USDC addresses
export const USDC_ADDRESSES = {
  [base.id]: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
}

// Entry fee in USDC (6 decimals): $1 = 1000000
export const ENTRY_FEE = 1000000n

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}