import { readFile } from 'node:fs/promises';

const metadata = JSON.parse(await readFile('design-system.json', 'utf8'));
const tokens = await readFile(metadata.localCopy, 'utf8');
const styles = await readFile('src/styles.css', 'utf8');

const requiredTokens = [
  '--pm-color-primary',
  '--pm-color-background',
  '--pm-color-text-primary',
  '--pm-color-success',
  '--pm-color-error',
  '--pm-radius-standard',
  '--pm-touch-target-min',
];

for (const token of requiredTokens) {
  if (!tokens.includes(token)) {
    throw new Error(`Missing shared design token: ${token}`);
  }
}

if (!styles.startsWith("@import './design-tokens.css';")) {
  throw new Error('src/styles.css must import the pinned design token snapshot first.');
}

if (!metadata.commit || metadata.commit.length !== 40) {
  throw new Error('design-system.json must pin a full 40-character commit SHA.');
}

console.log(
  `Validated design system ${metadata.version} at ${metadata.commit.slice(0, 8)}.`,
);
