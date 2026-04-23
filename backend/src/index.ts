import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import partiesRouter from './routes/parties';
import spotifyRouter from './routes/spotify';
import { setupSocket } from './socket';

const app = express();
const httpServer = createServer(app);

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

const io = new Server(httpServer, {
  cors: {
    origin: frontendUrl,
    credentials: true,
  },
});

app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(express.json());

app.use('/api/parties', partiesRouter);
app.use('/api/spotify', spotifyRouter);

setupSocket(io);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🎉 Nero Party server running on http://localhost:${PORT}`);
});
