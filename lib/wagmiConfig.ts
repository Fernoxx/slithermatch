import { http, createConfig } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'your-project-id'

export const config = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    injected({
      target: 'metaMask',
    }),
    coinbaseWallet({
      appName: 'SlitherMatch',
      appLogoUrl: 'https://slithermatch.vercel.app/icon.png',
    }),
    walletConnect({
      projectId,
      metadata: {
        name: 'SlitherMatch',
        description: 'Multiplayer snake game on Base',
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

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}