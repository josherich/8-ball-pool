import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SignalingServer } from './signaling-server.js';
import WebSocket from 'ws';

describe('SignalingServer', () => {
  let server: SignalingServer;
  let port: number;

  beforeEach(async () => {
    // Use a random port for testing
    port = 8000 + Math.floor(Math.random() * 1000);
    server = new SignalingServer(port);

    // Wait for server to be ready
    await server.waitForReady();
  });

  afterEach(() => {
    server.close();
  });

  describe('Room Creation', () => {
    it('should create a room and return a room code', (done) => {
      const client = new WebSocket(`ws://localhost:${port}`);

      client.on('error', () => {}); // Suppress errors

      client.on('open', () => {
        client.send(JSON.stringify({ type: 'create-room' }));
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());

        expect(message.type).toBe('room-created');
        expect(message.roomCode).toBeDefined();
        expect(message.roomCode).toMatch(/^[A-Z0-9]{6}$/);
        expect(message.clientId).toBeDefined();

        client.close();
        done();
      });
    });

    it('should generate unique room codes', (done) => {
      const client1 = new WebSocket(`ws://localhost:${port}`);
      const client2 = new WebSocket(`ws://localhost:${port}`);
      const roomCodes: string[] = [];
      let received = 0;

      const checkCompletion = () => {
        received++;
        if (received === 2) {
          expect(roomCodes[0]).not.toBe(roomCodes[1]);
          client1.close();
          client2.close();
          done();
        }
      };

      client1.on('error', () => {}); // Suppress errors
      client2.on('error', () => {}); // Suppress errors

      client1.on('open', () => {
        client1.send(JSON.stringify({ type: 'create-room' }));
      });

      client1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        roomCodes.push(message.roomCode);
        checkCompletion();
      });

      client2.on('open', () => {
        client2.send(JSON.stringify({ type: 'create-room' }));
      });

      client2.on('message', (data) => {
        const message = JSON.parse(data.toString());
        roomCodes.push(message.roomCode);
        checkCompletion();
      });
    });
  });

  describe('Room Joining', () => {
    it('should allow a guest to join an existing room', (done) => {
      const host = new WebSocket(`ws://localhost:${port}`);
      const guest = new WebSocket(`ws://localhost:${port}`);
      let roomCode: string;
      let hostNotified = false;
      let guestJoined = false;

      const checkCompletion = () => {
        if (hostNotified && guestJoined) {
          host.close();
          guest.close();
          done();
        }
      };

      host.on('error', () => {}); // Suppress errors
      guest.on('error', () => {}); // Suppress errors

      host.on('open', () => {
        host.send(JSON.stringify({ type: 'create-room' }));
      });

      host.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'room-created') {
          roomCode = message.roomCode;

          // Now have guest join
          guest.on('open', () => {
            guest.send(JSON.stringify({ type: 'join-room', roomCode }));
          });
        } else if (message.type === 'peer-connected') {
          expect(message.clientId).toBeDefined();
          hostNotified = true;
          checkCompletion();
        }
      });

      guest.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'room-joined') {
          expect(message.roomCode).toBe(roomCode);
          expect(message.clientId).toBeDefined();
          guestJoined = true;
          checkCompletion();
        }
      });
    });

    it('should return error when joining non-existent room', (done) => {
      const client = new WebSocket(`ws://localhost:${port}`);

      client.on('error', () => {}); // Suppress errors

      client.on('open', () => {
        client.send(JSON.stringify({
          type: 'join-room',
          roomCode: 'INVALID'
        }));
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());

        expect(message.type).toBe('error');
        expect(message.error).toBe('Room not found');

        client.close();
        done();
      });
    });

    it('should return error when room is full', (done) => {
      const host = new WebSocket(`ws://localhost:${port}`);
      const guest1 = new WebSocket(`ws://localhost:${port}`);
      const guest2 = new WebSocket(`ws://localhost:${port}`);
      let roomCode: string;

      host.on('error', () => {}); // Suppress errors
      guest1.on('error', () => {}); // Suppress errors
      guest2.on('error', () => {}); // Suppress errors

      host.on('open', () => {
        host.send(JSON.stringify({ type: 'create-room' }));
      });

      host.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'room-created') {
          roomCode = message.roomCode;

          // First guest joins
          guest1.on('open', () => {
            guest1.send(JSON.stringify({ type: 'join-room', roomCode }));
          });
        }
      });

      guest1.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'room-joined') {
          // Second guest tries to join
          guest2.on('open', () => {
            guest2.send(JSON.stringify({ type: 'join-room', roomCode }));
          });
        }
      });

      guest2.on('message', (data) => {
        const message = JSON.parse(data.toString());

        expect(message.type).toBe('error');
        expect(message.error).toBe('Room is full');

        host.close();
        guest1.close();
        guest2.close();
        done();
      });
    });
  });

  describe('Signal Forwarding', () => {
    it('should forward signals between host and guest', (done) => {
      const host = new WebSocket(`ws://localhost:${port}`);
      const guest = new WebSocket(`ws://localhost:${port}`);
      let roomCode: string;
      const testSignal = { type: 'offer', sdp: 'test-sdp' };
      let hostReceivedSignal = false;
      let guestReceivedSignal = false;

      const checkCompletion = () => {
        if (hostReceivedSignal && guestReceivedSignal) {
          host.close();
          guest.close();
          done();
        }
      };

      host.on('error', () => {}); // Suppress errors
      guest.on('error', () => {}); // Suppress errors

      host.on('open', () => {
        host.send(JSON.stringify({ type: 'create-room' }));
      });

      host.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'room-created') {
          roomCode = message.roomCode;

          guest.on('open', () => {
            guest.send(JSON.stringify({ type: 'join-room', roomCode }));
          });
        } else if (message.type === 'peer-connected') {
          // Host sends a signal to guest
          host.send(JSON.stringify({
            type: 'signal',
            roomCode,
            signal: testSignal
          }));
        } else if (message.type === 'signal') {
          // Host receives signal from guest
          expect(message.signal).toEqual(testSignal);
          hostReceivedSignal = true;
          checkCompletion();
        }
      });

      guest.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'room-joined') {
          // Wait for host to send signal
        } else if (message.type === 'signal') {
          // Guest receives signal from host
          expect(message.signal).toEqual(testSignal);
          guestReceivedSignal = true;

          // Guest sends signal back
          guest.send(JSON.stringify({
            type: 'signal',
            roomCode,
            signal: testSignal
          }));

          checkCompletion();
        }
      });
    });
  });

  describe('Connection Management', () => {
    it('should clean up room when host disconnects', (done) => {
      const host = new WebSocket(`ws://localhost:${port}`);
      const guest = new WebSocket(`ws://localhost:${port}`);
      let roomCode: string;
      let errorReceived = false;

      host.on('error', () => {}); // Suppress errors
      guest.on('error', () => {}); // Suppress errors

      host.on('open', () => {
        host.send(JSON.stringify({ type: 'create-room' }));
      });

      host.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'room-created') {
          roomCode = message.roomCode;

          guest.on('open', () => {
            guest.send(JSON.stringify({ type: 'join-room', roomCode }));
          });
        } else if (message.type === 'peer-connected') {
          // Close host connection
          host.close();
        }
      });

      guest.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'room-joined') {
          // Wait for host to disconnect
        } else if (message.type === 'error' && !errorReceived) {
          errorReceived = true;
          expect(message.error).toBe('Peer disconnected');
        }
      });

      guest.on('close', () => {
        // Guest connection should be closed
        if (errorReceived) {
          done();
        }
      });
    });

    it('should handle invalid message format', (done) => {
      const client = new WebSocket(`ws://localhost:${port}`);

      client.on('error', () => {}); // Suppress errors

      client.on('open', () => {
        client.send('invalid-json');
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());

        expect(message.type).toBe('error');
        expect(message.error).toBe('Invalid message format');

        client.close();
        done();
      });
    });
  });
});
