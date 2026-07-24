import Peer, { type DataConnection } from 'peerjs';
import { CONNECT_TIMEOUT_MS, PEER_CONNECTION_LABEL } from '../protocol/constants';
import { isMessageWithinLimit } from '../protocol/messageSize';
import type { ClientMessage, JsonValue } from '../protocol/messages';
import { parseHostMessage } from '../protocol/parser';
import type { JoinParameters } from '../features/connection/joinParams';
import { buildPeerJsHostId } from './peerHostId';
import { createPeerMetadata } from './peerMetadata';
import type { GameTransport, TransportCallbacks } from './transport';

interface PeerRtcConfiguration extends RTCConfiguration { sdpSemantics?: 'unified-plan' }

export class PeerJsGameTransport implements GameTransport {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private callbacks: TransportCallbacks | null = null;
  private closedByUser = false;

  async connect(parameters: JoinParameters, callbacks: TransportCallbacks): Promise<void> {
    this.close();
    this.closedByUser = false;
    this.callbacks = callbacks;
    callbacks.onState('connecting');

    const config: PeerRtcConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      sdpSemantics: 'unified-plan',
    };
    const peer = new Peer({ config });
    this.peer = peer;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => fail(new Error('timeout')), CONNECT_TIMEOUT_MS);
      const finish = (action: () => void): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        action();
      };
      const fail = (error: unknown): void => finish(() => reject(error instanceof Error ? error : new Error(String(error))));

      peer.on('open', () => {
        if (this.closedByUser) return fail(new Error('cancelled'));
        const connection = peer.connect(buildPeerJsHostId(parameters.roomId), {
          label: PEER_CONNECTION_LABEL,
          reliable: true,
          serialization: 'json',
          metadata: createPeerMetadata(parameters.roomId),
        });
        this.connection = connection;
        connection.on('open', () => finish(resolve));
        connection.on('data', (data) => this.handleData(data));
        connection.on('close', () => this.handleClosed());
        connection.on('error', (error) => this.handleError(error));
      });
      peer.on('error', fail);
      peer.on('disconnected', () => {
        if (!this.closedByUser && !peer.destroyed) {
          try { peer.reconnect(); } catch { this.handleClosed(); }
        }
      });
    }).then(() => callbacks.onState('open')).catch((error: unknown) => {
      if (!this.closedByUser) {
        callbacks.onState('error');
        callbacks.onError(mapPeerError(error));
      }
      throw error;
    });
  }

  send(message: ClientMessage): void {
    const connection = this.connection;
    if (!connection?.open) throw new Error('Połączenie z hostem nie jest otwarte.');
    if (!isMessageWithinLimit(message as unknown as JsonValue)) throw new Error('Wiadomość przekracza limit 64 KiB.');
    void connection.send(message);
  }

  close(): void {
    this.closedByUser = true;
    const connection = this.connection;
    const peer = this.peer;
    this.connection = null;
    this.peer = null;
    this.callbacks = null;
    try { connection?.close(); } catch { /* best effort */ }
    try { peer?.destroy(); } catch { /* best effort */ }
  }

  private handleData(data: unknown): void {
    const parsed = parseHostMessage(data);
    if (parsed.ok) this.callbacks?.onMessage(parsed.message);
    else this.callbacks?.onError(`Host wysłał niepoprawne dane: ${parsed.reason}`);
  }
  private handleClosed(): void {
    if (this.closedByUser) return;
    this.callbacks?.onState('closed');
  }
  private handleError(error: unknown): void {
    if (this.closedByUser) return;
    this.callbacks?.onState('error');
    this.callbacks?.onError(mapPeerError(error));
  }
}

export function mapPeerError(error: unknown): string {
  const type = typeof error === 'object' && error !== null && 'type' in error ? String(error.type) : '';
  switch (type) {
    case 'peer-unavailable': return 'Brak aktywnego pokoju o podanym kodzie. Sprawdź kod albo poproś prowadzącego o utworzenie pokoju.';
    case 'invalid-id': return 'Kod pokoju jest nieprawidłowy.';
    case 'network': case 'socket-error': case 'socket-closed': return 'Nie udało się połączyć z usługą gry. Sprawdź internet i spróbuj ponownie.';
    case 'webrtc': return 'Nie udało się połączyć z telefonem prowadzącego. Spróbuj innej sieci Wi‑Fi albo wyłącz VPN.';
    case 'server-error': return 'Usługa połączeń jest chwilowo niedostępna.';
    default: return error instanceof Error && error.message === 'timeout'
      ? 'Przekroczono czas zestawiania połączenia. Sprawdź, czy pokój nadal istnieje.'
      : 'Nie udało się połączyć z prowadzącym. Sprawdź internet i spróbuj ponownie.';
  }
}
