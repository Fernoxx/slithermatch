# 🚀 SlitherMatch Complete Setup Guide

This guide will walk you through setting up the complete SlitherMatch miniapp from scratch.

## 📋 Prerequisites

Before starting, ensure you have:

- **Node.js 18+** installed
- **Git** for version control
- **A wallet** with some Base ETH and USDC
- **WalletConnect Project ID** (free from [WalletConnect Cloud](https://cloud.walletconnect.com/))
- **Domain/hosting** for deployment (Vercel recommended)

## 🛠️ Step 1: Project Setup

### 1.1 Clone and Install

```bash
# Clone the repository
git clone <your-repository-url>
cd slithermatch

# Install dependencies
npm install
```

### 1.2 Environment Configuration

```bash
# Copy environment template
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Get a wallet private key (for contract deployment)
PRIVATE_KEY=0x1234567890abcdef... # 32-byte hex

# Get from https://cloud.walletconnect.com/
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Will be updated after contract deployment
NEXT_PUBLIC_CONTRACT_ADDRESS_BASE=
NEXT_PUBLIC_CONTRACT_ADDRESS_BASE_SEPOLIA=

# Local development
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_BASE_URL=http://localhost:3000
PORT=3001
```

## 🔐 Step 2: Smart Contract Deployment

### 2.1 Fund Your Deployment Wallet

Your deployment wallet needs:
- **Base Sepolia ETH** (testnet): Get from [Base faucet](https://coinbase.com/faucets/base-sepolia-faucet)
- **Base Mainnet ETH**: Buy/bridge from exchanges

### 2.2 Deploy to Testnet First

```bash
# Compile contracts
npm run compile

# Deploy to Base Sepolia (testnet)
npm run deploy:sepolia
```

You should see output like:
```
Deploying to chain ID: 84532
Using USDC address: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
SlitherMatch deployed to: 0xABC123...
```

### 2.3 Update Environment Variables

Add the deployed address to `.env.local`:
```env
NEXT_PUBLIC_CONTRACT_ADDRESS_BASE_SEPOLIA=0xABC123...
```

### 2.4 Deploy to Mainnet (Production)

⚠️ **Important**: Only do this when ready for production!

```bash
# Deploy to Base Mainnet
npm run deploy:mainnet
```

Update `.env.local`:
```env
NEXT_PUBLIC_CONTRACT_ADDRESS_BASE=0xXYZ789...
```

## 🎮 Step 3: Local Development

### 3.1 Start Development Servers

Open two terminals:

**Terminal 1 - Game Server:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### 3.2 Test the Application

1. Visit `http://localhost:3000`
2. Connect your wallet
3. Ensure you have Base Sepolia USDC for testing
4. Try joining a lobby or playing bot mode

### 3.3 Get Test USDC

For Base Sepolia testing:
1. Get Base Sepolia ETH from faucet
2. Use a USDC faucet or DEX to get test USDC
3. Alternative: Deploy a mock USDC for testing

## 🌐 Step 4: Production Deployment

### 4.1 Game Server Deployment

Deploy the game server to any Node.js hosting service:

**Option A: Railway**
1. Connect your GitHub repo to Railway
2. Set environment variables in Railway dashboard
3. Deploy from `server/` directory

**Option B: Render**
1. Create new Web Service
2. Connect GitHub repo
3. Build command: `npm install`
4. Start command: `node server/index.js`

**Option C: DigitalOcean App Platform**
1. Create new app from GitHub
2. Configure build/run commands
3. Set environment variables

### 4.2 Frontend Deployment

**Recommended: Vercel**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel

# Set production environment variables
vercel env add NEXT_PUBLIC_CONTRACT_ADDRESS_BASE
vercel env add NEXT_PUBLIC_SOCKET_URL
vercel env add NEXT_PUBLIC_BASE_URL
```

**Alternative: Netlify**
1. Connect GitHub repo to Netlify
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Set environment variables in Netlify dashboard

### 4.3 Update Production Environment

Update your production `.env`:
```env
# Production URLs
NEXT_PUBLIC_SOCKET_URL=https://your-game-server.railway.app
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app

# Production contracts
NEXT_PUBLIC_CONTRACT_ADDRESS_BASE=0x...
NEXT_PUBLIC_CONTRACT_ADDRESS_BASE_SEPOLIA=0x...
```

## 📱 Step 5: Farcaster Miniapp Configuration

### 5.1 Frame Metadata

The app automatically generates Frame metadata. Ensure your deployment includes:

```html
<!-- Automatically generated -->
<meta name="fc:frame" content="vNext">
<meta name="fc:frame:image" content="https://your-domain.com/og-image.png">
<meta name="fc:frame:button:1" content="Play SlitherMatch">
<meta name="fc:frame:post_url" content="https://your-domain.com">
```

### 5.2 Open Graph Image

Create an attractive OG image for social sharing:
1. Size: 1200x630px
2. Include: Game logo, "SlitherMatch", "$1 USDC Entry"
3. Place in `/public/og-image.png`

### 5.3 Testing in Farcaster

1. Deploy your app to production
2. Create a test cast with your app URL
3. Verify the Frame displays correctly
4. Test the interactive elements

## 🔍 Step 6: Testing & Verification

### 6.1 Smart Contract Verification

Verify your contracts on Basescan:

```bash
# The deploy script auto-verifies, but if needed:
npx hardhat verify --network baseMainnet <CONTRACT_ADDRESS> <ENTRY_FEE> <USDC_ADDRESS>
```

### 6.2 End-to-End Testing

Test all flows:
- [ ] Wallet connection (Farcaster, Coinbase, MetaMask)
- [ ] USDC approval and spending
- [ ] Lobby joining and waiting
- [ ] Game start countdown
- [ ] Real-time gameplay
- [ ] Winner determination and payout
- [ ] Bot mode functionality
- [ ] Spectator mode
- [ ] Farcaster sharing

### 6.3 Performance Testing

Monitor your game server:
- WebSocket connections
- Memory usage during games
- Response times
- Error rates

## 🚨 Common Issues & Solutions

### Issue: "Contract not deployed"
**Solution**: Ensure you've deployed to the correct network and updated environment variables.

### Issue: "USDC transfer failed"
**Solution**: Check USDC allowance and balance. User needs to approve spending first.

### Issue: "Socket connection failed"
**Solution**: Verify game server is running and `NEXT_PUBLIC_SOCKET_URL` is correct.

### Issue: "Farcaster user not loaded"
**Solution**: Check if you're testing in the correct environment (Farcaster frame vs. web).

### Issue: "Game doesn't start"
**Solution**: Ensure minimum 3 players and check server logs for errors.

## 📊 Monitoring & Analytics

### Essential Metrics to Track

1. **Game Metrics**
   - Games started/completed
   - Average game duration
   - Player retention
   - Revenue (USDC collected)

2. **Technical Metrics**
   - Server uptime
   - WebSocket connection stability
   - Smart contract gas usage
   - Frontend load times

3. **User Metrics**
   - Unique players
   - Farcaster vs. web users
   - Wallet connection success rate
   - Social shares

### Recommended Tools

- **Analytics**: Google Analytics, Mixpanel
- **Error Tracking**: Sentry, LogRocket
- **Server Monitoring**: DataDog, New Relic
- **Smart Contract**: Etherscan analytics

## 🔐 Security Considerations

### Smart Contract Security

- ✅ Uses OpenZeppelin contracts
- ✅ ReentrancyGuard protection
- ✅ Ownable access control
- ✅ No direct ETH handling (USDC only)

### Additional Recommendations

1. **Rate Limiting**: Implement on game server
2. **Input Validation**: Sanitize all user inputs
3. **CORS**: Configure properly for production
4. **Environment Variables**: Never commit secrets
5. **Regular Updates**: Keep dependencies updated

## 📈 Scaling Considerations

### When to Scale

- More than 100 concurrent players
- Server response times > 100ms
- Memory usage consistently > 80%
- WebSocket disconnection rate > 5%

### Scaling Options

1. **Horizontal Scaling**: Multiple game server instances
2. **Database**: Add Redis for session storage
3. **Load Balancing**: Distribute game lobbies
4. **CDN**: Use for static assets
5. **Caching**: Implement for user data and scores

## 🎯 Next Steps

After successful deployment:

1. **Community Building**
   - Share on Farcaster
   - Engage with Base ecosystem
   - Join developer communities

2. **Feature Development**
   - Tournament mode
   - Leaderboards
   - NFT rewards
   - Team battles

3. **Optimization**
   - Gas optimization
   - UI/UX improvements
   - Mobile responsiveness
   - Performance tuning

## 📞 Support

If you encounter issues:

1. Check this guide thoroughly
2. Review error logs (browser console, server logs)
3. Verify environment variables
4. Test on testnet first
5. Reach out to the community

## 🎉 Launch Checklist

Before going live:

- [ ] Smart contracts deployed and verified
- [ ] Game server running stably
- [ ] Frontend deployed and accessible
- [ ] All environment variables configured
- [ ] USDC contracts and balances working
- [ ] Farcaster integration tested
- [ ] Social sharing functional
- [ ] Error tracking configured
- [ ] Analytics setup
- [ ] Security review completed
- [ ] Performance testing passed
- [ ] Documentation updated

Congratulations! Your SlitherMatch miniapp is ready to launch! 🚀