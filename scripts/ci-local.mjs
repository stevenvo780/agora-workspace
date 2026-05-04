#!/usr/bin/env node
import { spawn } from 'node:child_process';

const tasks = [
  ['Contracts build', 'npm', ['--prefix', 'packages/agora-contracts', 'run', 'build']],
  ['Contracts typecheck', 'npm', ['--prefix', 'packages/agora-contracts', 'run', 'typecheck']],
  ['AgoraFront typecheck', 'npm', ['--prefix', 'AgoraFront', 'run', 'typecheck']],
  ['AgoraFront unit', 'npm', ['--prefix', 'AgoraFront', 'run', 'test:unit', '--', '--reporter=default']],
  ['AgoraBack typecheck', 'npm', ['--prefix', 'AgoraBack', 'run', 'typecheck']],
  ['AgoraBack test', 'npm', ['--prefix', 'AgoraBack', 'test']],
  ['AgoraHub typecheck', 'npm', ['--prefix', 'AgoraHub', 'run', 'typecheck']],
  ['AgoraHub test', 'npm', ['--prefix', 'AgoraHub', 'test']],
  ['AgoraWorker check', 'npm', ['--prefix', 'AgoraWorker/worker', 'run', 'check']],
  ['AgoraWorker test', 'npm', ['--prefix', 'AgoraWorker/worker', 'test']],
  ['AgoraCli check', 'npm', ['--prefix', 'AgoraCli', 'run', 'check']],
  ['AgoraCli test', 'npm', ['--prefix', 'AgoraCli', 'test']],
  ['ST typecheck', 'npm', ['--prefix', 'ST', 'run', 'typecheck']],
  ['ST test', 'npm', ['--prefix', 'ST', 'test', '--', '--reporter=default']],
  ['Autologic typecheck', 'npm', ['--prefix', 'Autologic', 'run', 'typecheck']],
  ['Autologic test', 'npm', ['--prefix', 'Autologic', 'test', '--', '--reporter=default']]
];

const run = (label, cmd, args) => new Promise((resolve, reject) => {
  console.log(`\n== ${label}`);
  const child = spawn(cmd, args, { stdio: 'inherit' });
  child.on('exit', code => code === 0 ? resolve(undefined) : reject(new Error(`${label} failed with ${code}`)));
  child.on('error', reject);
});

for (const [label, cmd, args] of tasks) {
  await run(label, cmd, args);
}
