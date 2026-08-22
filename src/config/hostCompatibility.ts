import { PEER_JS_ONLINE_PROTOCOL_VERSION } from '../protocol/constants';

export const MIN_SUPPORTED_HOST_BUILD_NUMBER = 10;
export const REQUIRED_HOST_PROTOCOL_VERSION = PEER_JS_ONLINE_PROTOCOL_VERSION;
export const HOST_VERSION_HANDSHAKE_TIMEOUT_MS = 5_000;
export const HOST_VERSION_UNSUPPORTED_MESSAGE =
  'Prowadzący używa starszej wersji gry. Aby dołączyć do pokoju, poproś prowadzącego o aktualizację aplikacji Państwa Miasta.';

export interface HostVersionInfo {
  appVersion: string;
  buildNumber: number;
  protocolVersion: number;
}

export type HostVersionRejectionReason =
  | 'missing-version-info'
  | 'build-number-too-low'
  | 'protocol-version-mismatch';

export class HostVersionUnsupportedError extends Error {
  readonly code = 'host-version-unsupported';

  constructor(
    readonly reason: HostVersionRejectionReason,
    readonly hostVersion: Partial<HostVersionInfo> = {},
  ) {
    super(HOST_VERSION_UNSUPPORTED_MESSAGE);
    this.name = 'HostVersionUnsupportedError';
  }
}

export function assertHostVersionSupported(hostVersion: HostVersionInfo): void {
  if (hostVersion.buildNumber < MIN_SUPPORTED_HOST_BUILD_NUMBER) {
    throw new HostVersionUnsupportedError('build-number-too-low', hostVersion);
  }
  if (hostVersion.protocolVersion !== REQUIRED_HOST_PROTOCOL_VERSION) {
    throw new HostVersionUnsupportedError('protocol-version-mismatch', hostVersion);
  }
}

export function isHostVersionUnsupportedError(error: unknown): error is HostVersionUnsupportedError {
  return error instanceof HostVersionUnsupportedError
    || (typeof error === 'object'
      && error !== null
      && 'code' in error
      && (error as { code?: unknown }).code === 'host-version-unsupported');
}
