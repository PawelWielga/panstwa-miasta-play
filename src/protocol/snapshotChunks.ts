import {
  MAX_ACTIVE_SNAPSHOT_CHUNK_ASSEMBLIES,
  MAX_SNAPSHOT_BYTES,
  SNAPSHOT_CHUNK_ASSEMBLY_TIMEOUT_MS,
  SNAPSHOT_CHUNK_RAW_BYTES,
} from './constants';
import type { GameSnapshot, MessageMetadata } from './messages';
import { parseSnapshot } from './validation';

export interface GameSnapshotChunkMessage extends MessageMetadata {
  type: 'game:snapshot-chunk';
  gameId: string;
  sequenceNumber: number;
  chunkIndex: number;
  chunkCount: number;
  payload: string;
}

type SnapshotChunkAssembly = {
  gameId: string;
  sequenceNumber: number;
  chunkCount: number;
  chunks: Array<Uint8Array | null>;
  totalBytes: number;
  updatedAt: number;
};

export class GameSnapshotChunkAssembler {
  private readonly assemblies = new Map<string, SnapshotChunkAssembly>();

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly timeoutMs = SNAPSHOT_CHUNK_ASSEMBLY_TIMEOUT_MS,
    private readonly maxActiveAssemblies = MAX_ACTIVE_SNAPSHOT_CHUNK_ASSEMBLIES,
  ) {}

  get pendingAssemblyCount(): number { return this.assemblies.size; }

  reset(): void { this.assemblies.clear(); }

  add(message: GameSnapshotChunkMessage): GameSnapshot | null {
    const now = this.now();
    this.removeExpired(now);

    const chunk = decodeBase64(message.payload);
    if (!chunk || chunk.byteLength === 0 || chunk.byteLength > SNAPSHOT_CHUNK_RAW_BYTES) return null;

    const key = assemblyKey(message.gameId, message.sequenceNumber);
    let assembly = this.assemblies.get(key);
    if (!assembly) {
      this.ensureCapacity();
      assembly = {
        gameId: message.gameId,
        sequenceNumber: message.sequenceNumber,
        chunkCount: message.chunkCount,
        chunks: Array.from({ length: message.chunkCount }, () => null),
        totalBytes: 0,
        updatedAt: now,
      };
      this.assemblies.set(key, assembly);
    } else if (assembly.chunkCount !== message.chunkCount) {
      this.assemblies.delete(key);
      return null;
    }

    const existing = assembly.chunks[message.chunkIndex];
    if (existing) {
      if (!sameBytes(existing, chunk)) this.assemblies.delete(key);
      else assembly.updatedAt = now;
      return null;
    }

    assembly.chunks[message.chunkIndex] = chunk;
    assembly.totalBytes += chunk.byteLength;
    assembly.updatedAt = now;
    if (assembly.totalBytes > MAX_SNAPSHOT_BYTES) {
      this.assemblies.delete(key);
      return null;
    }
    if (assembly.chunks.some((item) => item === null)) return null;

    this.assemblies.delete(key);
    const bytes = new Uint8Array(assembly.totalBytes);
    let offset = 0;
    for (const part of assembly.chunks) {
      if (!part) return null;
      bytes.set(part, offset);
      offset += part.byteLength;
    }

    try {
      const json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
      const snapshot = parseSnapshot(json);
      if (!snapshot || snapshot.gameId !== message.gameId || snapshot.sequenceNumber !== message.sequenceNumber) return null;
      for (const [pendingKey, pending] of this.assemblies) {
        if (pending.gameId === snapshot.gameId && pending.sequenceNumber <= snapshot.sequenceNumber) {
          this.assemblies.delete(pendingKey);
        }
      }
      return snapshot;
    } catch {
      return null;
    }
  }

  private removeExpired(now: number): void {
    const cutoff = now - this.timeoutMs;
    for (const [key, assembly] of this.assemblies) {
      if (assembly.updatedAt < cutoff) this.assemblies.delete(key);
    }
  }

  private ensureCapacity(): void {
    if (this.assemblies.size < this.maxActiveAssemblies) return;
    let oldestKey: string | null = null;
    let oldestUpdatedAt = Number.POSITIVE_INFINITY;
    for (const [key, assembly] of this.assemblies) {
      if (assembly.updatedAt < oldestUpdatedAt) {
        oldestKey = key;
        oldestUpdatedAt = assembly.updatedAt;
      }
    }
    if (oldestKey) this.assemblies.delete(oldestKey);
  }
}

function assemblyKey(gameId: string, sequenceNumber: number): string {
  return `${gameId}:${String(sequenceNumber)}`;
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    const decoded = globalThis.atob(value);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
