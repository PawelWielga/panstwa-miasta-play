import Peer, { type DataConnection } from 'peerjs';
import { getDiagnosticErrorDetails, recordConnectionDiagnostic } from '../diagnostics/connectionDiagnostics';
import { CONNECT_TIMEOUT_MS, PEER_CONNECTION_LABEL } from '../protocol/constants';
import { isMessageWithinLimit } from '../protocol/messageSize';
import type { ClientMessage, JsonValue } from '../protocol/messages';
import { parseHostMessage } from '../protocol/parser';
import type { JoinParameters } from '../features/connection/joinParams';
import { buildPeerJsHostId } from './peerHostId';
import { createPeerMetadata } from './peerMetadata';
import type { GameTransport, TransportCallbacks } from './transport';

interface PeerRtcConfiguration extends RTCConfiguration { sdpSemantics?: 'unified-plan' }
type DataConnectionWithPeerConnection = { peerConnection?: RTCPeerConnection };

export class PeerJsGameTransport implements GameTransport {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private callbacks: TransportCallbacks | null = null;
  private closedByUser = false;
  private detachPeerConnectionDiagnostics: (() => void) | null = null;

  async connect(parameters: JoinParameters, callbacks: TransportCallbacks): Promise<void> {
    this.close();
    this.closedByUser = false;
    this.callbacks = callbacks;
    callbacks.onState('connecting');

    const hostPeerId = buildPeerJsHostId(parameters.roomId);
    const config: PeerRtcConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      sdpSemantics: 'unified-plan',
    };
    recordConnectionDiagnostic('transport.connect.started', 'info', {
      roomId: parameters.roomId,
      hostPeerId,
      timeoutMs: CONNECT_TIMEOUT_MS,
      iceServerCount: config.iceServers?.length ?? 0,
    });

