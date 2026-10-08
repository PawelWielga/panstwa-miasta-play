import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Production always comes from main. The current dev checkout supplies /dev/.
// This can run locally while GitHub Actions remain disabled.
const root = resolve(import.meta.dirname, '..');
const output = join(root, 'dist-pages');
const base = `/${(process.env.VITE_BASE_PATH || 'panstwa-miasta-play').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');

function run(command, args, cwd = root, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}).`);
}

function gitOutput(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'Git command failed.');
  return result.stdout.trim();
}

// npm supplies its CLI path, avoiding shell-specific invocation on Windows.
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this script with npm run build:pages.');
if (gitOutput(['branch', '--show-current']) !== 'dev') {
  throw new Error('Run build:pages from the dev branch.');
}

const temporary = mkdtempSync(join(tmpdir(), 'panstwa-miasta-pages-'));
const production = join(temporary, 'main');
try {
  const mainSha = gitOutput(['rev-parse', 'origin/main']);
  const devSha = gitOutput(['rev-parse', 'HEAD']);
  const devDirty = gitOutput(['status', '--porcelain', '--untracked-files=normal']) !== '';
  const archive = join(temporary, 'main.tar');
  mkdirSync(production);
  run('git', ['archive', '--format=tar', `--output=${archive}`, mainSha]);
  if (process.platform === 'win32') {
    // main still contains FortuneWheel.tsx + fortuneWheel.ts. Build it on a
    // case-sensitive Linux filesystem without modifying production sources.
    run('docker', [
      'run', '--rm', '--mount', `type=bind,source=${temporary},target=/input`,
      '--env', `VITE_BASE_PATH=${base}`, 'node:22-bookworm-slim',
      'sh', '-c', 'mkdir /source && tar -xf /input/main.tar -C /source && cd /source && npm ci && npm run build && cp -r dist /input/main/dist',
    ]);
  } else {
    run('tar', ['-xf', archive, '-C', production]);
    run(process.execPath, [npmCli, 'ci'], production);
    run(process.execPath, [npmCli, 'run', 'build'], production, { ...process.env, VITE_BASE_PATH: base });
  }
  const flutterDev = join(root, 'flutter-dev');
  let flutterDevSource = null;
  if (existsSync(flutterDev)) {
    flutterDevSource = JSON.parse(readFileSync(join(flutterDev, 'source.json'), 'utf8'));
    if (flutterDevSource.repository !== 'PawelWielga/panstwa-miasta'
      || !/^[a-f0-9]{40}$/.test(flutterDevSource.sha)
      || flutterDevSource.environment !== 'dev') {
      throw new Error('Invalid Flutter DEV source metadata.');
    }
    const html = readFileSync(join(flutterDev, 'index.html'), 'utf8');
    if (!html.includes(`href="${base}dev/"`)
      || !existsSync(join(flutterDev, 'flutter_bootstrap.js'))
      || !existsSync(join(flutterDev, 'main.dart.js'))) {
      throw new Error('Flutter DEV build is missing files or has the wrong base href.');
    }
  } else {
    run(process.execPath, [npmCli, 'ci']);
    run(process.execPath, [npmCli, 'run', 'build'], root, { ...process.env, VITE_BASE_PATH: `${base}dev/` });
  }

  rmSync(output, { recursive: true, force: true });
  cpSync(join(production, 'dist'), output, { recursive: true });
  cpSync(flutterDevSource ? flutterDev : join(root, 'dist'), join(output, 'dev'), { recursive: true });
  writeFileSync(join(output, '.nojekyll'), '');
  writeFileSync(join(output, 'deployment.json'), `${JSON.stringify({ main: mainSha, dev: devSha, devDirty, flutterDevSource }, null, 2)}\n`);
  console.log(`Pages bundle ready: ${output}\nProduction: ${base}\nPreview: ${base}dev/`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
