import { SignalingServer } from './signaling-server.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;

new SignalingServer(PORT);
