import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface FarcasterUser {
  fid: number
  username: string
  displayName: string
  pfpUrl: string
}

interface FarcasterContextType {
  user: FarcasterUser | null
  isLoading: boolean
  isMiniApp: boolean
  error: string | null
  ready: () => void
}

const FarcasterContext = createContext<FarcasterContextType | undefined>(undefined)

interface FarcasterProviderProps {
  children: ReactNode
}

export function FarcasterProvider({ children }: FarcasterProviderProps) {
  const [user, setUser] = useState<FarcasterUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMiniApp, setIsMiniApp] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initializeFarcaster()
  }, [])

  const initializeFarcaster = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Check if we're in a miniapp environment
      const isMiniAppEnv = 
        typeof window !== 'undefined' && 
        (window.location.href.includes('warpcast.com') ||
         window.location.href.includes('coinbase.com') ||
         window.parent !== window ||
         navigator.userAgent.includes('Warpcast') ||
         navigator.userAgent.includes('Coinbase'))

      setIsMiniApp(isMiniAppEnv)

      if (isMiniAppEnv) {
        // Import the Farcaster SDK dynamically
        const { sdk } = await import('@farcaster/miniapp-sdk')
        
        // Get user context from the SDK
        const context = await sdk.context
        
        if (context?.user) {
          setUser({
            fid: context.user.fid,
            username: context.user.username,
            displayName: context.user.displayName,
            pfpUrl: context.user.pfpUrl,
          })
        } else {
          // Fallback for development or if context is not available
          setUser({
            fid: 1,
            username: 'testuser',
            displayName: 'Test User',
            pfpUrl: '/default-avatar.png',
          })
        }
      } else {
        // Not in miniapp - set default user for development
        setUser({
          fid: 1,
          username: 'webuser',
          displayName: 'Web User',
          pfpUrl: '/default-avatar.png',
        })
      }
    } catch (err) {
      console.error('Failed to initialize Farcaster:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize Farcaster')
      
      // Fallback user
      setUser({
        fid: 1,
        username: 'fallback',
        displayName: 'Fallback User',
        pfpUrl: '/default-avatar.png',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const ready = async () => {
    try {
      if (isMiniApp) {
        const { sdk } = await import('@farcaster/miniapp-sdk')
        sdk.ready()
      }
    } catch (err) {
      console.error('Failed to signal ready:', err)
    }
  }

  const value = {
    user,
    isLoading,
    isMiniApp,
    error,
    ready,
  }

  return (
    <FarcasterContext.Provider value={value}>
      {children}
    </FarcasterContext.Provider>
  )
}

export function useFarcaster() {
  const context = useContext(FarcasterContext)
  if (context === undefined) {
    throw new Error('useFarcaster must be used within a FarcasterProvider')
  }
  return context
}

// Additional hook for getting Farcaster user data with Neynar fallback
export function useFarcasterUser(fid?: number) {
  const [userData, setUserData] = useState<FarcasterUser | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!fid) return

    const fetchUserData = async () => {
      setLoading(true)
      try {
        // Try to fetch from Neynar API as fallback
        const response = await fetch(`/api/farcaster/user/${fid}`)
        if (response.ok) {
          const data = await response.json()
          setUserData(data)
        }
      } catch (err) {
        console.error('Failed to fetch user data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [fid])

  return { userData, loading }
}