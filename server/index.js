const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = createServer(app);

// CORS configuration for miniapp support
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://slithermatch.vercel.app",
      "https://warpcast.com",
      "https://coinbase.com",
      process.env.NEXT_PUBLIC_BASE_URL
    ].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// Game constants
const GRID_WIDTH = 20;
const GRID_HEIGHT = 15;
const GAME_DURATION = 3 * 60 * 1000; // 3 minutes
const FOOD_TYPES = [
  { color: '#EF4444', points: 3, emoji: '🔴' },
  { color: '#10B981', points: 6, emoji: '🟢' },
  { color: '#8B5CF6', points: 12, emoji: '🟣' }
];

// Game state
const lobbies = new Map();
const playerSockets = new Map();

class GameLobby {
  constructor(id) {
    this.id = id;
    this.players = new Map();
    this.spectators = new Set();
    this.state = 'waiting'; // waiting, active, completed
    this.createdAt = Date.now();
    this.startedAt = null;
    this.endedAt = null;
    this.maxPlayers = 5;
    this.minPlayers = 3;
    this.snakes = new Map();
    this.foods = [];
    this.gameTimer = null;
    this.winner = null;
    this.contractLobbyId = null;
  }

  addPlayer(playerId, playerData) {
    if (this.players.size >= this.maxPlayers) {
      throw new Error('Lobby is full');
    }
    
    this.players.set(playerId, {
      ...playerData,
      score: 0,
      alive: true,
      joinedAt: Date.now()
    });

    // Initialize snake
    const spawnPosition = this.getSpawnPosition();
    this.snakes.set(playerId, {
      segments: [spawnPosition],
      direction: { x: 1, y: 0 },
      color: this.getPlayerColor(playerId),
      alive: true
    });

    // Auto-start if minimum players reached
    if (this.players.size >= this.minPlayers && this.state === 'waiting') {
      setTimeout(() => {
        if (this.state === 'waiting') {
          this.startGame();
        }
      }, 30000); // 30 second countdown
    }
  }

