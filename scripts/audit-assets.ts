import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenNordicAssetPaths, nordicAssetPaths } from '../src/lib/nordic-asset-inventory.ts';
import { flattenVisualFixAssetPaths, visualFixAssetPaths } from '../src/lib/visual-fix-asset-inventory.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nordicRoot = join(repositoryRoot, 'src', 'assets', 'nordic-v1');
const visualFixRoot = join(repositoryRoot, 'src', 'assets', 'visual-fix-v4');
const runtimeMapping = readFileSync(join(repositoryRoot, 'src', 'lib', 'visual-fix-assets.ts'), 'utf8');
const errors: string[] = [];
const normalize = (path: string) => path.replaceAll('\\', '/');
const walk = (directory: string): string[] => existsSync(directory)
  ? readdirSync(directory).flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    })
  : [];

const nordicExpected = flattenNordicAssetPaths();
const v4Expected = flattenVisualFixAssetPaths();
const nordicCounts = {
  brand: Object.keys(nordicAssetPaths.brand).length,
  rarity: Object.keys(nordicAssetPaths.rarity).length,
  achievements: Object.keys(nordicAssetPaths.achievements).length,
  leagues: Object.keys(nordicAssetPaths.leagues).length,
  decks: Object.keys(nordicAssetPaths.decks).length,
};
const requiredNordicCounts = { brand: 5, rarity: 4, achievements: 12, leagues: 6, decks: 7 };
const v4Counts = {
  rewards: Object.keys(visualFixAssetPaths.rewards).length,
  descriptionCategories: Object.keys(visualFixAssetPaths.descriptionCategories).length,
  backgrounds: Object.keys(visualFixAssetPaths.backgrounds).length,
};
const requiredV4Counts = { rewards: 4, descriptionCategories: 7, backgrounds: 4 };

for (const [category, count] of Object.entries(requiredNordicCounts)) {
  if (nordicCounts[category as keyof typeof nordicCounts] !== count) errors.push(`Nordic ${category}: expected ${count}, mapped ${nordicCounts[category as keyof typeof nordicCounts]}`);
}
for (const [category, count] of Object.entries(requiredV4Counts)) {
  if (v4Counts[category as keyof typeof v4Counts] !== count) errors.push(`V4 ${category}: expected ${count}, mapped ${v4Counts[category as keyof typeof v4Counts]}`);
}
if (nordicExpected.length !== 34) errors.push(`expected 34 retained Nordic SVG mappings, found ${nordicExpected.length}`);
if (v4Expected.length !== 15) errors.push(`expected exactly 15 V4 production mappings, found ${v4Expected.length}`);
if (new Set([...nordicExpected, ...v4Expected]).size !== nordicExpected.length + v4Expected.length) errors.push('asset mapping contains duplicate paths');

const nordicActual = walk(nordicRoot).filter((path) => extname(path).toLowerCase() === '.svg').map((path) => normalize(relative(nordicRoot, path))).sort();
const v4Actual = walk(visualFixRoot).filter((path) => /\.(?:svg|webp)$/i.test(path)).map((path) => normalize(relative(visualFixRoot, path))).sort();
if (nordicActual.length !== 34) errors.push(`expected 34 retained Nordic SVG files, found ${nordicActual.length}`);
if (v4Actual.length !== 15) errors.push(`expected exactly 15 V4 production files, found ${v4Actual.length}`);
for (const path of nordicActual) if (!nordicExpected.includes(path as typeof nordicExpected[number])) errors.push(`unmapped Nordic SVG: ${path}`);
for (const path of nordicExpected) if (!nordicActual.includes(path)) errors.push(`missing Nordic SVG: ${path}`);
for (const path of v4Actual) if (!v4Expected.includes(path)) errors.push(`unmapped V4 production asset: ${path}`);
for (const path of v4Expected) {
  if (!v4Actual.includes(path)) errors.push(`missing V4 production asset: ${path}`);
  if (!runtimeMapping.includes(`../assets/visual-fix-v4/${path}?url`)) errors.push(`V4 runtime mapping lacks static import: ${path}`);
}

const allowedWebp = new Set<string>(Object.values(visualFixAssetPaths.backgrounds));
for (const path of v4Actual.filter((path) => path.endsWith('.webp'))) {
  if (!allowedWebp.has(path)) errors.push(`unapproved V4 raster: ${path}`);
  const bytes = readFileSync(join(visualFixRoot, path));
  if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') errors.push(`${path}: invalid WebP signature`);
}

for (const [root, paths] of [[nordicRoot, nordicActual], [visualFixRoot, v4Actual.filter((path) => path.endsWith('.svg'))]] as const) {
  for (const path of paths) {
    const absolute = join(root, path);
    if (statSync(absolute).size === 0) errors.push(`empty asset: ${path}`);
    const svg = readFileSync(absolute, 'utf8');
    if (/<script\b/i.test(svg)) errors.push(`${path}: contains <script>`);
    if (/<foreignObject\b/i.test(svg)) errors.push(`${path}: contains <foreignObject>`);
    if (/<image\b/i.test(svg)) errors.push(`${path}: embeds a raster <image>`);
    const references = [...svg.matchAll(/(?:href|xlink:href)\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]!);
    if (references.some((reference) => /^(?:https?:|data:)/i.test(reference))) errors.push(`${path}: contains an external or embedded reference`);
    if (/url\(\s*["']?https?:/i.test(svg)) errors.push(`${path}: contains an external CSS URL`);
  }
}

for (const path of walk(join(repositoryRoot, 'src', 'assets'))) {
  const relativePath = normalize(relative(join(repositoryRoot, 'src', 'assets'), path));
  if (/\.zip$/i.test(path)) errors.push(`source zip bundled: ${relativePath}`);
  if (/preview/i.test(relativePath)) errors.push(`preview asset bundled: ${relativePath}`);
  if (/\.(?:png|jpe?g|gif|avif)$/i.test(path)) errors.push(`unapproved raster asset: ${relativePath}`);
}

const runtimeFiles = walk(join(repositoryRoot, 'src')).filter((path) => /\.(?:astro|ts|css)$/i.test(path));
for (const path of runtimeFiles) {
  const source = readFileSync(path, 'utf8');
  if (/box-seal-(?:common|golden|legendary)|box-cross-(?:fi|sv)/i.test(source)) errors.push(`${normalize(relative(repositoryRoot, path))}: obsolete reward composition reference`);
}

if (errors.length) {
  console.error(`Asset audit failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(1);
}
console.log('Asset audit clean: 34 retained Nordic SVGs and exactly 15 V4 assets (rewards 4, category icons 7, backgrounds 4; four local WebPs allowed).');
