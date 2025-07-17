# 🐍 SlitherMatch - Farcaster Miniapp

A multiplayer snake game on Base with $1 USDC entry fees. Built as a Farcaster miniapp that also works on Coinbase.

## 🎯 Features

### 🎮 Game Modes
- **Multiplayer Lobbies**: 3-5 players, $1 USDC entry, winner takes all
- **Bot Mode**: Practice against AI for free
- **Spectator Mode**: Watch live matches
- **Real-time Gameplay**: WebSocket-based multiplayer experience

### 💰 Payment System
- **USDC on Base**: $1 entry fee using USDC (6 decimals)
- **Smart Contract**: Secure escrow and automatic payouts
- **Wallet Integration**: Farcaster Wallet, Coinbase Wallet, MetaMask support

### 🔗 Farcaster Integration
- **Native User Data**: Real usernames, display names, and profile pictures
- **Miniapp Detection**: Automatically detects Farcaster/Coinbase environment
- **Social Sharing**: Share victories directly to Farcaster
- **Cross-Platform**: Works in Farcaster, Coinbase, and web browsers

### 🎯 Game Mechanics
- **Scoring System**: Red dots (3pts), Green dots (6pts), Purple dots (12pts)
- **Win Conditions**: Last player alive OR highest score after 3 minutes
- **Real-time Updates**: Live scores, player status, and game state
- **Auto-start**: Games begin 30 seconds after 3 players join

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- A wallet with Base USDC for playing
- (Optional) Farcaster account for miniapp features

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd slithermatch
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:
```env
# Smart Contract (deploy first)
PRIVATE_KEY=your_wallet_private_key
NEXT_PUBLIC_CONTRACT_ADDRESS_BASE=0x...
NEXT_PUBLIC_CONTRACT_ADDRESS_BASE_SEPOLIA=0x...

# Wallet Connect (get from https://cloud.walletconnect.com/)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Game Server
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
PORT=3001
```

4. **Deploy Smart Contract**
```bash
# Deploy to Base Sepolia (testnet)
npm run deploy:sepolia

# Deploy to Base Mainnet
npm run deploy:mainnet
```

5. **Start the development servers**
```bash
# Terminal 1: Game server
npm run server

# Terminal 2: Frontend
npm run dev
```

Visit `http://localhost:3000` to play!

## 🏗️ Architecture

### Frontend (`/pages`)
- **Next.js 15** with TypeScript
- **Tailwind CSS** for styling
- **wagmi + viem** for blockchain interactions
- **Socket.io** for real-time gameplay
- **Farcaster SDK** for miniapp integration

### Backend (`/server`)
- **Express.js** with Socket.io
- **Real-time game logic** with collision detection
- **Lobby management** and matchmaking
- **Bot AI** for practice mode

### Smart Contracts (`/contracts`)
- **SlitherMatch.sol**: Main game contract with USDC integration
- **OpenZeppelin**: Security and standards compliance
- **Hardhat**: Development and deployment framework

### Key Components

#### Farcaster Integration (`/contexts/FarcasterContext.tsx`)
```typescript
const { user, isMiniApp, ready } = useFarcaster()
// Automatically detects Farcaster environment
// Provides real user data from Farcaster SDK
```

#### Wallet Connection (`/lib/wagmiConfig.ts`)
```typescript
// Supports Farcaster Wallet, Coinbase Wallet, MetaMask
// Automatically configures for Base mainnet/testnet
// USDC contract integration
```

#### Game Server (`/server/index.js`)
```javascript
// Real-time multiplayer lobbies
// Snake game physics and collision detection
// Bot AI for practice mode
// Spectator mode support
```

## 🎮 How to Play

### Joining a Game

1. **Connect Wallet**: Use Farcaster Wallet, Coinbase Wallet, or MetaMask
2. **Get USDC**: Ensure you have at least $1 USDC on Base
3. **Join Lobby**: Click "Join Lobby" and approve USDC spending
4. **Wait for Players**: Games start when 3+ players join (30s countdown)

