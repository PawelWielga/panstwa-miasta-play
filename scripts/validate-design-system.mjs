import { readFile } from 'node:fs/promises';

const metadata = JSON.parse(await readFile('design-system.json', 'utf8'));
const tokens = await readFile(metadata.localCopy, 'utf8');
const styles = await readFile('src/styles.css', 'utf8');

const requiredTokens = [
  '--pm-color-primary',
  '--pm-color-accent',
  '--pm-color-background',
  '--pm-color-surface',
  '--pm-color-text-primary',
  '--pm-color-success',
  '--pm-color-error',
  '--pm-radius-standard',
  '--pm-border-standard',
  '--pm-border-focus',
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

for (const [name, asset] of Object.entries(metadata.assets ?? {})) {
  if (!asset.source || !asset.localCopy) {
    throw new Error(`Shared asset ${name} must define source and localCopy.`);
  }

  const content = await readFile(asset.localCopy, 'utf8');
  if (!content.includes('<svg')) {
    throw new Error(`Shared asset ${name} is not a valid SVG copy.`);
  }
}

console.log(
  `Validated design system ${metadata.version} at ${metadata.commit.slice(0, 8)}.`,
);
