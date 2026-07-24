import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SUPPORTED_GAME_PROTOCOL_VERSION } from '../protocol/constants';
import type { TransportCallbacks } from './transport';

const peerMock = vi.hoisted(() => ({ connect: vi.fn() }));

vi.mock('peerjs', () => {
  class MockConnection {
    open = true;
    on(event: string, callback: (value?: unknown) => void): this {
      if (event === 'open') queueMicrotask(() => callback());
      return this;
    }
    send(): void {}
    close(): void {}
  }

  return {
    default: class MockPeer {
      destroyed = false;
      on(event: string, callback: () => void): this {
        if (event === 'open') queueMicrotask(callback);
        return this;
      }
      connect(peerId: string, options: unknown): MockConnection {
        peerMock.connect(peerId, options);
        return new MockConnection();
      }
      reconnect(): void {}
      destroy(): void { this.destroyed = true; }
    },
  };
});

import { PeerJsGameTransport } from './PeerJsGameTransport';

describe('PeerJsGameTransport', () => {
  beforeEach(() => peerMock.connect.mockClear());

  it('connects to the host derived only from the room code', async () => {
    const callbacks: TransportCallbacks = {
      onState: vi.fn(),
      onMessage: vi.fn(),
      onError: vi.fn(),
    };
    const transport = new PeerJsGameTransport();

    await transport.connect({ roomId: 'ABC123' }, callbacks);

    expect(peerMock.connect).toHaveBeenCalledWith('panstwa-miasta-room-v3-abc123', {
      label: 'panstwa-miasta-game-v1',
      reliable: true,
      serialization: 'json',
      metadata: {
        room: 'ABC123',
        protocol: SUPPORTED_GAME_PROTOCOL_VERSION,
      },
    });
  });
});
