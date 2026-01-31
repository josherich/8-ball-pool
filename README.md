# 🎱 8-Ball Pool Game

A realistic 8-ball pool game built with React, TypeScript, and Rapier 3D physics engine, featuring WebRTC-based online multiplayer.

## Features

- **Local 2-Player Mode**: Play on the same device with turn-based gameplay
- **Online Multiplayer (WebRTC)**: Real-time peer-to-peer gameplay with room codes
- **Realistic 3D Physics**: Rapier 3D physics with proper ball rotation and cushion bouncing
- **Full Pool Mechanics**: 15 numbered balls, cue ball, 6 pockets, scratch detection
- **Visual Polish**: 3D ball rendering with rotation, cue stick, aiming guide, power meter
- **Efficient Network Sync**: Delta updates during ball motion, full state sync after shots

## Prerequisites

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Signaling Server (for online multiplayer)

In one terminal:
```bash
npm run signal
```

This starts the WebSocket signaling server on `ws://localhost:8080`.

### 3. Start the Development Server

In another terminal:
```bash
npm run dev
```

The game will be available at `http://localhost:5173`.

## Online Multiplayer Architecture

The online multiplayer uses WebRTC for peer-to-peer communication:

```
┌─────────┐       ┌──────────────┐       ┌─────────┐
│ Player1 │◄─────►│   Signaling  │◄─────►│ Player2 │
│ (Host)  │       │    Server    │       │ (Guest) │
└────┬────┘       └──────────────┘       └────┬────┘
     │                                        │
     │     WebRTC Data Channel (P2P)         │
     └────────────────────────────────────────┘
```

### Message Types

- **`shot`**: When a player takes a shot (angle + power)
- **`state-full`**: Full game state sync (after shots complete)
- **`state-delta`**: Ball position updates during motion (~20Hz)
- **`turn-change`**: When the turn switches between players
- **`game-event`**: Pocketing events, scratches, etc.

### Signaling Protocol

The signaling server handles room management:
- `join` - Join a room by code
- `leave` - Leave current room
- `signal` - Relay WebRTC signaling data
- `peer-joined` / `peer-left` - Room membership notifications

## Project Structure

```
pool-game/
├── src/
│   ├── pool_engine.ts   # Main game engine with WebRTC integration
│   ├── pool_physics.ts  # Rapier 3D physics setup
│   ├── pool_rules.ts    # Turn switching and game rules
│   ├── online_peer.ts   # WebRTC peer connection management
│   ├── pool_game.tsx    # React UI component
│   ├── App.tsx          # Root component
│   └── main.tsx         # Entry point
├── server/
│   └── signaling-server.mjs  # WebSocket signaling server
├── .env.example         # Environment variables template
├── package.json
├── vite.config.ts
└── README.md
```

## How to Play

### Local Mode
1. Click "Local 2-Player" on the main menu
2. Player 1 aims with the mouse and clicks to set power
3. Release to shoot
4. Players alternate turns (unless you pocket your ball type)

### Online Mode
1. **Host**: Click "Host Online Game" - a room code appears
2. Share the room code with your opponent
3. **Guest**: Enter the room code and click "Join"
4. Wait for connection (status indicator in top-right)
5. Host plays first, then turns alternate

### Controls
- **Mouse Move**: Aim the cue stick (follows cursor)
- **Mouse Down**: Start charging power
- **Mouse Up**: Release shot at current power level
- **Aiming Guide**: Shows predicted ball path and ghost ball at impact point

## Environment Variables

Create a `.env` file (or copy `.env.example`):

```env
# Local development
VITE_SIGNALING_URL=ws://localhost:8080

# Production (use secure WebSocket)
# VITE_SIGNALING_URL=wss://your-signaling-server.com
```

## Production Deployment

### Build the game
```bash
npm run build
```

### Deploy signaling server
The signaling server (`server/signaling-server.mjs`) needs to be deployed separately. Options:
- **Railway/Render/Fly.io** - Easy Node.js hosting
- **VPS** - Run with pm2 or systemd
- **Cloudflare Workers** - Use Durable Objects for WebSocket support

Set `PORT` environment variable if needed (default: 8080).

## Technologies Used

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Rapier 3D** - Physics engine (compiled to WebAssembly)
- **simple-peer** - WebRTC wrapper
- **WebSocket** - Signaling server
- **HTML5 Canvas** - 2D rendering with 3D ball projection

## Troubleshooting

### "Room is full" error
Rooms are limited to 2 players. If you see this, the host is already playing with someone else.

### Connection issues
- Make sure both players can reach the signaling server
- Check if WebRTC is blocked by firewall/NAT (STUN servers help with NAT traversal)
- The game uses Google's public STUN servers by default

### Ball desync
If balls appear to desync, the full state is resynchronized after each shot completes. Minor visual differences during motion are normal.

## License

MIT

## GitHub Pages Deployment

The repo includes a GitHub Actions workflow for `gh-pages` deployment:

1. Go to **Settings → Pages**
2. Set **Source** to **Deploy from a branch**
3. Select **Branch**: `gh-pages`, **Folder**: `/ (root)`

Note: Online multiplayer requires a separate signaling server deployment.
