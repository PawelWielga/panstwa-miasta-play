import type { ClientMessage, HostMessage } from '../protocol/messages';
import type { JoinParameters } from '../features/connection/joinParams';
import type { ConnectionFailureCode } from '../protocol/connectionFailure';

export type TransportState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
export interface TransportCallbacks {
  onState: (state: TransportState) => void;
  onMessage: (message: HostMessage) => void;
  onError: (failureCode: ConnectionFailureCode) => void;
}
export interface TransportConnectContext {
  connectionAttemptId: string;
}
export interface GameTransport {
  connect(
    parameters: JoinParameters,
    callbacks: TransportCallbacks,
    context?: TransportConnectContext,
  ): Promise<void>;
  send(message: ClientMessage): void;
  close(): void;
}
