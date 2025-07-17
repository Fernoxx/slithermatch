import { useEffect, useState, useCallback, useRef } from 'react'
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { io, Socket } from 'socket.io-client'
import { useFarcaster } from '@/contexts/FarcasterContext'
import { CONTRACT_ADDRESSES, USDC_ADDRESSES, ENTRY_FEE } from '@/lib/wagmiConfig'
import { slitherMatchABI } from '@/lib/slitherMatchABI'
import { Wallet, Users, Play, Eye, Trophy, Clock, DollarSign } from 'lucide-react'

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

interface Player {
  address?: string
  username: string
  displayName: string
  pfpUrl: string
  score: number
  alive: boolean
  fid?: number
}

interface SnakeSegment {
  x: number
  y: number
}

interface Snake {
  segments: SnakeSegment[]
  direction: { x: number; y: number }
  color: string
  alive: boolean
}

interface Food {
  x: number
  y: number
  type: number
}

interface GameState {
  snakes: [string, Snake][]
  foods: Food[]
  scores: { playerId: string; score: number; alive: boolean }[]
  timeRemaining: number
}

interface LobbyData {
  lobbyId: string
  players: [string, Player][]
  state: 'waiting' | 'active' | 'completed'
  isBot?: boolean
}

const USDC_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export default function SlitherMatch() {
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { user: farcasterUser, isLoading: farcasterLoading, isMiniApp, ready } = useFarcaster()

  // Game state
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'spectating' | 'ended'>('lobby')
  const [currentLobby, setCurrentLobby] = useState<LobbyData | null>(null)
  const [snakes, setSnakes] = useState<Map<string, Snake>>(new Map())
  const [foods, setFoods] = useState<Food[]>([])
  const [scores, setScores] = useState<{ playerId: string; score: number; alive: boolean }[]>([])
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [winner, setWinner] = useState<string | null>(null)
  const [isSpectator, setIsSpectator] = useState(false)

  // Socket connection
  const [socket, setSocket] = useState<Socket | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Contract interactions
  const contractAddress = chainId ? CONTRACT_ADDRESSES[chainId] : undefined
  const usdcAddress = chainId ? USDC_ADDRESSES[chainId] : undefined

  const { writeContract: writeSlitherMatch, data: slitherMatchTxHash, isPending: isSlitherMatchPending } = useWriteContract()
  const { writeContract: writeUSDC, data: usdcTxHash, isPending: isUSDCPending } = useWriteContract()

  const { isLoading: isSlitherMatchTxLoading, isSuccess: isSlitherMatchTxSuccess } = useWaitForTransactionReceipt({
    hash: slitherMatchTxHash,
  })

  const { isLoading: isUSDCTxLoading, isSuccess: isUSDCTxSuccess } = useWaitForTransactionReceipt({
    hash: usdcTxHash,
  })

  // Read USDC balance
  const { data: usdcBalance } = useReadContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  // Read USDC allowance
  const { data: usdcAllowance } = useReadContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address && contractAddress ? [address, contractAddress] : undefined,
  })

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001')
    setSocket(socketInstance)

    socketInstance.on('joinedLobby', (data: LobbyData) => {
      setCurrentLobby(data)
      setGameState('lobby')
      setIsSpectator(false)
    })

    socketInstance.on('joinedAsSpectator', (data: any) => {
      setCurrentLobby(data)
      setGameState('spectating')
      setIsSpectator(true)
      if (data.state === 'active') {
        setSnakes(new Map(data.snakes))
        setFoods(data.foods)
      }
    })

    socketInstance.on('gameStarted', (data: any) => {
      setGameState('playing')
      setSnakes(new Map(data.snakes))
      setFoods(data.foods)
      setTimeRemaining(180000) // 3 minutes
    })

    socketInstance.on('gameState', (data: GameState) => {
      setSnakes(new Map(data.snakes))
      setFoods(data.foods)
      setScores(data.scores)
      setTimeRemaining(data.timeRemaining)
    })

    socketInstance.on('gameEnded', (data: any) => {
      setGameState('ended')
      setWinner(data.winner)
      setScores(data.finalScores)
    })

    socketInstance.on('playerJoined', (data: any) => {
      if (currentLobby) {
        setCurrentLobby(prev => prev ? {
          ...prev,
          players: [...prev.players, [data.playerId, data.playerData]]
        } : null)
      }
    })

    socketInstance.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message)
      alert(data.message)
    })

    return () => {
      socketInstance.disconnect()
    }
  }, [])

  // Signal ready to Farcaster when component mounts
  useEffect(() => {
    if (isMiniApp && !farcasterLoading) {
      ready()
    }
  }, [isMiniApp, farcasterLoading, ready])

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameState !== 'playing' || !socket) return

      let direction: { x: number; y: number } | null = null
      
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          direction = { x: 0, y: -1 }
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          direction = { x: 0, y: 1 }
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          direction = { x: -1, y: 0 }
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          direction = { x: 1, y: 0 }
          break
      }

      if (direction) {
        e.preventDefault()
        socket.emit('changeDirection', { direction })
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [gameState, socket])

  // Canvas rendering
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#F3E8FF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw grid
    ctx.strokeStyle = '#E5D3FF'
    ctx.lineWidth = 1
    for (let x = 0; x <= GRID_WIDTH; x++) {
      ctx.beginPath()
      ctx.moveTo(x * CELL_SIZE, 0)
      ctx.lineTo(x * CELL_SIZE, GRID_HEIGHT * CELL_SIZE)
      ctx.stroke()
    }
    for (let y = 0; y <= GRID_HEIGHT; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * CELL_SIZE)
      ctx.lineTo(GRID_WIDTH * CELL_SIZE, y * CELL_SIZE)
      ctx.stroke()
    }

    // Draw food
    foods.forEach(food => {
      const foodType = FOOD_TYPES[food.type]
      ctx.fillStyle = foodType.color
      ctx.fillRect(
        food.x * CELL_SIZE + 2,
        food.y * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4
      )
    })

    // Draw snakes
    snakes.forEach((snake, playerId) => {
      if (!snake.alive) return

      snake.segments.forEach((segment, index) => {
        ctx.fillStyle = index === 0 ? snake.color : `${snake.color}CC`
        ctx.fillRect(
          segment.x * CELL_SIZE + 1,
          segment.y * CELL_SIZE + 1,
          CELL_SIZE - 2,
          CELL_SIZE - 2
        )

        if (index === 0) {
          // Draw eyes on head
          ctx.fillStyle = 'white'
          ctx.fillRect(segment.x * CELL_SIZE + 4, segment.y * CELL_SIZE + 4, 3, 3)
          ctx.fillRect(segment.x * CELL_SIZE + 13, segment.y * CELL_SIZE + 4, 3, 3)
          ctx.fillStyle = 'black'
          ctx.fillRect(segment.x * CELL_SIZE + 5, segment.y * CELL_SIZE + 5, 1, 1)
          ctx.fillRect(segment.x * CELL_SIZE + 14, segment.y * CELL_SIZE + 5, 1, 1)
        }
      })
    })
  }, [snakes, foods])

  const approveUSDC = useCallback(async () => {
    if (!contractAddress || !usdcAddress) return

    writeUSDC({
      address: usdcAddress,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [contractAddress, ENTRY_FEE],
    })
  }, [contractAddress, usdcAddress, writeUSDC])

  const joinLobby = useCallback(async () => {
    if (!contractAddress || !socket || !farcasterUser) return

    try {
      // Check USDC allowance
      const hasAllowance = usdcAllowance && usdcAllowance >= ENTRY_FEE

      if (!hasAllowance) {
        await approveUSDC()
        return
      }

      // Join contract lobby
      writeSlitherMatch({
        address: contractAddress,
        abi: slitherMatchABI,
        functionName: 'joinLobby',
        args: [0n], // 0 means join any available lobby
      })
    } catch (error) {
      console.error('Error joining lobby:', error)
    }
  }, [contractAddress, socket, farcasterUser, usdcAllowance, approveUSDC, writeSlitherMatch])

  const joinSocketLobby = useCallback(() => {
    if (!socket || !farcasterUser) return

    const playerData: Player = {
      address,
      username: farcasterUser.username,
      displayName: farcasterUser.displayName,
      pfpUrl: farcasterUser.pfpUrl,
      score: 0,
      alive: true,
      fid: farcasterUser.fid,
    }

    socket.emit('joinLobby', {
      playerId: address || `fid-${farcasterUser.fid}`,
      playerData,
    })
  }, [socket, farcasterUser, address])

  const startBotGame = useCallback(() => {
    if (!socket || !farcasterUser) return

    const playerData: Player = {
      username: farcasterUser.username,
      displayName: farcasterUser.displayName,
      pfpUrl: farcasterUser.pfpUrl,
      score: 0,
      alive: true,
      fid: farcasterUser.fid,
    }

    socket.emit('startBotGame', {
      playerId: `fid-${farcasterUser.fid}`,
      playerData,
    })
  }, [socket, farcasterUser])

  // Auto-join socket lobby after successful contract transaction
  useEffect(() => {
    if (isSlitherMatchTxSuccess) {
      joinSocketLobby()
    }
  }, [isSlitherMatchTxSuccess, joinSocketLobby])

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatUSDC = (amount: bigint) => {
    return formatUnits(amount, 6)
  }

  const canJoinLobby = () => {
    return isConnected && 
           usdcBalance && 
           usdcBalance >= ENTRY_FEE && 
           farcasterUser && 
           !currentLobby
  }

  const needsApproval = () => {
    return !usdcAllowance || usdcAllowance < ENTRY_FEE
  }

  const shareToFarcaster = () => {
    const text = encodeURIComponent(`I just won a SlitherMatch game! 🐍🏆 Play at slithermatch.xyz`)
    const url = `https://warpcast.com/~/compose?text=${text}`
    window.open(url, '_blank')
  }

  if (farcasterLoading) {
    return (
      <div className="min-h-screen bg-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-purple-600 font-medium">Loading SlitherMatch...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-purple-900 mb-2">🐍 SlitherMatch</h1>
          <p className="text-purple-600">Multiplayer Snake Game • $1 USDC Entry</p>
          
          {farcasterUser && (
            <div className="flex items-center justify-center mt-4 space-x-2">
              <img 
                src={farcasterUser.pfpUrl} 
                alt={farcasterUser.displayName}
                className="w-8 h-8 rounded-full"
              />
              <span className="text-purple-800 font-medium">{farcasterUser.displayName}</span>
              {isMiniApp && <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded">Mini App</span>}
            </div>
          )}
        </div>

        {/* Wallet Connection */}
        {!isConnected && (
          <div className="bg-white rounded-lg p-6 mb-6 shadow-lg">
            <h2 className="text-2xl font-bold text-center mb-4 flex items-center justify-center">
              <Wallet className="mr-2" />
              Connect Wallet
            </h2>
            <div className="grid gap-3">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => connect({ connector })}
                  className="flex items-center justify-center p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  {connector.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Wallet Info */}
        {isConnected && (
          <div className="bg-white rounded-lg p-4 mb-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Wallet</p>
                <p className="font-mono text-sm">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">USDC Balance</p>
                <p className="font-bold flex items-center">
                  <DollarSign className="w-4 h-4 mr-1" />
                  {usdcBalance ? formatUSDC(usdcBalance) : '0.00'}
                </p>
              </div>
              <button
                onClick={() => disconnect()}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Game Rules */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow-lg">
          <h3 className="font-bold mb-2">🎮 Game Rules</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><span className="text-red-500">🔴</span> Red dots = 3 points</p>
              <p><span className="text-green-500">🟢</span> Green dots = 6 points</p>
              <p><span className="text-purple-500">🟣</span> Purple dots = 12 points</p>
            </div>
            <div>
              <p>⏱️ Game lasts 3 minutes max</p>
              <p>🏆 Winner: Last alive OR highest score</p>
              <p>💰 Winner takes 100% of entry fees</p>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="bg-white rounded-lg p-6 shadow-lg">
          {gameState === 'lobby' && !currentLobby && (
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-6">Choose Game Mode</h2>
              
              {/* Real Player Lobby */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="border-2 border-purple-200 rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-2 flex items-center justify-center">
                    <Users className="mr-2" />
                    Join Lobby
                  </h3>
                  <p className="text-gray-600 mb-4">Play against other players</p>
                  <p className="text-sm text-gray-500 mb-4">$1 entry • Up to 5 players</p>
                  
                  {!canJoinLobby() && (
                    <p className="text-red-500 text-sm mb-4">
                      {!isConnected ? 'Connect wallet first' : 
                       !usdcBalance || usdcBalance < ENTRY_FEE ? 'Insufficient USDC balance' :
                       'Loading...'}
                    </p>
                  )}
                  
                  <button
                    onClick={needsApproval() ? approveUSDC : joinLobby}
                    disabled={!canJoinLobby() || isUSDCPending || isSlitherMatchPending}
                    className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
                  >
                    {isUSDCPending || isSlitherMatchPending ? 'Processing...' :
                     needsApproval() ? 'Approve USDC' : 'Join Lobby ($1)'}
                  </button>
                </div>

                {/* Bot Game */}
                <div className="border-2 border-blue-200 rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-2 flex items-center justify-center">
                    <Play className="mr-2" />
                    Bot Match
                  </h3>
                  <p className="text-gray-600 mb-4">Practice against AI</p>
                  <p className="text-sm text-gray-500 mb-4">Free • No wallet required</p>
                  
                  <button
                    onClick={startBotGame}
                    disabled={!farcasterUser}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                  >
                    Start Bot Game
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lobby Waiting */}
          {gameState === 'lobby' && currentLobby && (
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">
                {isSpectator ? 'Spectating Lobby' : 'Waiting for Players...'}
                {currentLobby.isBot && ' (Bot Mode)'}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                {currentLobby.players.map(([playerId, player], index) => (
                  <div key={playerId} className="bg-purple-100 rounded-lg p-4">
                    <img 
                      src={player.pfpUrl} 
                      alt={player.displayName}
                      className="w-12 h-12 rounded-full mx-auto mb-2"
                    />
                    <p className="font-medium text-sm">{player.displayName}</p>
                    <p className="text-xs text-gray-600">@{player.username}</p>
                  </div>
                ))}
                
                {/* Empty slots */}
                {Array.from({ length: 5 - currentLobby.players.length }).map((_, index) => (
                  <div key={`empty-${index}`} className="bg-gray-100 rounded-lg p-4 border-2 border-dashed border-gray-300">
                    <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-2"></div>
                    <p className="text-gray-500 text-sm">Waiting...</p>
                  </div>
                ))}
              </div>
              
              <p className="text-gray-600">
                {currentLobby.players.length}/5 players • Game starts when 3 players join
              </p>
            </div>
          )}

          {/* Game Canvas */}
          {(gameState === 'playing' || gameState === 'spectating') && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    <span className="font-mono">{formatTime(timeRemaining)}</span>
                  </div>
                  {isSpectator && (
                    <div className="flex items-center text-purple-600">
                      <Eye className="w-4 h-4 mr-1" />
                      Spectating
                    </div>
                  )}
                </div>
                
                <div className="text-sm text-gray-600">
                  Use WASD or Arrow Keys to move
                </div>
              </div>

              <div className="flex justify-center mb-4">
                <canvas
                  ref={canvasRef}
                  width={GRID_WIDTH * CELL_SIZE}
                  height={GRID_HEIGHT * CELL_SIZE}
                  className="border-2 border-purple-300 rounded"
                />
              </div>

              {/* Scoreboard */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                {scores.map((score) => {
                  const player = currentLobby?.players.find(([id]) => id === score.playerId)?.[1]
                  if (!player) return null
                  
                  return (
                    <div 
                      key={score.playerId}
                      className={`p-2 rounded ${score.alive ? 'bg-green-100' : 'bg-red-100'}`}
                    >
                      <div className="flex items-center space-x-2">
                        <img 
                          src={player.pfpUrl} 
                          alt={player.displayName}
                          className="w-6 h-6 rounded-full"
                        />
                        <div>
                          <p className="text-xs font-medium">{player.displayName}</p>
                          <p className="text-xs">{score.score} pts</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Game Ended */}
          {gameState === 'ended' && (
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4 flex items-center justify-center">
                <Trophy className="mr-2 text-yellow-500" />
                Game Over!
              </h2>
              
              {winner && currentLobby && (
                <div className="mb-6">
                  {(() => {
                    const winnerPlayer = currentLobby.players.find(([id]) => id === winner)?.[1]
                    if (!winnerPlayer) return null
                    
                    return (
                      <div className="bg-yellow-100 rounded-lg p-6 mb-4">
                        <img 
                          src={winnerPlayer.pfpUrl} 
                          alt={winnerPlayer.displayName}
                          className="w-16 h-16 rounded-full mx-auto mb-2"
                        />
                        <h3 className="text-xl font-bold">{winnerPlayer.displayName} Wins!</h3>
                        <p className="text-gray-600">@{winnerPlayer.username}</p>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Final Scores */}
              <div className="mb-6">
                <h4 className="font-bold mb-2">Final Scores</h4>
                <div className="space-y-2">
                  {scores
                    .sort((a, b) => b.score - a.score)
                    .map((score, index) => {
                      const player = currentLobby?.players.find(([id]) => id === score.playerId)?.[1]
                      if (!player) return null
                      
                      return (
                        <div key={score.playerId} className="flex items-center justify-between bg-gray-100 rounded p-3">
                          <div className="flex items-center space-x-3">
                            <span className="font-bold text-lg">#{index + 1}</span>
                            <img 
                              src={player.pfpUrl} 
                              alt={player.displayName}
                              className="w-8 h-8 rounded-full"
                            />
                            <span className="font-medium">{player.displayName}</span>
                          </div>
                          <span className="font-bold">{score.score} pts</span>
                        </div>
                      )
                    })}
                </div>
              </div>

              <div className="space-y-3">
                {winner === (address || `fid-${farcasterUser?.fid}`) && (
                  <button
                    onClick={shareToFarcaster}
                    className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Share Victory to Farcaster 🎉
                  </button>
                )}
                
                <button
                  onClick={() => {
                    setGameState('lobby')
                    setCurrentLobby(null)
                    setWinner(null)
                  }}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Play Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}