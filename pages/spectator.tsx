import { useEffect, useState } from 'react'
import { useReadContract } from 'wagmi'
import { slitherMatchABI } from '../lib/slitherMatchABI'

const CONTRACT_ADDRESS = '0x0ca8ea8190c62d5ac132a55d1968728f003220bf'

interface Player {
  address: string
  username: string
  score: number
  alive: boolean
}

export default function Spectator() {
  const [lobbyId, setLobbyId] = useState(1)
  const [players, setPlayers] = useState<Player[]>([])
  const [gameTime, setGameTime] = useState(180)
  const [gameActive, setGameActive] = useState(false)

  const { data: lobbyState } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: slitherMatchABI,
    functionName: 'getLobbyState',
    args: [lobbyId],
  })

  const { data: playersData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: slitherMatchABI,
    functionName: 'getPlayers',
    args: [lobbyId],
  })

  useEffect(() => {
    if (lobbyState === 1) { // Active state
      setGameActive(true)
    }
  }, [lobbyState])

  useEffect(() => {
    if (playersData) {
      const formattedPlayers = (playersData as string[]).map((address, index) => ({
        address,
        username: `Player ${index + 1}`,
        score: Math.floor(Math.random() * 50), // Simulated score
        alive: Math.random() > 0.3 // Simulated alive status
      }))
      setPlayers(formattedPlayers)
    }
  }, [playersData])

  useEffect(() => {
    if (gameActive && gameTime > 0) {
      const timer = setInterval(() => {
        setGameTime(prev => prev - 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [gameActive, gameTime])

  return (
    <div className="min-h-screen bg-[#F3E8FF] p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-6">SlitherMatch - Spectator</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm">
              <div>Lobby ID: {lobbyId}</div>
              <div>Status: {gameActive ? 'Live' : 'Waiting'}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">
                Time: {Math.floor(gameTime / 60)}:{(gameTime % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Spectator game area */}
          <div className="bg-gray-100 rounded border-2 border-gray-300 mx-auto mb-4" 
               style={{ width: '400px', height: '300px' }}>
            <div className="flex items-center justify-center h-full">
              {gameActive ? (
                <div className="text-center">
                  <div className="text-2xl mb-2">🐍</div>
                  <div className="text-lg font-semibold">Live Game in Progress</div>
                  <div className="text-sm text-gray-600">Watch the action!</div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-2xl mb-2">⏳</div>
                  <div className="text-lg font-semibold">Waiting for Game</div>
                  <div className="text-sm text-gray-600">Players are joining...</div>
                </div>
              )}
            </div>
          </div>

          {/* Players scoreboard */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Live Scoreboard</h3>
            <div className="space-y-2">
              {players.map((player, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-2 ${player.alive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm font-mono">{player.address.slice(0, 6)}...{player.address.slice(-4)}</span>
                  </div>
                  <div className="text-sm font-semibold">{player.score} pts</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Join game button */}
        <div className="space-y-2">
          <a
            href="/"
            className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg text-lg text-center"
          >
            Join Next Game
          </a>
          
          <a
            href="/bot"
            className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg text-center"
          >
            Play Bot Match
          </a>
        </div>

        {/* Game info */}
        <div className="bg-white rounded-lg shadow-lg p-4 mt-4">
          <h3 className="font-semibold mb-2">About SlitherMatch</h3>
          <p className="text-sm text-gray-600">
            Watch live multiplayer snake battles! Players compete in 3-minute matches 
            where the winner takes all entry fees. Join the next game or practice 
            against bots.
          </p>
        </div>
      </div>
    </div>
  )
}