  getSpawnPosition() {
    const positions = [
      { x: 2, y: 2 },
      { x: GRID_WIDTH - 3, y: 2 },
      { x: 2, y: GRID_HEIGHT - 3 },
      { x: GRID_WIDTH - 3, y: GRID_HEIGHT - 3 },
      { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) }
    ];
    return positions[this.players.size % positions.length];
  }

  getPlayerColor(playerId) {
    const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
    return colors[Array.from(this.players.keys()).indexOf(playerId) % colors.length];
  }

  startGame() {
    if (this.state !== 'waiting') return;
    
    this.state = 'active';
    this.startedAt = Date.now();
    this.generateFood();
    
    // Start game timer
    this.gameTimer = setTimeout(() => {
      this.endGame();
    }, GAME_DURATION);

    // Start game loop
    this.gameLoop = setInterval(() => {
      this.updateGame();
    }, 150); // ~6.7 FPS

    this.broadcastToLobby('gameStarted', {
      lobbyId: this.id,
      players: Array.from(this.players.entries()),
      snakes: Array.from(this.snakes.entries()),
      foods: this.foods,
      startTime: this.startedAt
    });
  }

  updateGame() {
    if (this.state !== 'active') return;

    // Move snakes
    for (const [playerId, snake] of this.snakes) {
      if (!snake.alive) continue;

      const head = snake.segments[0];
      const newHead = {
        x: head.x + snake.direction.x,
        y: head.y + snake.direction.y
      };

      // Check wall collision
      if (newHead.x < 0 || newHead.x >= GRID_WIDTH || 
          newHead.y < 0 || newHead.y >= GRID_HEIGHT) {
        this.killSnake(playerId);
        continue;
      }

      // Check self collision
      if (snake.segments.some(segment => 
          segment.x === newHead.x && segment.y === newHead.y)) {
        this.killSnake(playerId);
        continue;
      }

      // Check collision with other snakes
      for (const [otherPlayerId, otherSnake] of this.snakes) {
        if (playerId === otherPlayerId || !otherSnake.alive) continue;
        if (otherSnake.segments.some(segment => 
            segment.x === newHead.x && segment.y === newHead.y)) {
          this.killSnake(playerId);
          break;
        }
      }

      if (!snake.alive) continue;

      // Add new head
      snake.segments.unshift(newHead);

      // Check food collision
      const foodIndex = this.foods.findIndex(food => 
        food.x === newHead.x && food.y === newHead.y);
      
      if (foodIndex !== -1) {
        const food = this.foods[foodIndex];
        const player = this.players.get(playerId);
        player.score += FOOD_TYPES[food.type].points;
        this.foods.splice(foodIndex, 1);
        this.generateFood();
      } else {
        // Remove tail if no food eaten
        snake.segments.pop();
      }
    }

    // Check win condition
    const alivePlayers = Array.from(this.players.values()).filter(p => p.alive);
    if (alivePlayers.length <= 1) {
      this.endGame();
      return;
    }

    // Broadcast game state
    this.broadcastGameState();
  }

  killSnake(playerId) {
    const snake = this.snakes.get(playerId);
    const player = this.players.get(playerId);
    if (snake) snake.alive = false;
    if (player) player.alive = false;
  }

  generateFood() {
    // Maintain 3-5 food items
    while (this.foods.length < 5) {
      let position;
      let attempts = 0;
      
      do {
        position = {
          x: Math.floor(Math.random() * GRID_WIDTH),
          y: Math.floor(Math.random() * GRID_HEIGHT),
          type: Math.floor(Math.random() * FOOD_TYPES.length)
        };
        attempts++;
      } while (this.isPositionOccupied(position) && attempts < 50);
      
      if (attempts < 50) {
        this.foods.push(position);
      }
    }
  }

  isPositionOccupied(position) {
    // Check if position is occupied by any snake
    for (const snake of this.snakes.values()) {
      if (snake.segments.some(segment => 
          segment.x === position.x && segment.y === position.y)) {
        return true;
      }
    }
    return false;
  }

  endGame() {
    if (this.state !== 'active') return;
    
    this.state = 'completed';
    this.endedAt = Date.now();
    
    if (this.gameTimer) {
      clearTimeout(this.gameTimer);
      this.gameTimer = null;
    }
    
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }

    // Determine winner
    const alivePlayers = Array.from(this.players.entries()).filter(([_, p]) => p.alive);
    
    if (alivePlayers.length === 1) {
      this.winner = alivePlayers[0][0];
    } else {
      // Highest score wins
      const sortedPlayers = Array.from(this.players.entries())
        .sort(([_, a], [__, b]) => b.score - a.score);
      this.winner = sortedPlayers[0][0];
    }

    this.broadcastToLobby('gameEnded', {
      lobbyId: this.id,
      winner: this.winner,
      finalScores: Array.from(this.players.entries()),
      duration: this.endedAt - this.startedAt
    });
  }

  changeSnakeDirection(playerId, direction) {
    const snake = this.snakes.get(playerId);
    if (!snake || !snake.alive) return;

    // Prevent reverse direction
    const currentDir = snake.direction;
    if ((direction.x === -currentDir.x && direction.y === currentDir.y) ||
        (direction.y === -currentDir.y && direction.x === currentDir.x)) {
      return;
    }

    snake.direction = direction;
  }

  broadcastGameState() {
    const gameState = {
      snakes: Array.from(this.snakes.entries()),
      foods: this.foods,
      scores: Array.from(this.players.entries()).map(([id, player]) => ({
        playerId: id,
        score: player.score,
        alive: player.alive
      })),
      timeRemaining: Math.max(0, GAME_DURATION - (Date.now() - this.startedAt))
    };

    this.broadcastToLobby('gameState', gameState);
  }

  broadcastToLobby(event, data) {
    // Broadcast to players
    for (const playerId of this.players.keys()) {
      const socket = playerSockets.get(playerId);
      if (socket) {
        socket.emit(event, data);
      }
    }

    // Broadcast to spectators
    for (const spectatorId of this.spectators) {
      const socket = playerSockets.get(spectatorId);
      if (socket) {
        socket.emit(event, data);
      }
    }
  }

  addSpectator(playerId) {
    this.spectators.add(playerId);
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.snakes.delete(playerId);
    this.spectators.delete(playerId);
    
    if (this.players.size === 0 && this.state === 'waiting') {
      // Clean up empty lobby
      lobbies.delete(this.id);
    }
  }
}

