import type { GameErrorMessage, HostMessage } from './messages';

type TerminalJoinErrorCode = 'room_full' | 'game_already_started';
type TerminalJoinErrorMessage = GameErrorMessage & { code: TerminalJoinErrorCode };

const terminalJoinErrorCodes = new Set<TerminalJoinErrorCode>(['room_full', 'game_already_started']);

export function isTerminalJoinError(message: HostMessage): message is TerminalJoinErrorMessage {
  return message.type === 'game:error'
    && message.code !== undefined
    && terminalJoinErrorCodes.has(message.code as TerminalJoinErrorCode);
}
