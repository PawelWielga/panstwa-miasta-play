import type { ClientMessage, HostMessage } from '../protocol/messages';
import type { JoinParameters } from '../features/connection/joinParams';

export type TransportState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
export interface TransportCallbacks {
  onState: (state: TransportState) => void;
  onMessage: (message: HostMessage) => void;
  onError: (message: string) => void;
}
export interface GameTransport {
  connect(parameters: JoinParameters, callbacks: TransportCallbacks): Promise<void>;
  send(message: ClientMessage): void;
  close(): void;
}
