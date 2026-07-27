import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(source, before, after, description) {
  if (source.includes(after)) return source;
  const firstIndex = source.indexOf(before);
  if (firstIndex < 0) throw new Error(`Missing expected fragment: ${description}`);
  if (source.indexOf(before, firstIndex + before.length) >= 0) {
    throw new Error(`Expected exactly one fragment: ${description}`);
  }
  return source.replace(before, after);
}

const transportPath = 'src/peer/PeerJsGameTransport.ts';
let transport = readFileSync(transportPath, 'utf8');
transport = replaceOnce(
  transport,
  "import { buildPeerJsHostId } from './peerHostId';\n",
  "import { isPeerJsBridgeReadyMessage } from './bridgeProtocol';\nimport { buildPeerJsHostId } from './peerHostId';\n",
  'bridge protocol import',
);
transport = replaceOnce(
  transport,
  `          connection.on('open', () => {\n            if (!this.isCurrent(generation, peer, connection)) return;\n            recordConnectionDiagnostic('data-connection.open', 'info', {\n              connectionAttemptId,\n              remotePeerId: details.peer ?? hostPeerId,\n              connectionId: details.connectionId ?? null,\n            });\n            finish(resolve);\n          });`,
  `          connection.on('open', () => {\n            if (!this.isCurrent(generation, peer, connection)) return;\n            recordConnectionDiagnostic('data-connection.open', 'info', {\n              connectionAttemptId,\n              remotePeerId: details.peer ?? hostPeerId,\n              connectionId: details.connectionId ?? null,\n            });\n            recordConnectionDiagnostic('data-connection.awaiting-bridge-ready', 'info', {\n              connectionAttemptId,\n            });\n          });`,
  'DataConnection open handler',
);
transport = replaceOnce(
  transport,
  `          connection.on('data', (data) => {\n            if (this.isCurrent(generation, peer, connection)) this.handleData(data);\n          });`,
  `          connection.on('data', (data) => {\n            if (!this.isCurrent(generation, peer, connection)) return;\n            if (isPeerJsBridgeReadyMessage(data)) {\n              recordConnectionDiagnostic('peerjs.bridge-ready.received', 'info', {\n                connectionAttemptId,\n              });\n              if (!settled) finish(resolve);\n              return;\n            }\n            if (!settled) {\n              recordConnectionDiagnostic('host-message.ignored', 'warning', {\n                connectionAttemptId,\n                reason: 'bridge-not-ready',\n              });\n              return;\n            }\n            this.handleData(data);\n          });`,
  'DataConnection data handler',
);
writeFileSync(transportPath, transport);

const testPath = 'src/peer/PeerJsGameTransport.test.ts';
let test = readFileSync(testPath, 'utf8');
test = replaceOnce(
  test,
  `function openConnection(peerIndex = 0, connectionIndex = 0) {\n  const connection = getPeer(peerIndex).connections[connectionIndex];\n  if (!connection) throw new Error(\`Missing connection at index \${String(connectionIndex)}.\`);\n  connection.open = true;\n  connection.emit('open');\n  return connection;\n}\n`,
  `function openConnection(peerIndex = 0, connectionIndex = 0) {\n  const connection = getPeer(peerIndex).connections[connectionIndex];\n  if (!connection) throw new Error(\`Missing connection at index \${String(connectionIndex)}.\`);\n  connection.open = true;\n  connection.emit('open');\n  return connection;\n}\n\nfunction markBridgeReady(peerIndex = 0, connectionIndex = 0) {\n  const connection = getPeer(peerIndex).connections[connectionIndex];\n  if (!connection) throw new Error(\`Missing connection at index \${String(connectionIndex)}.\`);\n  connection.emit('data', { type: 'bridge:ready' });\n  return connection;\n}\n`,
  'test bridge-ready helper',
);

test = test.replaceAll(
  `    openConnection();\n    await connectPromise;`,
  `    openConnection();\n    markBridgeReady();\n    await connectPromise;`,
);
test = test.replace(
  `    openConnection();\n    await Promise.all([first, second]);`,
  `    openConnection();\n    markBridgeReady();\n    await Promise.all([first, second]);`,
);
test = test.replace(
  `    openConnection(1);\n    await second;`,
  `    openConnection(1);\n    markBridgeReady(1);\n    await second;`,
);

test = replaceOnce(
  test,
  `  it('deduplicates parallel connect calls on the same transport', async () => {`,
  `  it('waits for the host bridge readiness signal before exposing open state', async () => {\n    const transport = new PeerJsGameTransport();\n    const transportCallbacks = callbacks();\n    const connectPromise = transport.connect(\n      { roomId: 'ABC123' },\n      transportCallbacks,\n      { connectionAttemptId: 'attempt-ready' },\n    );\n\n    openPeer();\n    const connection = openConnection();\n    await Promise.resolve();\n\n    expect(transportCallbacks.onState).toHaveBeenCalledWith('connecting');\n    expect(transportCallbacks.onState).not.toHaveBeenCalledWith('open');\n\n    connection.emit('data', { type: 'bridge:ready' });\n    await connectPromise;\n\n    expect(transportCallbacks.onState).toHaveBeenCalledWith('open');\n    expect(transportCallbacks.onMessage).not.toHaveBeenCalled();\n    expect(\n      getConnectionDiagnostics().some((entry) => entry.event === 'peerjs.bridge-ready.received'),\n    ).toBe(true);\n  });\n\n  it('deduplicates parallel connect calls on the same transport', async () => {`,
  'bridge readiness transport test',
);
writeFileSync(testPath, test);
