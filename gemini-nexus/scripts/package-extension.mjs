import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const artifactsDir = path.join(rootDir, 'artifacts');
const packageDir = path.join(artifactsDir, 'chrome-extension');

const requiredPaths = [
  'manifest.json',
  'logo.png',
  'background',
  'content',
  'lib',
  'services',
  'dist/assets',
  'dist/sidepanel/index.html',
  'dist/sandbox/index.html',
];

async function ensureExists(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  try {
    await stat(absolutePath);
  } catch {
    throw new Error(`Missing required build input: ${relativePath}`);
  }
}

async function copyIntoPackage(sourceRelativePath, targetRelativePath = sourceRelativePath) {
  const source = path.join(rootDir, sourceRelativePath);
  const target = path.join(packageDir, targetRelativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { recursive: true });
}

async function removeJunkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await removeJunkFiles(fullPath);
      return;
    }

    if (entry.name === '.DS_Store') {
      await rm(fullPath, { force: true });
    }
  }));
}

async function main() {
  for (const relativePath of requiredPaths) {
    await ensureExists(relativePath);
  }

  await rm(packageDir, { recursive: true, force: true });
  await mkdir(packageDir, { recursive: true });

  await Promise.all([
    copyIntoPackage('manifest.json'),
    copyIntoPackage('logo.png'),
    copyIntoPackage('background'),
    copyIntoPackage('content'),
    copyIntoPackage('lib'),
    copyIntoPackage('services'),
    copyIntoPackage('dist/assets', 'assets'),
    copyIntoPackage('dist/sidepanel/index.html', 'sidepanel/index.html'),
    copyIntoPackage('dist/sandbox/index.html', 'sandbox/index.html'),
  ]);

  await removeJunkFiles(packageDir);

  const packageJson = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'));
  await writeFile(
    path.join(packageDir, 'build-info.json'),
    JSON.stringify(
      {
        name: packageJson.name,
        version: packageJson.version,
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  console.log(`Extension package prepared at ${path.relative(rootDir, packageDir)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
