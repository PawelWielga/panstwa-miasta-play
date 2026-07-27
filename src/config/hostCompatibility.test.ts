import { describe, expect, it } from 'vitest';
import {
  assertHostVersionSupported,
  MIN_SUPPORTED_HOST_BUILD_NUMBER,
  REQUIRED_HOST_PROTOCOL_VERSION,
  type HostVersionInfo,
  type HostVersionRejectionReason,
} from './hostCompatibility';

function expectRejected(hostVersion: HostVersionInfo, reason: HostVersionRejectionReason): void {
  try {
    assertHostVersionSupported(hostVersion);
    throw new Error('Expected host version rejection.');
  } catch (error) {
    expect(error).toMatchObject({
      code: 'host-version-unsupported',
      reason,
    });
  }
}

describe('host compatibility', () => {
  it('accepts the current supported host', () => {
    expect(() => assertHostVersionSupported({
      appVersion: '1.1.7',
      buildNumber: MIN_SUPPORTED_HOST_BUILD_NUMBER,
      protocolVersion: REQUIRED_HOST_PROTOCOL_VERSION,
    })).not.toThrow();
  });

  it('rejects a host below the minimum build number', () => {
    expectRejected({
      appVersion: '1.1.6',
      buildNumber: MIN_SUPPORTED_HOST_BUILD_NUMBER - 1,
      protocolVersion: REQUIRED_HOST_PROTOCOL_VERSION,
    }, 'build-number-too-low');
  });

  it('rejects a host with a different protocol version', () => {
    expectRejected({
      appVersion: '1.1.7',
      buildNumber: MIN_SUPPORTED_HOST_BUILD_NUMBER,
      protocolVersion: REQUIRED_HOST_PROTOCOL_VERSION - 1,
    }, 'protocol-version-mismatch');
  });
});
