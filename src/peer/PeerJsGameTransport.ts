import Peer, { type DataConnection } from 'peerjs';
import {
  assertHostVersionSupported,
  HOST_VERSION_HANDSHAKE_TIMEOUT_MS,
  HOST_VERSION_UNSUPPORTED_MESSAGE,
  isHostVersionUnsupportedError,
  MIN_SUPPORTED_HOST_BUILD_NUMBER,
  REQUIRED_HOST_PROTOCOL_VERSION,
  type HostVersionInfo,
} from '../config/hostCompatibility';
import { getDiagnosticErrorDetails, recordConnectionDiagnostic } from '../diagnostics/connectionDiagnostics';
import { CONNECT_TIMEOUT_MS, PEER_CONNECTION_LABEL } from '../protocol/constants';
import { isMessageWithinLimit } from '../protocol/messageSize';
import type { ClientMessage, JsonValue } from '../protocol/messages';
import { parseHostMessage } from '../protocol/parser';
import type { JoinParameters } from '../features/connection/joinParams';
import {
  createPeerJsBridgeAuthenticateMessage,
  isPeerJsTransportMessage,
  parsePeerJsBridgeChallengeMessage,
  parsePeerJsBridgeReadyMessage,
  type PeerJsBridgeChallengeMessage,
  type PeerJsBridgeReadyMessage,
} from './bridgeProtocol';
import {
  buildPeerJsHostId,
  createPeerJsProof,
  shortSessionId,
  validateOnlineJoinCredentials,
  verifyPeerJsProof,
} from './onlineJoinCredentials';
import { createPeerMetadata } from './peerMetadata';
import { createPeerRtcConfiguration } from './peerJsContract';
import type { GameTransport, TransportCallbacks, TransportConnectContext } from './transport';