    const peer = new Peer({ config });
    this.peer = peer;
    recordConnectionDiagnostic('peer.created');

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        recordConnectionDiagnostic('transport.connect.timeout', 'error', { timeoutMs: CONNECT_TIMEOUT_MS });
        fail(new Error('timeout'));
      }, CONNECT_TIMEOUT_MS);
      const finish = (action: () => void): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        action();
      };
      const fail = (error: unknown): void => finish(() => reject(error instanceof Error ? error : new Error(String(error))));

      peer.on('open', (clientPeerId) => {
        recordConnectionDiagnostic('peer.open', 'info', { clientPeerIdLength: clientPeerId.length });
        if (this.closedByUser) return fail(new Error('cancelled'));
        const connection = peer.connect(hostPeerId, {
          label: PEER_CONNECTION_LABEL,
          reliable: true,
          serialization: 'json',
          metadata: createPeerMetadata(parameters.roomId),
        });
        this.connection = connection;
        recordConnectionDiagnostic('data-connection.created', 'info', {
          label: PEER_CONNECTION_LABEL,
          reliable: true,
          serialization: 'json',
        });
        this.attachPeerConnectionDiagnostics(connection);
        connection.on('open', () => {
          recordConnectionDiagnostic('data-connection.open');
          finish(resolve);
        });
        connection.on('data', (data) => this.handleData(data));
        connection.on('close', () => this.handleClosed());
        connection.on('error', (error) => this.handleError(error));
      });
      peer.on('error', (error) => {
        recordConnectionDiagnostic('peer.error', 'error', getDiagnosticErrorDetails(error));
        fail(error);
      });
      peer.on('disconnected', () => {
        recordConnectionDiagnostic('peer.disconnected', 'warning', { destroyed: peer.destroyed });
        if (!this.closedByUser && !peer.destroyed) {
          try {
            peer.reconnect();
            recordConnectionDiagnostic('peer.reconnect.requested', 'warning');
          } catch (error) {
            recordConnectionDiagnostic('peer.reconnect.failed', 'error', getDiagnosticErrorDetails(error));
            this.handleClosed();
          }
        }
      });
      peer.on('close', () => recordConnectionDiagnostic('peer.closed', this.closedByUser ? 'info' : 'warning'));
    }).then(() => {
      recordConnectionDiagnostic('transport.connect.open');
      callbacks.onState('open');
    }).catch((error: unknown) => {
      if (!this.closedByUser) {
        const userMessage = mapPeerError(error);
        recordConnectionDiagnostic('transport.connect.failed', 'error', {
          ...getDiagnosticErrorDetails(error),
          userMessage,
        });
        callbacks.onState('error');
        callbacks.onError(userMessage);
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
    const connection = this.connection;
    const peer = this.peer;
    const hadTransport = connection !== null || peer !== null;
    this.closedByUser = true;
    this.connection = null;
    this.peer = null;
    this.callbacks = null;
    this.detachPeerConnectionDiagnostics?.();
    this.detachPeerConnectionDiagnostics = null;
    if (hadTransport) {
      recordConnectionDiagnostic('transport.close.requested', 'info', {
        dataConnectionOpen: connection?.open ?? false,
        peerDestroyed: peer?.destroyed ?? false,
      });
    }
    try { connection?.close(); } catch (error) {
      recordConnectionDiagnostic('data-connection.close.failed', 'warning', getDiagnosticErrorDetails(error));
    }
    try { peer?.destroy(); } catch (error) {
      recordConnectionDiagnostic('peer.destroy.failed', 'warning', getDiagnosticErrorDetails(error));
    }
  }

  private attachPeerConnectionDiagnostics(connection: DataConnection): void {
    const peerConnection = (connection as unknown as DataConnectionWithPeerConnection).peerConnection;
    if (!peerConnection) {
      recordConnectionDiagnostic('webrtc.peer-connection.unavailable', 'warning');
      return;
    }

    this.detachPeerConnectionDiagnostics?.();
    const logState = (event: string): void => {
      const isFailure = peerConnection.connectionState === 'failed'
        || peerConnection.connectionState === 'disconnected'
        || peerConnection.iceConnectionState === 'failed'
        || peerConnection.iceConnectionState === 'disconnected';
      recordConnectionDiagnostic(event, isFailure ? 'warning' : 'info', {
        connectionState: peerConnection.connectionState,
        iceConnectionState: peerConnection.iceConnectionState,
        iceGatheringState: peerConnection.iceGatheringState,
        signalingState: peerConnection.signalingState,
      });
    };
    const onConnectionStateChange = (): void => logState('webrtc.connection-state.changed');
    const onIceConnectionStateChange = (): void => logState('webrtc.ice-connection-state.changed');
    const onIceGatheringStateChange = (): void => logState('webrtc.ice-gathering-state.changed');
    const onSignalingStateChange = (): void => logState('webrtc.signaling-state.changed');
    const onIceCandidate = (event: RTCPeerConnectionIceEvent): void => {
      const candidate = event.candidate?.candidate ?? '';
      const candidateType = event.candidate === null
        ? 'complete'
        : /\btyp\s+([a-z0-9-]+)/i.exec(candidate)?.[1] ?? 'unknown';
      const protocol = event.candidate === null ? null : candidate.split(/\s+/)[2]?.toLowerCase() ?? null;
      recordConnectionDiagnostic('webrtc.ice-candidate', 'info', { candidateType, protocol });
    };

    peerConnection.addEventListener('connectionstatechange', onConnectionStateChange);
    peerConnection.addEventListener('iceconnectionstatechange', onIceConnectionStateChange);
    peerConnection.addEventListener('icegatheringstatechange', onIceGatheringStateChange);
    peerConnection.addEventListener('signalingstatechange', onSignalingStateChange);
    peerConnection.addEventListener('icecandidate', onIceCandidate);
    this.detachPeerConnectionDiagnostics = () => {
      peerConnection.removeEventListener('connectionstatechange', onConnectionStateChange);
      peerConnection.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange);
      peerConnection.removeEventListener('icegatheringstatechange', onIceGatheringStateChange);
      peerConnection.removeEventListener('signalingstatechange', onSignalingStateChange);
      peerConnection.removeEventListener('icecandidate', onIceCandidate);
    };
    logState('webrtc.peer-connection.attached');
  }

  private handleData(data: unknown): void {
    const parsed = parseHostMessage(data);
    if (parsed.ok) this.callbacks?.onMessage(parsed.message);
    else {
      recordConnectionDiagnostic('host-message.invalid', 'error', {
        reason: parsed.reason,
        valueKind: data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data,
      });
      this.callbacks?.onError(`Host wysłał niepoprawne dane: ${parsed.reason}`);
    }
  }

  private handleClosed(): void {
    if (this.closedByUser) return;
    recordConnectionDiagnostic('data-connection.closed', 'warning');
    this.callbacks?.onState('closed');
  }

  private handleError(error: unknown): void {
    if (this.closedByUser) return;
    const userMessage = mapPeerError(error);
    recordConnectionDiagnostic('data-connection.error', 'error', {
      ...getDiagnosticErrorDetails(error),
      userMessage,
    });
    this.callbacks?.onState('error');
    this.callbacks?.onError(userMessage);
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
