#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const { upload } = require('@super-protocol/sp-files-addon');

function printHelp() {
  const text = `
Storj Uploader CLI

Usage:
  sp-storj-uploader \
    --vault-url <url> \
    --service-name <name> \
    --branch-name <branch> \
    --vault-token <token> \
    --archive-path <path>

Required arguments:
  --vault-url         Vault base URL 
  --service-name      Logical service name
  --branch-name       Branch name
  --vault-token       Vault token with read access to resources secret
  --archive-path      Path to .tar.gz archive to upload

Optional arguments:
  --help              Show this help

Examples:
  sp-storj-uploader \
    --vault-url https://vault.example.com \
    --service-name svc \
    --branch-name main \
    --vault-token $VAULT_TOKEN \
    --archive-path /tmp/svc.tar.gz
  
Notes:
  Vault path is fixed to infra/data/swarm-services.
`;
  process.stdout.write(text);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function resolveBaseUrl(u) {
  if (!u) return '';
  return u.endsWith('/') ? u.slice(0, -1) : u;
}

async function fetchVaultResources({ vaultUrl, vaultToken, vaultPath }) {
  const base = resolveBaseUrl(vaultUrl);
  const url = `${base}/v1/${vaultPath}`;
  const headers = {
    'X-Vault-Token': (vaultToken || '').trim(),
    Accept: 'application/json',
  };

  let response;
  try {
    response = await axios.get(url, { headers, timeout: 30000 });
  } catch (err) {
    console.error('[ERROR] Vault request failed:', err?.message ?? err);
    const status = err?.response?.status;
    const statusText = err?.response?.statusText;
    const dataText =
      typeof err?.response?.data === 'string'
        ? err.response.data
        : JSON.stringify(err?.response?.data ?? '');
    throw new Error(`Vault request failed: ${status ?? ''} ${statusText ?? ''} ${dataText}`.trim());
  }

  const resources = response?.data?.data?.data?.resources;
  if (!Array.isArray(resources)) {
    throw new Error('Unexpected Vault response: resources not found');
  }
  return resources;
}

function pickResourceByName(resources, serviceName /*, branchName */) {
  const found = resources.find((r) => r?.name === serviceName);
  if (found) return { match: found, matchedName: serviceName };
  return { match: undefined, matchedName: undefined };
}

async function ensureFileExists(p) {
  try {
    const st = await fs.stat(p);
    if (!st.isFile()) throw new Error('not a file');
  } catch {
    throw new Error(`Archive not found: ${p}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const vaultUrl = args['vault-url'];
  const serviceName = args['service-name'];
  const branchName = args['branch-name'];
  const vaultToken = args['vault-token'];
  const archivePath = args['archive-path'];
  const vaultPath = 'infra/data/swarm-services';

  if (!vaultUrl || !serviceName || !branchName || !vaultToken || !archivePath) {
    process.stderr.write(
      '[ERROR] Missing required arguments. Expected --vault-url --service-name --branch-name --vault-token --archive-path\n',
    );
    process.exitCode = 1;
    return;
  }

  await ensureFileExists(archivePath);

  try {
    console.info(`[INFO] Fetching resources from Vault url=${vaultUrl} path=${vaultPath}`);
    const resources = await fetchVaultResources({ vaultUrl, vaultToken, vaultPath });

    const { match: resource, matchedName } = pickResourceByName(resources, serviceName);
    if (!resource) {
      throw new Error(`Service not found in Vault resources: ${serviceName}`);
    }
    console.info(`[INFO] Matched resource name: ${matchedName}`);

    const encryption = resource.encryption;
    const storage = resource.storage;
    if (!storage?.storageType || !storage?.writeCredentials) {
      throw new Error('Vault resource missing storageType or writeCredentials');
    }

    const remoteFilepath = branchName;
    const targetResource = {
      type: 'STORAGE_PROVIDER',
      filepath: remoteFilepath,
      storageType: storage.storageType,
      credentials: storage.writeCredentials,
    };

    console.info(
      `[INFO] Uploading archive to ${remoteFilepath} using storageType=${storage.storageType}`,
    );
    const options = {
      encryption,
      retry: { maxRetries: 5, initialDelayMs: 1000 },
      progressCallback: ({ key, current, total }) => {
        const t = typeof total === 'number' ? total : 0;
        const c = typeof current === 'number' ? current : 0;
        const pct = t > 0 ? Math.floor((c / t) * 100) : 0;
        console.log(`${key ?? remoteFilepath} ${c}/${t} (${pct}%)\n`);
      },
    };

    const src = path.resolve(archivePath);
    const result = await upload(src, targetResource, options);

    process.stdout.write(
      JSON.stringify({
        ok: true,
        hash: result?.hash ?? 'unknown',
        size: result?.size ?? 0,
        remoteFilepath,
      }) + '\n',
    );
  } catch (e) {
    process.stderr.write(`[ERROR] ${e?.message ?? e}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
