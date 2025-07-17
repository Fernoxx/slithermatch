import { useEffect, useState, useCallback, useRef } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

// Game constants
const GRID_WIDTH = 20
const GRID_HEIGHT = 15
const CELL_SIZE = 20
const GAME_SPEED = 150
const BOT_COUNT = 3

// Food types
const FOOD_TYPES = [
  { color: '#EF4444', points: 3, emoji: '🔴' },
  { color: '#10B981', points: 6, emoji: '🟢' },
  { color: '#8B5CF6', points: 12, emoji: '🟣' }
]

// Bot colors
const BOT_COLORS = [
  '#F59E0B', // Orange
  '#EC4899', // Pink
  '#6366F1', // Indigo
]

interface SnakeSegment {
  x: number
  y: number
}

interface Food {
  x: number
  y: number
  type: number
}

interface BotSnake {
  segments: SnakeSegment[]
  direction: { x: number, y: number }
  color: string
  alive: boolean
  score: number
}

interface FarcasterUser {
  fid: number
  username: string
  displayName: string
  pfpUrl: string
}

export default function BotLobby() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null)

  // Farcaster user data
  const [currentUser, setCurrentUser] = useState<FarcasterUser | null>(null)

  // Game state
  const [gameStarted, setGameStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [gameTime, setGameTime] = useState(180)
  const [score, setScore] = useState(0)
  const [playerAlive, setPlayerAlive] = useState(true)
  const [winner, setWinner] = useState<'player' | 'bot' | null>(null)

  // Snake game state
  const [snake, setSnake] = useState<SnakeSegment[]>([{ x: 10, y: 7 }])
  const [direction, setDirection] = useState({ x: 1, y: 0 })
  const [food, setFood] = useState<Food>({ x: 5, y: 5, type: 0 })
  const [bots, setBots] = useState<BotSnake[]>([])

  // Initialize Farcaster SDK
  useEffect(() => {
    const initializeFarcaster = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).parent !== window) {
          const { sdk } = await import('@farcaster/miniapp-sdk')
          await sdk.ready()
          
          const context = await sdk.context
          if (context?.user) {
            setCurrentUser({
              fid: context.user.fid,
              username: context.user.username,
              displayName: context.user.displayName,
              pfpUrl: context.user.pfpUrl
            })
          }
        }
      } catch (error) {
        console.log('Farcaster SDK not available')
      }
    }
    
    initializeFarcaster()
  }, [])

  // Initialize bots
  const initializeBots = useCallback(() => {
    const newBots: BotSnake[] = []
    for (let i = 0; i < BOT_COUNT; i++) {
      newBots.push({
        segments: [{ x: 2 + i * 6, y: 2 + i * 3 }],
        direction: { x: 1, y: 0 },
        color: BOT_COLORS[i],
        alive: true,
        score: 0
      })
    }
    setBots(newBots)
  }, [])

  // Generate random food
  const generateFood = useCallback(() => {
    const newFood: Food = {
      x: Math.floor(Math.random() * GRID_WIDTH),
      y: Math.floor(Math.random() * GRID_HEIGHT),
      type: Math.floor(Math.random() * FOOD_TYPES.length)
    }
    setFood(newFood)
  }, [])

  // Check collision with point
  const checkCollision = (pos1: SnakeSegment, pos2: SnakeSegment) => {
    return pos1.x === pos2.x && pos1.y === pos2.y
  }

  // Bot AI - simple pathfinding towards food
  const updateBotDirection = useCallback((bot: BotSnake, food: Food, allSnakes: SnakeSegment[][]) => {
    const head = bot.segments[0]
    const directions = [
      { x: 1, y: 0 },  // right
      { x: -1, y: 0 }, // left
      { x: 0, y: 1 },  // down
      { x: 0, y: -1 }  // up
    ]

    // Calculate distances to food for each direction
    const validDirections = directions.filter(dir => {
      const newPos = { x: head.x + dir.x, y: head.y + dir.y }
      
      // Check bounds
      if (newPos.x < 0 || newPos.x >= GRID_WIDTH || newPos.y < 0 || newPos.y >= GRID_HEIGHT) {
        return false
      }
      
      // Check collision with self
      if (bot.segments.some(segment => checkCollision(segment, newPos))) {
        return false
      }
      
      // Check collision with other snakes
      if (allSnakes.some(snake => snake.some(segment => checkCollision(segment, newPos)))) {
        return false
      }
      
      return true
    })

    if (validDirections.length === 0) {
      return bot.direction // No valid moves, keep current direction
    }

    // Choose direction that gets closer to food
    const bestDirection = validDirections.reduce((best, current) => {
      const currentPos = { x: head.x + current.x, y: head.y + current.y }
      const bestPos = { x: head.x + best.x, y: head.y + best.y }
      
      const currentDistance = Math.abs(currentPos.x - food.x) + Math.abs(currentPos.y - food.y)
      const bestDistance = Math.abs(bestPos.x - food.x) + Math.abs(bestPos.y - food.y)
      
      return currentDistance < bestDistance ? current : best
    })

    return bestDirection
  }, [])

  // Start game
  const startGame = useCallback(() => {
    setGameStarted(true)
    setGameOver(false)
    setPlayerAlive(true)
    setWinner(null)
    setScore(0)
    setGameTime(180)
    setSnake([{ x: 10, y: 7 }])
    setDirection({ x: 1, y: 0 })
    generateFood()
    initializeBots()

    // Start countdown
    let countdownValue = 3
    setCountdown(countdownValue)
    
    const countdownTimer = setInterval(() => {
      countdownValue -= 1
      setCountdown(countdownValue)
      
      if (countdownValue <= 0) {
        clearInterval(countdownTimer)
        setCountdown(null)
        
        // Start main game loop
        gameLoopRef.current = setInterval(() => {
          updateGame()
        }, GAME_SPEED)
      }
    }, 1000)
  }, [generateFood, initializeBots])

  // Update game state
  const updateGame = useCallback(() => {
    setBots(prevBots => {
      const aliveBots = prevBots.filter(bot => bot.alive)
      const allSnakeSegments = [snake, ...aliveBots.map(bot => bot.segments)]
      
      return prevBots.map(bot => {
        if (!bot.alive) return bot
        
        const newDirection = updateBotDirection(bot, food, allSnakeSegments)
        const newBot = { ...bot, direction: newDirection }
        const newSegments = [...bot.segments]
        const head = { ...newSegments[0] }
        
        head.x += newDirection.x
        head.y += newDirection.y
        
        // Check collisions
        if (head.x < 0 || head.x >= GRID_WIDTH || head.y < 0 || head.y >= GRID_HEIGHT) {
          return { ...newBot, alive: false }
        }
        
        if (newSegments.some(segment => checkCollision(segment, head))) {
          return { ...newBot, alive: false }
        }
        
        newSegments.unshift(head)
        
        // Check food collision
        if (checkCollision(head, food)) {
          newBot.score += FOOD_TYPES[food.type].points
          generateFood()
        } else {
          newSegments.pop()
        }
        
        return { ...newBot, segments: newSegments }
      })
    })
    
    // Update player snake
    setSnake(prevSnake => {
      if (!playerAlive || !prevSnake.length) return prevSnake
      
      const newSnake = [...prevSnake]
      const head = { ...newSnake[0] }
      
      head.x += direction.x
      head.y += direction.y
      
      // Check collisions
      if (head.x < 0 || head.x >= GRID_WIDTH || head.y < 0 || head.y >= GRID_HEIGHT) {
        setPlayerAlive(false)
        return prevSnake
      }
      
      if (newSnake.some(segment => checkCollision(segment, head))) {
        setPlayerAlive(false)
        return prevSnake
      }
      
      // Check collision with bots
      if (bots.some(bot => bot.segments.some(segment => checkCollision(segment, head)))) {
        setPlayerAlive(false)
        return prevSnake
      }
      
      newSnake.unshift(head)
      
      // Check food collision
      if (checkCollision(head, food)) {
        setScore(prev => prev + FOOD_TYPES[food.type].points)
        generateFood()
      } else {
        newSnake.pop()
      }
      
      return newSnake
    })
  }, [snake, direction, food, bots, playerAlive, generateFood, updateBotDirection])

  // Handle game timer
  useEffect(() => {
    if (gameStarted && !gameOver && countdown === null) {
      const timer = setInterval(() => {
        setGameTime(prev => {
          if (prev <= 1) {
            endGame()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [gameStarted, gameOver, countdown])

  // End game
  const endGame = useCallback(() => {
    setGameOver(true)
    setGameStarted(false)
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current)
    }
    
    // Determine winner
    const aliveBots = bots.filter(bot => bot.alive)
    const topBot = bots.reduce((prev, current) => 
      prev.score > current.score ? prev : current
    )
    
    if (playerAlive && (aliveBots.length === 0 || score > topBot.score)) {
      setWinner('player')
    } else {
      setWinner('bot')
    }
  }, [bots, score, playerAlive])

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameStarted || gameOver || !playerAlive || countdown !== null) return

      switch (e.key) {
        case 'ArrowUp':
          if (direction.y === 0) setDirection({ x: 0, y: -1 })
          break
        case 'ArrowDown':
          if (direction.y === 0) setDirection({ x: 0, y: 1 })
          break
        case 'ArrowLeft':
          if (direction.x === 0) setDirection({ x: -1, y: 0 })
          break
        case 'ArrowRight':
          if (direction.x === 0) setDirection({ x: 1, y: 0 })
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [gameStarted, gameOver, direction, playerAlive, countdown])

  // Share win function
  const shareWin = () => {
    const text = `I just won against bots in SlitherMatch! 🤖🐍\n\nScore: ${score} points\nBeaten ${BOT_COUNT} AI opponents!\n\nTry the bot mode: https://slithermatch.vercel.app/bot`
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#F3E8FF] p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🤖 Bot Lobby</h1>
          <p className="text-gray-600">Practice against AI opponents - Free to play!</p>
          {currentUser && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <img 
                src={currentUser.pfpUrl} 
                alt={currentUser.username}
                className="w-6 h-6 rounded-full"
              />
              <span className="text-sm text-gray-600">{currentUser.displayName}</span>
            </div>
          )}
        </div>

        {/* Game Area */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-4">
          {/* Game Header */}
          <div className="bg-gray-50 p-4 border-b">
            <div className="flex justify-between items-center">
              <div className="text-sm">
                <div className="font-semibold">Bot Match</div>
                <div className="text-gray-600">vs {BOT_COUNT} AI Opponents</div>
              </div>
              <div className="text-right">
                {gameStarted && (
                  <div className="text-lg font-bold text-gray-800">
                    Time: {formatTime(gameTime)}
                  </div>
                )}
                <div className="text-sm text-gray-600">Score: {score}</div>
              </div>
            </div>
          </div>

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

              {/* Player Snake */}
              {snake.map((segment, index) => (
                <div
                  key={index}
                  className={`absolute rounded-sm transition-all duration-75 ${
                    index === 0 ? 'bg-blue-600' : 'bg-blue-400'
                  }`}
                  style={{
                    left: segment.x * CELL_SIZE + 2,
                    top: segment.y * CELL_SIZE + 2,
                    width: CELL_SIZE - 4,
                    height: CELL_SIZE - 4,
                  }}
                />
              ))}

              {/* Bot Snakes */}
              {bots.map((bot, botIndex) =>
                bot.segments.map((segment, segmentIndex) => (
                  <div
                    key={`bot-${botIndex}-${segmentIndex}`}
                    className={`absolute rounded-sm transition-all duration-75 ${
                      !bot.alive ? 'opacity-50' : ''
                    }`}
                    style={{
                      left: segment.x * CELL_SIZE + 2,
                      top: segment.y * CELL_SIZE + 2,
                      width: CELL_SIZE - 4,
                      height: CELL_SIZE - 4,
                      backgroundColor: bot.color,
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

              {/* Game overlays */}
              {!gameStarted && !gameOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
                  <div className="text-white text-center">
                    <div className="text-2xl mb-2">🤖</div>
                    <div className="text-xl font-semibold mb-2">Ready to play?</div>
                    <div className="text-sm">Face off against AI opponents!</div>
                  </div>
                </div>
              )}

              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                  <div className="text-white text-center">
                    <div className="text-4xl font-bold mb-2">{countdown}</div>
                    <div className="text-lg">Get ready!</div>
                  </div>
                </div>
              )}

              {gameOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                  <div className="text-white text-center">
                    <div className="text-3xl mb-2">
                      {winner === 'player' ? '🎉' : '🤖'}
                    </div>
                    <div className="text-2xl font-bold mb-2">
                      {winner === 'player' ? 'You Won!' : 'Bot Won!'}
                    </div>
                    <div className="text-lg mb-4">Final Score: {score}</div>
                    {winner === 'player' && (
                      <button
                        onClick={shareWin}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                      >
                        Share Win 🎉
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!playerAlive && gameStarted && !gameOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-600 bg-opacity-50 rounded-lg">
                  <div className="text-white text-center">
                    <div className="text-2xl font-bold mb-2">💀 You Died!</div>
                    <div className="text-lg">Final Score: {score}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Game controls */}
            {gameStarted && countdown === null && (
              <div className="text-center text-sm text-gray-600 mt-3">
                Use arrow keys to control your snake
              </div>
            )}
          </div>
        </div>

        {/* Bot Scores */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <h3 className="font-semibold mb-3 text-gray-800">Live Scoreboard</h3>
          <div className="space-y-2">
            {/* Player score */}
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-blue-600 rounded-sm"></div>
                <span className="font-semibold">You</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  playerAlive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {playerAlive ? 'Alive' : 'Dead'}
                </span>
              </div>
              <div className="font-bold">{score} pts</div>
            </div>

            {/* Bot scores */}
            {bots.map((bot, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: bot.color }}
                  ></div>
                  <span className="font-semibold">Bot {index + 1}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    bot.alive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {bot.alive ? 'Alive' : 'Dead'}
                  </span>
                </div>
                <div className="font-bold">{bot.score} pts</div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {!gameStarted && !gameOver && (
            <button
              onClick={startGame}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg text-lg transition-colors"
            >
              🚀 Start Bot Match
            </button>
          )}

          {gameOver && (
            <button
              onClick={startGame}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg text-lg transition-colors"
            >
              🔄 Play Again
            </button>
          )}

          {/* Real game button */}
          <a
            href="/"
            className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition-colors"
          >
            💰 Play Real Game ($1 Entry)
          </a>

          {/* Spectate button */}
          <a
            href="/spectator"
            className="block w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition-colors"
          >
            👀 Spectate Live Games
          </a>
        </div>

        {/* Game Rules */}
        <div className="bg-white rounded-lg shadow-lg p-4 mt-4">
          <h3 className="font-semibold mb-3 text-gray-800">Bot Mode Rules</h3>
          <div className="text-sm space-y-2">
            <div>• Play against {BOT_COUNT} AI opponents for free</div>
            <div>• Same scoring system as real games</div>
            <div>• Perfect for practice and learning</div>
            <div>• No wallet connection required</div>
            <div>• Share your wins on Farcaster!</div>
          </div>
        </div>
      </div>
    </div>
  )
}