### Game Controls

- **Arrow Keys** or **WASD**: Control your snake
- **Objective**: Eat dots to grow and score points
- **Avoid**: Walls and other snakes
- **Win**: Be the last alive or have the highest score

### Scoring

- 🔴 **Red Dots**: 3 points
- 🟢 **Green Dots**: 6 points  
- 🟣 **Purple Dots**: 12 points

## 🔧 Smart Contract

### Deployment

The contract requires two parameters:
```solidity
constructor(uint256 _entryFee, address _usdcToken)
```

**USDC Addresses:**
- Base Mainnet: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`
- Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

### Key Functions

```solidity
// Join a lobby (approveUSDC first)
function joinLobby(uint256 _lobbyId) external

// Game management (owner only)
function markGameStarted(uint256 _lobbyId) external
function declareWinner(uint256 _lobbyId, address _winner) external

// Refunds (if no game starts in 5 minutes)
function refundIfUnstarted(uint256 _lobbyId, address _player) external
```

## 🌐 Miniapp Deployment

### Farcaster Frame

1. **Deploy to Vercel/similar**
2. **Add Frame metadata** (automatically handled)
3. **Test in Farcaster** using the cast composer

### Frame Metadata
```html
<meta name="fc:frame" content="vNext">
<meta name="fc:frame:image" content="https://your-domain.com/og-image.png">
<meta name="fc:frame:button:1" content="Play SlitherMatch">
<meta name="fc:frame:post_url" content="https://your-domain.com">
```

## 🛠️ Development

### Project Structure
```
slithermatch/
├── contracts/           # Smart contracts
│   ├── SlitherMatch.sol
│   └── Lock.sol
├── pages/              # Next.js pages
│   ├── index.tsx       # Main game interface
│   ├── bot.tsx         # Bot mode
│   └── spectator.tsx   # Spectator mode
├── server/             # Game server
│   └── index.js        # Express + Socket.io server
├── contexts/           # React contexts
│   └── FarcasterContext.tsx
├── lib/               # Utilities
│   ├── wagmiConfig.ts
│   └── slitherMatchABI.js
└── styles/            # CSS styles
    └── globals.css
```

### Key Technologies

- **Blockchain**: Base (Ethereum L2)
- **Token**: USDC (ERC-20)
- **Frontend**: Next.js 15, React 18, TypeScript
- **Styling**: Tailwind CSS, Lucide Icons
- **Wallet**: wagmi v2, viem, WalletConnect
- **Real-time**: Socket.io
- **Smart Contracts**: Solidity 0.8.28, Hardhat, OpenZeppelin

### Environment Variables

See `.env.example` for all required variables:

- **Contract addresses** (after deployment)
- **WalletConnect project ID**
- **Game server URL**
- **Farcaster/Neynar API keys** (optional)

## 🚀 Deployment

### 1. Smart Contract
```bash
# Test deployment on Sepolia
npm run deploy:sepolia

# Production deployment on Base
npm run deploy:mainnet
```

### 2. Game Server
Deploy to any Node.js hosting service:
- Railway
- Render  
- DigitalOcean
- Heroku

### 3. Frontend
Deploy to Vercel, Netlify, or similar:
```bash
npm run build
npm run start
```

### 4. Environment Setup
Update production environment variables:
- `NEXT_PUBLIC_CONTRACT_ADDRESS_BASE`
- `NEXT_PUBLIC_SOCKET_URL`
- `NEXT_PUBLIC_BASE_URL`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For questions or issues:
1. Check the [Issues](../../issues) page
2. Join our [Developer Telegram](https://t.me/slithermatch)
3. Review the [Farcaster Developer Docs](https://docs.farcaster.xyz)

## 🙏 Acknowledgments

- [Farcaster](https://farcaster.xyz) - Decentralized social protocol
- [Base](https://base.org) - Ethereum L2 blockchain  
- [OpenZeppelin](https://openzeppelin.com) - Smart contract security
- [wagmi](https://wagmi.sh) - React hooks for Ethereum
