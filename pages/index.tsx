import { useEffect, useState, useCallback } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

// Mock contract data to avoid network errors during development
const MOCK_MODE = true // Set to false when contract is ready

// Game constants
const GRID_WIDTH = 20
const GRID_HEIGHT = 15
const CELL_SIZE = 20

// Food types
const FOOD_TYPES = [
  { color: '#EF4444', points: 3, emoji: '🔴' },
  { color: '#10B981', points: 6, emoji: '🟢' },
  { color: '#8B5CF6', points: 12, emoji: '🟣' }
]

// Farcaster user interface
interface FarcasterUser {
  fid: number
  username: string
  displayName: string
  pfpUrl: string
}

interface Player {
  address: string
  username: string
  displayName: string
  pfpUrl: string
  score: number
  alive: boolean
}

interface SnakeSegment {
  x: number
  y: number
}

interface Food {
  x: number
  y: number
  type: number
}

export default function SlitherMatch() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  // Farcaster user data
  const [currentUser, setCurrentUser] = useState<FarcasterUser | null>(null)
  const [isInFarcaster, setIsInFarcaster] = useState(false)
  const [loading, setLoading] = useState(true)

  // Game state
  const [gameMode, setGameMode] = useState<'lobby' | 'game' | 'spectator' | 'winner'>('lobby')
  const [gameStarted, setGameStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [gameTime, setGameTime] = useState(180)
  const [score, setScore] = useState(0)
  const [winner, setWinner] = useState<Player | null>(null)

  // Lobby state
  const [lobbyId, setLobbyId] = useState<number>(1)
  const [players, setPlayers] = useState<Player[]>([])
  const [isInLobby, setIsInLobby] = useState(false)
  const [canRefund, setCanRefund] = useState(false)
  const [joinTime, setJoinTime] = useState<number | null>(null)

  // Snake game state
  const [snake, setSnake] = useState<SnakeSegment[]>([{ x: 10, y: 7 }])
  const [direction, setDirection] = useState({ x: 1, y: 0 })
  const [food, setFood] = useState<Food>({ x: 5, y: 5, type: 0 })
  const [playerAlive, setPlayerAlive] = useState(true)

  // Initialize Farcaster SDK
  useEffect(() => {
    const initializeFarcaster = async () => {
      try {
        setLoading(true)
        
        // Check if we're in Farcaster environment
        if (typeof window !== 'undefined') {
          const isInFrame = window.self !== window.top
          setIsInFarcaster(isInFrame)
          
          if (isInFrame) {
            // Try to load Farcaster SDK
            try {
              const { sdk } = await import('@farcaster/miniapp-sdk')
              await sdk.ready()
              
              const context = await sdk.context
              console.log('Farcaster context:', context)
              
              if (context?.user) {
                const user = {
                  fid: context.user.fid,
                  username: context.user.username,
                  displayName: context.user.displayName,
                  pfpUrl: context.user.pfpUrl
                }
                setCurrentUser(user)
                console.log('Farcaster user loaded:', user)
              }
            } catch (sdkError) {
              console.log('Farcaster SDK error:', sdkError)
              // Fallback to mock user for development
              setCurrentUser({
                fid: 12345,
                username: 'testuser',
                displayName: 'Test User',
                pfpUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=testuser'
              })
            }
          } else {
            // Not in Farcaster, use mock user for development
            setCurrentUser({
              fid: 12345,
              username: 'localuser',
              displayName: 'Local User',
              pfpUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=localuser'
            })
          }
        }
      } catch (error) {
        console.log('Farcaster initialization error:', error)
        // Fallback user
        setCurrentUser({
          fid: 12345,
          username: 'fallback',
          displayName: 'Fallback User',
          pfpUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=fallback'
        })
      } finally {
        setLoading(false)
      }
    }
    
    initializeFarcaster()
  }, [])

  // Mock players for development
  useEffect(() => {
    if (MOCK_MODE) {
      const mockPlayers: Player[] = [
        {
          address: '0x1234...5678',
          username: 'alice',
          displayName: 'Alice',
          pfpUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=alice',
          score: 15,
          alive: true
        },
        {
          address: '0x9876...5432',
          username: 'bob',
          displayName: 'Bob',
          pfpUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=bob',
          score: 8,
          alive: true
        }
      ]
      
      if (isInLobby && currentUser) {
        const userPlayer: Player = {
          address: address || '0xUser...1234',
          username: currentUser.username,
          displayName: currentUser.displayName,
          pfpUrl: currentUser.pfpUrl,
          score: score,
          alive: playerAlive
        }
        setPlayers([userPlayer, ...mockPlayers])
      } else {
        setPlayers(mockPlayers)
      }
    }
  }, [isInLobby, currentUser, address, score, playerAlive])

  // Handle game start countdown
  useEffect(() => {
    if (players.length >= 3 && !gameStarted && !gameOver && isInLobby) {
      let countdownValue = 30
      setCountdown(countdownValue)
      
      const timer = setInterval(() => {
        countdownValue -= 1
        setCountdown(countdownValue)
        
        if (countdownValue <= 0) {
          clearInterval(timer)
          setGameStarted(true)
          setGameMode('game')
          setCountdown(null)
        }
      }, 1000)
      
      return () => clearInterval(timer)
    }
  }, [players.length, gameStarted, gameOver, isInLobby])

  // Handle game timer
  useEffect(() => {
    if (gameStarted && !gameOver) {
      const timer = setInterval(() => {
        setGameTime(prev => {
          if (prev <= 1) {
            setGameOver(true)
            setGameStarted(false)
            setGameMode('winner')
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [gameStarted, gameOver])

  // Handle refund eligibility
  useEffect(() => {
    if (joinTime && !gameStarted && players.length < 3) {
      const checkRefund = setInterval(() => {
        if (Date.now() - joinTime >= 300000) { // 5 minutes
          setCanRefund(true)
        }
      }, 1000)
      return () => clearInterval(checkRefund)
    }
  }, [joinTime, gameStarted, players.length])

  // Join lobby
  const joinLobby = async () => {
    if (!currentUser) {
      alert('Please wait for Farcaster to load your profile')
      return
    }

    if (!isConnected) {
      if (connectors.length > 0) {
        await connect({ connector: connectors[0] })
      }
      return
    }

    // In development mode, just join immediately
    if (MOCK_MODE) {
      setIsInLobby(true)
      setJoinTime(Date.now())
      return
    }

    // TODO: Implement real contract interaction
    try {
      // await writeContract({
      //   address: CONTRACT_ADDRESS,
      //   abi: slitherMatchABI,
      //   functionName: 'joinLobby',
      //   args: [lobbyId],
      //   value: BigInt(1e15) // 0.001 ETH
      // })
      setIsInLobby(true)
      setJoinTime(Date.now())
    } catch (error) {
      console.error('Error joining lobby:', error)
    }
  }

  // Request refund
  const requestRefund = async () => {
    if (!isConnected || !address) return

    try {
      // TODO: Implement real contract interaction
      setIsInLobby(false)
      setCanRefund(false)
      setJoinTime(null)
    } catch (error) {
      console.error('Error requesting refund:', error)
    }
  }

  // Share win on Farcaster
  const shareWin = () => {
    const text = `I just won a SlitherMatch game! 🐍🎮\n\nScore: ${score} points\nEarned: $${players.length} USD\n\nJoin the snake battle at slithermatch.xyz`
    
    if (isInFarcaster) {
      // Try to use Farcaster's share function
      try {
        const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`
        window.open(url, '_blank')
      } catch (error) {
        console.error('Error sharing:', error)
      }
    } else {
      // Fallback to regular share
      const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`
      window.open(url, '_blank')
    }
  }

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3E8FF] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-bold text-gray-800 mb-4">SlitherMatch</div>
          <div className="text-lg text-gray-600">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F3E8FF] p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header with user info */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">SlitherMatch</h1>
          
          {/* User info in top right area */}
          {currentUser && (
            <div className="flex items-center justify-center gap-2 mb-2">
              <img 
                src={currentUser.pfpUrl} 
                alt={currentUser.username}
                className="w-8 h-8 rounded-full border-2 border-purple-300"
              />
              <div className="text-left">
                <div className="text-sm font-semibold text-gray-800">{currentUser.displayName}</div>
                <div className="text-xs text-gray-600">@{currentUser.username}</div>
              </div>
            </div>
          )}
          
          {isInFarcaster && (
            <div className="text-xs text-purple-600 mb-2">
              🟣 Connected via Farcaster
            </div>
          )}
        </div>

        {/* Game Area */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-4">
          {/* Game Header */}
          <div className="bg-gray-50 p-4 border-b">
            <div className="flex justify-between items-center">
              <div className="text-sm">
                <div className="font-semibold">Lobby ID: {lobbyId}</div>
                <div className="text-gray-600">Players: {players.length}/5</div>
              </div>
              <div className="text-right">
                {gameStarted && (
                  <div className="text-lg font-bold text-gray-800">
                    Time: {formatTime(gameTime)}
                  </div>
                )}
                {gameStarted && (
                  <div className="text-sm text-gray-600">Score: {score}</div>
                )}
              </div>
            </div>
          </div>

          {/* Join Lobby Button */}
          {gameMode === 'lobby' && !isInLobby && (
            <div className="p-4 border-b">
              <button
                onClick={joinLobby}
                disabled={players.length >= 5}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg text-lg transition-colors"
              >
                Join Lobby
                <span className="block text-sm opacity-80">$1 entry</span>
              </button>
            </div>
          )}

          {/* Game Board */}
          <div className="p-4">
            <div 
              className="relative bg-gray-100 rounded-lg border-2 border-gray-300 mx-auto"
              style={{ width: GRID_WIDTH * CELL_SIZE, height: GRID_HEIGHT * CELL_SIZE }}
            >
              {/* Grid dots */}
              {Array.from({ length: GRID_HEIGHT }, (_, y) =>
                Array.from({ length: GRID_WIDTH }, (_, x) => (
                  <div
                    key={`${x}-${y}`}
                    className="absolute w-1 h-1 bg-gray-300 rounded-full"
                    style={{
                      left: x * CELL_SIZE + CELL_SIZE / 2 - 2,
                      top: y * CELL_SIZE + CELL_SIZE / 2 - 2,
                    }}
                  />
                ))
              )}

              {/* Food */}
              <div
                className="absolute rounded-full transition-all duration-200"
                style={{
                  left: food.x * CELL_SIZE + 2,
                  top: food.y * CELL_SIZE + 2,
                  width: CELL_SIZE - 4,
                  height: CELL_SIZE - 4,
                  backgroundColor: FOOD_TYPES[food.type].color,
                }}
              />

              {/* Game status overlays */}
              {!gameStarted && !gameOver && countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                  <div className="text-white text-center">
                    <div className="text-3xl font-bold mb-2">{countdown}</div>
                    <div className="text-lg">Game starting...</div>
                  </div>
                </div>
              )}

              {!gameStarted && !gameOver && countdown === null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
                  <div className="text-white text-center">
                    <div className="text-xl font-semibold mb-2">Waiting for players...</div>
                    <div className="text-sm">Need {Math.max(0, 3 - players.length)} more players</div>
                  </div>
                </div>
              )}

              {gameMode === 'winner' && winner && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                  <div className="text-white text-center">
                    <div className="text-2xl font-bold mb-2">🎉 Game Over!</div>
                    <div className="text-lg mb-2">Winner: {winner.displayName}</div>
                    <div className="text-lg mb-4">Final Score: {score}</div>
                    <button
                      onClick={shareWin}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                    >
                      Share Win 🎉
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Game controls info */}
            {gameStarted && (
              <div className="text-center text-sm text-gray-600 mt-3">
                Use arrow keys to control your snake
              </div>
            )}
          </div>
        </div>

        {/* Players List */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <h3 className="font-semibold mb-3 text-gray-800">Players in Lobby</h3>
          {players.length === 0 ? (
            <div className="text-gray-500 text-center py-4">No players yet</div>
          ) : (
            <div className="space-y-2">
              {players.map((player, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <img 
                      src={player.pfpUrl} 
                      alt={player.username}
                      className="w-10 h-10 rounded-full border-2 border-purple-200"
                    />
                    <div>
                      <div className="font-semibold text-gray-800">{player.displayName}</div>
                      <div className="text-sm text-gray-600">@{player.username}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        {player.address.slice(0, 6)}...{player.address.slice(-4)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-800">{player.score} pts</div>
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      player.alive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {player.alive ? '🟢 Alive' : '🔴 Dead'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Waiting message */}
          {isInLobby && !gameStarted && players.length < 3 && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-lg text-center">
              <div className="font-semibold">Waiting for players...</div>
              <div className="text-sm">Need {Math.max(0, 3 - players.length)} more players to start</div>
            </div>
          )}

          {/* Refund button */}
          {canRefund && isInLobby && (
            <button
              onClick={requestRefund}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Request Refund (5+ min wait)
            </button>
          )}

          {/* Bot mode button */}
          <a
            href="/bot"
            className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition-colors"
          >
            🤖 Play Bot Match (Free)
          </a>

          {/* Spectate button */}
          <a
            href="/spectator"
            className="block w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition-colors"
          >
            👀 Spectate Current Match
          </a>

          {/* Wallet connection */}
          {!isConnected ? (
            <button
              onClick={() => connectors.length > 0 && connect({ connector: connectors[0] })}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={() => disconnect()}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Disconnect ({address?.slice(0, 6)}...{address?.slice(-4)})
            </button>
          )}
        </div>

        {/* Game Rules */}
        <div className="bg-white rounded-lg shadow-lg p-4 mt-4">
          <h3 className="font-semibold mb-3 text-gray-800">Game Rules</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-red-500">🔴</span>
                <span>Red dots = 3 points</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">🟢</span>
                <span>Green dots = 6 points</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-500">🟣</span>
                <span>Purple dots = 12 points</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span>⏱️</span>
                <span>Game lasts 3 minutes max</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🏆</span>
                <span>Winner: Last alive OR highest score</span>
              </div>
              <div className="flex items-center gap-2">
                <span>💰</span>
                <span>Winner takes 100% of entry fees</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}