export { createPeerRtcConfiguration, PEER_JS_STUN_SERVER_URL } from './peerJsContract';

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
  private authenticated = false;

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
    validateOnlineJoinCredentials(parameters);
    const hostPeerId = await buildPeerJsHostId(parameters.onlineJoinCode);
    if (this.generation !== generation || this.closedByUser) throw new Error('cancelled');

    const config = createPeerRtcConfiguration();
    recordConnectionDiagnostic('transport.connect.started', 'info', {
      connectionAttemptId,
      roomId: parameters.roomId,
      hostSessionId: shortSessionId(parameters.hostSessionId),
      hostPeerId: shortPeerId(hostPeerId),
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
        let hostVersionTimer: number | null = null;
        let challengeAccepted = false;
        let challengeProcessing = false;
        let pendingReady: PeerJsBridgeReadyMessage | null = null;
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
          if (hostVersionTimer !== null) window.clearTimeout(hostVersionTimer);
          hostVersionTimer = null;
          if (this.cancelPendingConnect === cancel) this.cancelPendingConnect = null;
          action();
        };
        const fail = (error: unknown): void => finish(() => reject(
          error instanceof Error ? error : new Error(String(error)),
        ));
        const cancel = (): void => fail(new Error('cancelled'));
        const acceptBridgeReady = (ready: PeerJsBridgeReadyMessage): void => {
          try {
            assertHostVersionSupported(ready);
            if (ready.hostSessionId !== parameters.hostSessionId) {
              throw new PeerJsAuthenticationError('host-session-mismatch');
            }
            recordConnectionDiagnostic('peerjs.bridge-ready.accepted', 'info', {
              connectionAttemptId,
              ...hostVersionDiagnosticDetails(ready),
              hostSessionId: shortSessionId(ready.hostSessionId),
              minimumBuildNumber: MIN_SUPPORTED_HOST_BUILD_NUMBER,
              requiredProtocolVersion: REQUIRED_HOST_PROTOCOL_VERSION,
            });
            finish(resolve);
          } catch (error) { fail(error); }
        };
        this.cancelPendingConnect = cancel;

        peer.on('open', (clientPeerId) => {
          if (!this.isCurrent(generation, peer)) {
            recordConnectionDiagnostic('peer.open.ignored', 'warning', { connectionAttemptId, reason: 'stale-attempt' });
            return;
          }
          if (connection !== null) return;
          recordConnectionDiagnostic('peer.open', 'info', {
            connectionAttemptId,
            clientPeerId: shortPeerId(clientPeerId),
            activePeerCount: 1,
          });
          connection = peer.connect(hostPeerId, {
            label: PEER_CONNECTION_LABEL,
            reliable: true,
            serialization: 'json',
            metadata: createPeerMetadata(parameters),
          });
          this.connection = connection;
          const details = connection as unknown as DataConnectionDetails;
          recordConnectionDiagnostic('data-connection.created', 'info', {
            connectionAttemptId,
            localPeerId: shortPeerId(clientPeerId),
            remotePeerId: shortPeerId(details.peer ?? hostPeerId),
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
              remotePeerId: shortPeerId(details.peer ?? hostPeerId),
              connectionId: details.connectionId ?? null,
            });
            recordConnectionDiagnostic('peerjs.authentication.awaiting-challenge', 'info', {
              connectionAttemptId,
              timeoutMs: HOST_VERSION_HANDSHAKE_TIMEOUT_MS,
              minimumBuildNumber: MIN_SUPPORTED_HOST_BUILD_NUMBER,
              requiredProtocolVersion: REQUIRED_HOST_PROTOCOL_VERSION,
              hostSessionId: shortSessionId(parameters.hostSessionId),
            });
            if (hostVersionTimer === null && !settled) {
              hostVersionTimer = window.setTimeout(() => {
                if (!this.isCurrent(generation, peer, connection) || settled) return;
                fail(new PeerJsAuthenticationError('missing-challenge'));
              }, HOST_VERSION_HANDSHAKE_TIMEOUT_MS);
            }
          });

          connection.on('data', (data) => {
            if (!this.isCurrent(generation, peer, connection)) return;
            const challenge = parsePeerJsBridgeChallengeMessage(data);
            if (challenge !== null) {
              if (challengeAccepted || challengeProcessing || settled) {
                fail(new PeerJsAuthenticationError('replayed-challenge'));
                return;
              }
              challengeProcessing = true;
              void this.authenticateHostChallenge(
                parameters,
                challenge,
                hostPeerId,
                connection as DataConnection,
                connectionAttemptId,
              ).then(() => {
                if (!this.isCurrent(generation, peer, connection) || settled) return;
                challengeAccepted = true;
                recordConnectionDiagnostic('peerjs.authentication.host-verified', 'info', {
                  connectionAttemptId,
                  hostSessionId: shortSessionId(parameters.hostSessionId),
                });
                const ready = pendingReady;
                pendingReady = null;
                if (ready !== null) acceptBridgeReady(ready);
              }).catch(fail).finally(() => { challengeProcessing = false; });
              return;
            }

            const ready = parsePeerJsBridgeReadyMessage(data);
            if (ready !== null) {
              if (challengeProcessing) {
                if (pendingReady !== null) {
                  fail(new PeerJsAuthenticationError('unexpected-transport-message'));
                } else {
                  pendingReady = ready;
                }
                return;
              }
              if (!challengeAccepted) {
                fail(new PeerJsAuthenticationError('ready-before-authentication'));
                return;
              }
              acceptBridgeReady(ready);
              return;
            }

            if (isPeerJsTransportMessage(data)) {
              fail(new PeerJsAuthenticationError('unexpected-transport-message'));
              return;
            }
            if (!settled) {
              fail(new PeerJsAuthenticationError('game-message-before-authentication'));
              return;
            }
            this.handleData(data);
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
            dataConnectionOpen: connection?.open ?? false,
          });
          if (!this.closedByUser && !peer.destroyed && !(connection?.open ?? false)) {
            try { peer.reconnect(); }
            catch (error) {
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
      this.authenticated = true;
      recordConnectionDiagnostic('transport.connect.open', 'info', { connectionAttemptId });
      callbacks.onState('open');
    } catch (error) {
      const isCurrent = this.isCurrent(generation, peer);
      this.authenticated = false;
      this.closeAttemptResources(peer, connection);
      if (isCurrent) {
        const userMessage = mapPeerError(error);
        recordConnectionDiagnostic('transport.connect.failed', 'error', {
          connectionAttemptId,
          ...getDiagnosticErrorDetails(error),
          userMessage,
        });
        if (!isHostVersionUnsupportedError(error)) callbacks.onState('error');
        callbacks.onError(userMessage);
      }
      throw error;
    }
  }

  private async authenticateHostChallenge(
    parameters: JoinParameters,
    challenge: PeerJsBridgeChallengeMessage,
    expectedPeerId: string,
    connection: DataConnection,
    connectionAttemptId: string,
  ): Promise<void> {
    assertHostVersionSupported(challenge);
    if (challenge.hostSessionId !== parameters.hostSessionId) {
      throw new PeerJsAuthenticationError('host-session-mismatch');
    }
    if (challenge.peerId !== expectedPeerId) {
      throw new PeerJsAuthenticationError('peer-id-mismatch');
    }
    const validHostProof = await verifyPeerJsProof(
      'host',
      parameters,
      challenge.nonce,
      expectedPeerId,
      challenge.hostProof,
    );
    if (!validHostProof) throw new PeerJsAuthenticationError('invalid-host-proof');
    const clientProof = await createPeerJsProof(
      'client',
      parameters,
      challenge.nonce,
      expectedPeerId,
    );
    if (!connection.open) throw new PeerJsAuthenticationError('connection-closed');
    await connection.send(createPeerJsBridgeAuthenticateMessage(challenge, clientProof));
    recordConnectionDiagnostic('peerjs.authentication.response-sent', 'info', {
      connectionAttemptId,
      hostSessionId: shortSessionId(parameters.hostSessionId),
    });
  }

  private isCurrent(generation: number, peer: Peer, connection?: DataConnection | null): boolean {
    return this.generation === generation
      && this.peer === peer
      && (connection === undefined || connection === null || this.connection === connection);
  }

  send(message: ClientMessage): void {
    const connection = this.connection;
    if (!connection?.open || !this.authenticated) throw new Error('Połączenie z hostem nie zostało uwierzytelnione.');
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
    this.authenticated = false;
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

function hostVersionDiagnosticDetails(hostVersion: Partial<HostVersionInfo>) {
  return {
    detectedAppVersion: hostVersion.appVersion ?? null,
    detectedBuildNumber: hostVersion.buildNumber ?? null,
    detectedProtocolVersion: hostVersion.protocolVersion ?? null,
  };
}

export type PeerJsAuthenticationFailureReason =
  | 'missing-challenge'
  | 'replayed-challenge'
  | 'ready-before-authentication'
  | 'host-session-mismatch'
  | 'peer-id-mismatch'
  | 'invalid-host-proof'
  | 'unexpected-transport-message'
  | 'game-message-before-authentication'
  | 'connection-closed';

export class PeerJsAuthenticationError extends Error {
  readonly code = 'peerjs-authentication-failed';

  constructor(readonly reason: PeerJsAuthenticationFailureReason) {
    super('Nie udało się potwierdzić tożsamości prowadzącego. Poproś o nowy kod dołączenia.');
    this.name = 'PeerJsAuthenticationError';
  }
}

export function isPeerJsAuthenticationError(error: unknown): error is PeerJsAuthenticationError {
  return error instanceof PeerJsAuthenticationError
    || (typeof error === 'object' && error !== null && 'code' in error
      && (error as { code?: unknown }).code === 'peerjs-authentication-failed');
}

function shortPeerId(peerId: string): string {
  return peerId.length <= 18 ? peerId : `${peerId.slice(0, 18)}…`;
}

export function mapPeerError(error: unknown): string {
  if (isHostVersionUnsupportedError(error)) return HOST_VERSION_UNSUPPORTED_MESSAGE;
  if (isPeerJsAuthenticationError(error)) return error.message;
  const type = typeof error === 'object' && error !== null && 'type' in error ? String(error.type) : '';
  switch (type) {
    case 'peer-unavailable': return 'Brak aktywnego pokoju o podanym kodzie. Sprawdź kod albo poproś prowadzącego o utworzenie pokoju.';
    case 'invalid-id': return 'Kod pokoju jest nieprawidłowy.';
    case 'network': case 'socket-error': case 'socket-closed': return 'Nie udało się połączyć z usługą gry. Sprawdź internet i spróbuj ponownie.';
    case 'webrtc': return 'Ta sieć blokuje bezpośrednie połączenie z telefonem prowadzącego. Spróbuj innej sieci Wi‑Fi lub komórkowej albo wyłącz VPN.';
    case 'server-error': return 'Usługa połączeń jest chwilowo niedostępna.';
    default: return error instanceof Error && error.message === 'timeout'
      ? 'Telefon prowadzącego nie odpowiedział na czas. Sprawdź, czy aplikacja prowadzącego nadal działa, i spróbuj ponownie.'
      : 'Nie udało się połączyć z prowadzącym. Sprawdź internet i spróbuj ponownie.';
  }
}
