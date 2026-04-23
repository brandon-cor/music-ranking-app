# Nero Party

A real-time song-rating party app. The host queues tracks from Spotify, guests join by party code, and everyone scores each song during a shared rating window. At the end, the scores are revealed podium-style.

## Stack

- **Backend**: Node.js, Express, Socket.IO, Prisma (SQLite), TypeScript
- **Frontend**: React, Vite, Tailwind CSS, Framer Motion, TypeScript
- **Auth / Playback**: Spotify OAuth + Spotify Web Playback SDK (host needs Spotify Premium)

## Running locally

### Prerequisites

- Node.js 20+
- A Spotify developer app (free). Create one at <https://developer.spotify.com/dashboard> and add `http://127.0.0.1:3000/api/spotify/callback` as a redirect URI.

### Setup

```bash
# install deps
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# configure env
cp backend/.env.example backend/.env
# then fill in SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET

# prepare the database
cd backend && npx prisma migrate dev && cd ..

# start both servers (backend :3000, frontend :5173)
./start.sh
```

Open <http://localhost:5173> and create a party to get started.

## Environment variables

Defined in `backend/.env` (see `backend/.env.example` for the template):

| Variable                 | Purpose                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `DATABASE_URL`           | Prisma connection string (defaults to local SQLite).        |
| `PORT`                   | Backend HTTP port. Defaults to `3000`.                      |
| `FRONTEND_URL`           | Allowed CORS origin + Spotify redirect target.              |
| `SPOTIFY_CLIENT_ID`      | Spotify app client id.                                      |
| `SPOTIFY_CLIENT_SECRET`  | Spotify app client secret.                                  |
| `SPOTIFY_REDIRECT_URI`   | Must match the redirect URI registered in your Spotify app. |

## Folder structure

```
nero-party/
├── backend/              Express + Socket.IO + Prisma server
│   ├── prisma/           Schema + migrations (SQLite)
│   └── src/
│       ├── index.ts      HTTP + Socket.IO bootstrap
│       ├── routes/       REST endpoints (parties, spotify)
│       ├── socket/       Real-time party events
│       └── lib/          Prisma client + Spotify helpers
├── frontend/             Vite + React + Tailwind client
│   └── src/
│       ├── pages/        Top-level routes (Home, Lobby, Player, Podium)
│       ├── components/   Reusable UI (Queue, RatingSlider, Breadcrumbs…)
│       ├── context/      PartyContext — shared live-party state
│       ├── lib/          API client, socket singleton, audio helpers
│       └── types/        Shared TypeScript interfaces
└── start.sh              Boots both dev servers concurrently
```

## How it works

1. Host creates a party → receives a shareable party code.
2. Host connects Spotify from the lobby (Premium required).
3. Guests join via the code, add songs from Spotify search.
4. Host starts the party; each song plays through the host's browser via the Spotify Web Playback SDK.
5. Host opens a rating window (15–60s); everyone submits a score 0–100.
6. After the queue is exhausted, the podium reveals the ranked results.

If the host closes their tab, the party is automatically ended after a short grace period and the URL is invalidated for everyone.
