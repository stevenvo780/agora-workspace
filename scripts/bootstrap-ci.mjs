#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { lstat, mkdir, readFile, realpath, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = fileURLToPath(new URL('../', import.meta.url));
const dependencyFields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

function runCommand(command, args, cwd, capture = false) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.signal ?? `exit ${result.status}`})`);
  }
  return result.stdout?.trim();
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read required JSON file ${path}: ${error.message}`);
  }
}

function safePath(path) {
  return typeof path === 'string'
    && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(path)
    && path.split('/').every(part => !['.', '..', '.git'].includes(part));
}

function validateRepositories(repositories) {
  if (!Array.isArray(repositories) || repositories.length === 0) {
    throw new Error('ci-repositories.json must contain a nonempty repositories array');
  }
  const seen = [];
  for (const entry of repositories) {
    if (!entry || !/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(entry.repository)
      || !/^[a-f0-9]{40}$/.test(entry.ref)
      || !safePath(entry.path) || !safePath(entry.packagePath)
      || !(entry.packagePath === entry.path || entry.packagePath.startsWith(`${entry.path}/`))
      || !['ci', 'none'].includes(entry.install)) {
      throw new Error('Each CI repository needs owner/name, a full commit SHA, safe checkout/package paths and ci/none install mode');
    }
    if (seen.some(previous => previous.repository === entry.repository
      || previous.path === entry.path || previous.path.startsWith(`${entry.path}/`)
      || entry.path.startsWith(`${previous.path}/`))) {
      throw new Error(`Duplicate repository or overlapping checkout path: ${entry.repository} -> ${entry.path}`);
    }
    seen.push(entry);
  }
}

async function checkDestination(root, path) {
  let current = root;
  for (const part of path.split('/')) {
    current = resolve(current, part);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (info.isSymbolicLink() || !info.isDirectory() || current === resolve(root, path)) {
      throw new Error(`Refusing existing checkout or unsafe parent at ${current}; use a fresh workspace`);
    }
  }
}

async function validatePackage(root, entry) {
  const directory = resolve(root, entry.packagePath);
  const actual = await realpath(directory);
  const inside = relative(resolve(root, entry.path), actual);
  if (inside === '..' || inside.startsWith(`..${sep}`)) {
    throw new Error(`${entry.packagePath} resolves outside its repository`);
  }
  const pkg = await readJson(resolve(directory, 'package.json'));
  const dependencies = dependencyFields.flatMap(field => Object.entries(pkg[field] ?? {}));
  if (entry.install === 'none') {
    if (dependencies.length || pkg.workspaces) {
      throw new Error(`${entry.packagePath} declares dependencies or workspaces; install mode none is invalid`);
    }
    return;
  }
  await readJson(resolve(directory, 'package-lock.json'));
  for (const [name, spec] of dependencies) {
    if (typeof spec !== 'string' || !spec.startsWith('file:')) continue;
    const target = resolve(directory, spec.slice(5));
    try {
      const info = await stat(target);
      if (info.isDirectory()) await readJson(resolve(target, 'package.json'));
      else if (!info.isFile()) throw new Error('not a file or package directory');
    } catch (error) {
      throw new Error(`${entry.repository}@${entry.ref}: missing local dependency ${name} (${spec}) required by ${entry.packagePath}/package.json: ${error.message}`);
    }
  }
}

export async function bootstrap({ root = workspaceRoot, run = runCommand, log = console.log } = {}) {
  root = await realpath(root);
  const { repositories } = await readJson(resolve(root, 'scripts/ci-repositories.json'));
  validateRepositories(repositories);
  for (const entry of repositories) await checkDestination(root, entry.path);

  for (const entry of repositories) {
    const directory = resolve(root, entry.path);
    log(`[bootstrap-ci] Checkout ${entry.repository}@${entry.ref} -> ${entry.path}`);
    await mkdir(dirname(directory), { recursive: true });
    run('git', ['init', '--quiet', directory], root);
    run('git', ['remote', 'add', 'origin', `https://github.com/${entry.repository}.git`], directory);
    try {
      // These repositories are public. Do not reuse checkout credentials across repos.
      run('git', ['-c', 'credential.helper=', '-c', 'core.askPass=', '-c', 'http.extraHeader=',
        'fetch', '--depth=1', '--no-tags', 'origin', entry.ref], directory);
    } catch (error) {
      throw new Error(`Cannot fetch required repository ${entry.repository}@${entry.ref} into ${entry.path}: ${error.message}. Verify repository visibility and the pinned revision; private repositories require separately authorized Actions read access.`);
    }
    run('git', ['checkout', '--quiet', '--detach', 'FETCH_HEAD'], directory);
    const head = run('git', ['rev-parse', 'HEAD'], directory, true);
    if (head !== entry.ref) {
      throw new Error(`Revision mismatch for ${entry.repository} at ${entry.path}: expected ${entry.ref}, got ${head}`);
    }
  }

  // Validate every install target before running any package lifecycle scripts.
  for (const entry of repositories) await validatePackage(root, entry);
  for (const entry of repositories) {
    if (entry.install === 'none') {
      log(`[bootstrap-ci] ${entry.packagePath}: no dependencies; no install needed`);
      continue;
    }
    log(`[bootstrap-ci] Install locked dependencies in ${entry.packagePath}`);
    run('npm', ['--prefix', entry.packagePath, 'ci', '--include=dev'], root);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  bootstrap().catch(error => {
    console.error(`[bootstrap-ci] ${error.message}`);
    process.exitCode = 1;
  });
}
