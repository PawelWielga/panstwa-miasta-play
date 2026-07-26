import Peer, { type DataConnection } from 'peerjs';
import { getDiagnosticErrorDetails, recordConnectionDiagnostic } from '../diagnostics/connectionDiagnostics';
import { CONNECT_TIMEOUT_MS, PEER_CONNECTION_LABEL } from '../protocol/constants';
import { isMessageWithinLimit } from '../protocol/messageSize';
import type { ClientMessage, JsonValue } from '../protocol/messages';
import { parseHostMessage } from '../protocol/parser';
import type { JoinParameters } from '../features/connection/joinParams';
import { buildPeerJsHostId } from './peerHostId';
import { createPeerMetadata } from './peerMetadata';
import type { GameTransport, TransportCallbacks, TransportConnectContext } from './transport';

interface PeerRtcConfiguration extends RTCConfiguration { sdpSemantics?: 'unified-plan' }
type DataConnectionDetails = {
  peer?: string;
  connectionId?: string;
  peerConnection?: RTCPeerConnection;
};

let generatedAttemptSequence = 0;

function generateConnectionAttemptId(): string {
  generatedAttemptSequence += 1;
  return `web-${Date.now().toString(36)}-${generatedAttemptSequence.toString(36)}`;
}

export class PeerJsGameTransport implements GameTransport {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private callbacks: TransportCallbacks | null = null;
  private closedByUser = false;
  private detachPeerConnectionDiagnostics: (() => void) | null = null;
  private connectPromise: Promise<void> | null = null;
  private cancelPendingConnect: (() => void) | null = null;
  private generation = 0;
  private connectionAttemptId: string | null = null;

  connect(
    parameters: JoinParameters,
    callbacks: TransportCallbacks,
    context?: TransportConnectContext,
  ): Promise<void> {
    const currentConnect = this.connectPromise;
    if (currentConnect) {
      recordConnectionDiagnostic('transport.connect.deduplicated', 'warning', {
        connectionAttemptId: this.connectionAttemptId,
      });
      return currentConnect;
    }

    this.close();
    this.closedByUser = false;
    this.callbacks = callbacks;
    const generation = this.generation + 1;
    this.generation = generation;
    const connectionAttemptId = context?.connectionAttemptId ?? generateConnectionAttemptId();
    this.connectionAttemptId = connectionAttemptId;

    const connectPromise = this.connectAttempt(
      parameters,
      callbacks,
      generation,
      connectionAttemptId,
    );
    this.connectPromise = connectPromise;
    void connectPromise.finally(() => {
      if (this.connectPromise === connectPromise) this.connectPromise = null;
    }).catch(() => undefined);
    return connectPromise;
  }

  private async connectAttempt(
    parameters: JoinParameters,
    callbacks: TransportCallbacks,
    generation: number,
    connectionAttemptId: string,
  ): Promise<void> {
    callbacks.onState('connecting');

    const hostPeerId = buildPeerJsHostId(parameters.roomId);
    const config: PeerRtcConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      sdpSemantics: 'unified-plan',
    };
    recordConnectionDiagnostic('transport.connect.started', 'info', {
      connectionAttemptId,
      roomId: parameters.roomId,
      hostPeerId,
      timeoutMs: CONNECT_TIMEOUT_MS,
      iceServerCount: config.iceServers?.length ?? 0,
      activePeerCount: 1,
      activeConnectionCount: 0,
    });

