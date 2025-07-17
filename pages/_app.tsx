import "@/styles/globals.css"
import type { AppProps } from "next/app"
import { WagmiProvider } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { config } from "@/lib/wagmiConfig"
import { FarcasterProvider } from "@/contexts/FarcasterContext"
import { useState, useEffect } from "react"

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent hydration mismatch
  if (!mounted) {
    return null
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <FarcasterProvider>
          <Component {...pageProps} />
        </FarcasterProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}