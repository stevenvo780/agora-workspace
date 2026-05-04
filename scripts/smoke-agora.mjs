#!/usr/bin/env node
const targets = [
  ['backend', process.env.AGORA_BACKEND_URL, '/health'],
  ['hub', process.env.AGORA_HUB_URL, '/health'],
  ['front', process.env.AGORA_FRONT_URL, '/']
].filter(([, base]) => base);

if (targets.length === 0) {
  console.error('Define AGORA_BACKEND_URL, AGORA_HUB_URL o AGORA_FRONT_URL para smoke tests.');
  process.exit(2);
}

let failed = false;
for (const [name, base, path] of targets) {
  const url = `${String(base).replace(/\/+$/, '')}${path}`;
  try {
    const res = await fetch(url, { headers: { 'X-Request-Id': `smoke_${Date.now()}` } });
    console.log(`${name}\t${res.status}\t${url}`);
    if (!res.ok) failed = true;
  } catch (error) {
    failed = true;
    console.error(`${name}\tERROR\t${url}\t${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) process.exit(1);