// Socket.io event handlers
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinLobby', (data) => {
    const { playerId, playerData, lobbyId } = data;
    
    playerSockets.set(playerId, socket);
    socket.playerId = playerId;

    let lobby;
    if (lobbyId && lobbies.has(lobbyId)) {
      lobby = lobbies.get(lobbyId);
    } else {
      // Find or create lobby
      lobby = Array.from(lobbies.values()).find(l => 
        l.state === 'waiting' && l.players.size < l.maxPlayers);
      
      if (!lobby) {
        const newLobbyId = uuidv4();
        lobby = new GameLobby(newLobbyId);
        lobbies.set(newLobbyId, lobby);
      }
    }

    try {
      if (lobby.state === 'waiting' && lobby.players.size < lobby.maxPlayers) {
        lobby.addPlayer(playerId, playerData);
        socket.join(lobby.id);
        
        socket.emit('joinedLobby', {
          lobbyId: lobby.id,
          players: Array.from(lobby.players.entries()),
          state: lobby.state
        });

        lobby.broadcastToLobby('playerJoined', {
          playerId,
          playerData,
          playerCount: lobby.players.size
        });
      } else {
        // Join as spectator
        lobby.addSpectator(playerId);
        socket.join(lobby.id);
        
        socket.emit('joinedAsSpectator', {
          lobbyId: lobby.id,
          players: Array.from(lobby.players.entries()),
          state: lobby.state,
          snakes: lobby.state === 'active' ? Array.from(lobby.snakes.entries()) : [],
          foods: lobby.state === 'active' ? lobby.foods : []
        });
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('changeDirection', (data) => {
    const { direction } = data;
    const playerId = socket.playerId;
    
    if (!playerId) return;

    // Find the lobby this player is in
    const lobby = Array.from(lobbies.values()).find(l => l.players.has(playerId));
    if (lobby) {
      lobby.changeSnakeDirection(playerId, direction);
    }
  });

  socket.on('startBotGame', (data) => {
    const { playerId, playerData } = data;
    
    // Create a bot lobby
    const lobbyId = `bot-${uuidv4()}`;
    const lobby = new GameLobby(lobbyId);
    lobby.minPlayers = 1; // Allow single player for bots
    lobbies.set(lobbyId, lobby);

    playerSockets.set(playerId, socket);
    socket.playerId = playerId;

    // Add player
    lobby.addPlayer(playerId, playerData);
    
    // Add bot players
    for (let i = 0; i < 4; i++) {
      const botId = `bot-${i}`;
      const botData = {
        username: `Bot${i + 1}`,
        displayName: `Bot ${i + 1}`,
        pfpUrl: '/bot-avatar.png'
      };
      lobby.addPlayer(botId, botData);
    }

    socket.join(lobbyId);
    
    socket.emit('joinedLobby', {
      lobbyId,
      players: Array.from(lobby.players.entries()),
      state: lobby.state,
      isBot: true
    });

    // Start immediately for bot games
    setTimeout(() => lobby.startGame(), 1000);
    
    // Simple bot AI
    const botInterval = setInterval(() => {
      if (lobby.state !== 'active') {
        clearInterval(botInterval);
        return;
      }

      for (const [botId, snake] of lobby.snakes) {
        if (!botId.startsWith('bot-') || !snake.alive) continue;

        // Simple AI: try to move towards food or avoid walls
        const head = snake.segments[0];
        const possibleDirections = [
          { x: 0, y: -1 }, // up
          { x: 1, y: 0 },  // right
          { x: 0, y: 1 },  // down
          { x: -1, y: 0 }  // left
        ];

        const validDirections = possibleDirections.filter(dir => {
          const newPos = { x: head.x + dir.x, y: head.y + dir.y };
          return newPos.x >= 0 && newPos.x < GRID_WIDTH && 
                 newPos.y >= 0 && newPos.y < GRID_HEIGHT &&
                 !(dir.x === -snake.direction.x && dir.y === -snake.direction.y);
        });

        if (validDirections.length > 0) {
          const randomDir = validDirections[Math.floor(Math.random() * validDirections.length)];
          lobby.changeSnakeDirection(botId, randomDir);
        }
      }
    }, 300);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const playerId = socket.playerId;
    if (playerId) {
      playerSockets.delete(playerId);
      
      // Remove from any lobby
      for (const lobby of lobbies.values()) {
        if (lobby.players.has(playerId) || lobby.spectators.has(playerId)) {
          lobby.removePlayer(playerId);
          lobby.broadcastToLobby('playerLeft', { playerId });
          break;
        }
      }
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    lobbies: lobbies.size,
    timestamp: new Date().toISOString() 
  });
});

// Get lobby stats
app.get('/api/lobbies', (req, res) => {
  const lobbyStats = Array.from(lobbies.values()).map(lobby => ({
    id: lobby.id,
    playerCount: lobby.players.size,
    spectatorCount: lobby.spectators.size,
    state: lobby.state,
    createdAt: lobby.createdAt,
    startedAt: lobby.startedAt
  }));
  
  res.json(lobbyStats);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎮 SlitherMatch game server running on port ${PORT}`);
});