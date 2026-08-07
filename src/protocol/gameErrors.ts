import type { HostMessage } from './messages';

const terminalJoinErrorCodes = new Set(['room_full', 'game_already_started']);

export function isTerminalJoinError(message: HostMessage): boolean {
  return message.type === 'game:error' && terminalJoinErrorCodes.has(message.code);
}