    const peer = new Peer({ config });
    this.peer = peer;
    let connection: DataConnection | null = null;
    recordConnectionDiagnostic('peer.created', 'info', {
      connectionAttemptId,
      createdAt: new Date().toISOString(),
      activePeerCount: 1,
    });

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timer = window.setTimeout(() => {
          recordConnectionDiagnostic('transport.connect.timeout', 'error', {
            connectionAttemptId,
            timeoutMs: CONNECT_TIMEOUT_MS,
          });
          fail(new Error('timeout'));
        }, CONNECT_TIMEOUT_MS);
        const finish = (action: () => void): void => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          if (this.cancelPendingConnect === cancel) this.cancelPendingConnect = null;
          action();
        };
        const fail = (error: unknown): void => finish(() => reject(
          error instanceof Error ? error : new Error(String(error)),
        ));
        const cancel = (): void => fail(new Error('cancelled'));
        this.cancelPendingConnect = cancel;

        peer.on('open', (clientPeerId) => {
          if (!this.isCurrent(generation, peer)) {
            recordConnectionDiagnostic('peer.open.ignored', 'warning', {
              connectionAttemptId,
              reason: 'stale-attempt',
            });
            return;
          }
          recordConnectionDiagnostic('peer.open', 'info', {
            connectionAttemptId,
            clientPeerId,
            activePeerCount: 1,
          });
          if (connection !== null) {
            recordConnectionDiagnostic('data-connection.create.skipped', 'warning', {
              connectionAttemptId,
              reason: 'already-created',
            });
            return;
          }
          connection = peer.connect(hostPeerId, {
            label: PEER_CONNECTION_LABEL,
            reliable: true,
            serialization: 'json',
            metadata: createPeerMetadata(parameters.roomId),
          });
          this.connection = connection;
          const details = connection as unknown as DataConnectionDetails;
          recordConnectionDiagnostic('data-connection.created', 'info', {
            connectionAttemptId,
            localPeerId: clientPeerId,
            remotePeerId: details.peer ?? hostPeerId,
            connectionId: details.connectionId ?? null,
            label: PEER_CONNECTION_LABEL,
            reliable: true,
            serialization: 'json',
            activePeerCount: 1,
            activeConnectionCount: 1,
          });
          this.attachPeerConnectionDiagnostics(connection, connectionAttemptId);
          connection.on('open', () => {
            if (!this.isCurrent(generation, peer, connection)) return;
            recordConnectionDiagnostic('data-connection.open', 'info', {
              connectionAttemptId,
              remotePeerId: details.peer ?? hostPeerId,
              connectionId: details.connectionId ?? null,
            });
            finish(resolve);
          });
          connection.on('data', (data) => {
            if (this.isCurrent(generation, peer, connection)) this.handleData(data);
          });
          connection.on('close', () => {
            if (!this.isCurrent(generation, peer, connection)) return;
            if (!settled) fail(new Error('connection-closed'));
            else this.handleClosed();
          });
          connection.on('error', (error) => {
            if (!this.isCurrent(generation, peer, connection)) return;
            if (!settled) fail(error);
            else this.handleError(error);
          });
        });
        peer.on('error', (error) => {
          if (!this.isCurrent(generation, peer)) return;
          recordConnectionDiagnostic('peer.error', 'error', {
            connectionAttemptId,
            ...getDiagnosticErrorDetails(error),
          });
          if (!settled) fail(error);
          else this.handleError(error);
        });
        peer.on('disconnected', () => {
          if (!this.isCurrent(generation, peer)) return;
          recordConnectionDiagnostic('peer.disconnected', 'warning', {
            connectionAttemptId,
            destroyed: peer.destroyed,
          });
          if (!this.closedByUser && !peer.destroyed) {
            try {
              peer.reconnect();
              recordConnectionDiagnostic('peer.reconnect.requested', 'warning', { connectionAttemptId });
            } catch (error) {
              recordConnectionDiagnostic('peer.reconnect.failed', 'error', {
                connectionAttemptId,
                ...getDiagnosticErrorDetails(error),
              });
              if (!settled) fail(error);
              else this.handleClosed();
            }
          }
        });
        peer.on('close', () => {
          if (!this.isCurrent(generation, peer)) return;
          recordConnectionDiagnostic('peer.closed', this.closedByUser ? 'info' : 'warning', {
            connectionAttemptId,
            activePeerCount: 0,
          });
          if (!settled) fail(new Error('peer-closed'));
        });
      });

      if (!this.isCurrent(generation, peer, connection)) throw new Error('cancelled');
      recordConnectionDiagnostic('transport.connect.open', 'info', { connectionAttemptId });
      callbacks.onState('open');
    } catch (error) {
      const isCurrent = this.isCurrent(generation, peer);
      this.closeAttemptResources(peer, connection);
      if (isCurrent && !this.closedByUser) {
        const userMessage = mapPeerError(error);
        recordConnectionDiagnostic('transport.connect.failed', 'error', {
          connectionAttemptId,
          ...getDiagnosticErrorDetails(error),
          userMessage,
        });
        callbacks.onState('error');
        callbacks.onError(userMessage);
      } else {
        recordConnectionDiagnostic('transport.connect.result.ignored', 'info', {
          connectionAttemptId,
          reason: 'stale-or-cancelled',
        });
      }
      throw error;
    }
  }

  private isCurrent(generation: number, peer: Peer, connection?: DataConnection | null): boolean {
    return this.generation === generation
      && this.peer === peer
      && (connection === undefined || connection === null || this.connection === connection);
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
    const connectionAttemptId = this.connectionAttemptId;
    const hadTransport = connection !== null || peer !== null;
    this.closedByUser = true;
    this.generation += 1;
    this.cancelPendingConnect?.();
    this.cancelPendingConnect = null;
    this.connectPromise = null;
    this.connection = null;
    this.peer = null;
    this.callbacks = null;
    this.connectionAttemptId = null;
    this.detachPeerConnectionDiagnostics?.();
    this.detachPeerConnectionDiagnostics = null;
    if (hadTransport) {
      recordConnectionDiagnostic('transport.close.requested', 'info', {
        connectionAttemptId,
        dataConnectionOpen: connection?.open ?? false,
        peerDestroyed: peer?.destroyed ?? false,
        activePeerCount: 0,
        activeConnectionCount: 0,
      });
    }
    this.closeAttemptResources(peer, connection);
  }

  private closeAttemptResources(peer: Peer | null, connection: DataConnection | null): void {
    if (this.peer === peer) {
      this.detachPeerConnectionDiagnostics?.();
      this.detachPeerConnectionDiagnostics = null;
      this.peer = null;
      this.connection = null;
    }
    try { connection?.close(); } catch (error) {
      recordConnectionDiagnostic('data-connection.close.failed', 'warning', getDiagnosticErrorDetails(error));
    }
    try { if (peer && !peer.destroyed) peer.destroy(); } catch (error) {
      recordConnectionDiagnostic('peer.destroy.failed', 'warning', getDiagnosticErrorDetails(error));
    }
  }

  private attachPeerConnectionDiagnostics(connection: DataConnection, connectionAttemptId: string): void {
    const peerConnection = (connection as unknown as DataConnectionDetails).peerConnection;
    if (!peerConnection) {
      recordConnectionDiagnostic('webrtc.peer-connection.unavailable', 'warning', { connectionAttemptId });
      return;
    }

    this.detachPeerConnectionDiagnostics?.();
    const logState = (event: string): void => {
      const isFailure = peerConnection.connectionState === 'failed'
        || peerConnection.connectionState === 'disconnected'
        || peerConnection.iceConnectionState === 'failed'
        || peerConnection.iceConnectionState === 'disconnected';
      recordConnectionDiagnostic(event, isFailure ? 'warning' : 'info', {
        connectionAttemptId,
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
      recordConnectionDiagnostic('webrtc.ice-candidate', 'info', { connectionAttemptId, candidateType, protocol });
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
        connectionAttemptId: this.connectionAttemptId,
        reason: parsed.reason,
        valueKind: data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data,
      });
      this.callbacks?.onError(`Host wysłał niepoprawne dane: ${parsed.reason}`);
    }
  }

  private handleClosed(): void {
    if (this.closedByUser) return;
    recordConnectionDiagnostic('data-connection.closed', 'warning', {
      connectionAttemptId: this.connectionAttemptId,
      activeConnectionCount: 0,
    });
    this.callbacks?.onState('closed');
  }

  private handleError(error: unknown): void {
    if (this.closedByUser) return;
    const userMessage = mapPeerError(error);
    recordConnectionDiagnostic('data-connection.error', 'error', {
      connectionAttemptId: this.connectionAttemptId,
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
