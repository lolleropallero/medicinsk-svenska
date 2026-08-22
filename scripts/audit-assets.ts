import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenNordicAssetPaths, nordicAssetPaths } from '../src/lib/nordic-asset-inventory.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetRoot = join(repositoryRoot, 'src', 'assets', 'nordic-v1');
const mappingSource = readFileSync(join(repositoryRoot, 'src', 'lib', 'nordic-assets.ts'), 'utf8');
const expected = flattenNordicAssetPaths();
const errors: string[] = [];
const walk = (directory: string): string[] => readdirSync(directory).flatMap((name) => {
  const path = join(directory, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const normalize = (path: string) => path.replaceAll('\\', '/');

const counts = {
  brand: Object.keys(nordicAssetPaths.brand).length,
  backgrounds: Object.keys(nordicAssetPaths.backgrounds).length,
  rewards: Object.keys(nordicAssetPaths.rewardBoxes).length + Object.keys(nordicAssetPaths.rewardPrimitives).length,
  rarity: Object.keys(nordicAssetPaths.rarity).length,
  achievements: Object.keys(nordicAssetPaths.achievements).length,
  leagues: Object.keys(nordicAssetPaths.leagues).length,
  decks: Object.keys(nordicAssetPaths.decks).length,
};
const requiredCounts = { brand: 5, backgrounds: 3, rewards: 8, rarity: 4, achievements: 12, leagues: 6, decks: 7 };
for (const [category, count] of Object.entries(requiredCounts)) if (counts[category as keyof typeof counts] !== count) errors.push(`${category}: expected ${count}, mapped ${counts[category as keyof typeof counts]}`);
if (expected.length !== 45) errors.push(`expected 45 mapped assets, found ${expected.length}`);
if (new Set(expected).size !== expected.length) errors.push('asset mapping contains duplicate paths');

const actual = existsSync(assetRoot) ? walk(assetRoot).filter((path) => extname(path).toLowerCase() === '.svg').map((path) => normalize(relative(assetRoot, path))).sort((left, right) => left.localeCompare(right)) : [];
if (actual.length !== 45) errors.push(`expected 45 production SVG files, found ${actual.length}`);
for (const path of actual) if (!expected.includes(path as typeof expected[number])) errors.push(`unmapped production SVG: ${path}`);
for (const path of expected) {
  const absolute = join(assetRoot, path);
  if (!existsSync(absolute)) { errors.push(`missing expected asset: ${path}`); continue; }
  if (statSync(absolute).size === 0) errors.push(`empty asset: ${path}`);
  if (/preview|\.png$|\.jpe?g$/i.test(path)) errors.push(`mapping points to preview or raster file: ${path}`);
  const svg = readFileSync(absolute, 'utf8');
  if (/<script\b/i.test(svg)) errors.push(`${path}: contains <script>`);
  if (/<foreignObject\b/i.test(svg)) errors.push(`${path}: contains <foreignObject>`);
  if (/<image\b/i.test(svg)) errors.push(`${path}: embeds a raster <image>`);
  const references = [...svg.matchAll(/(?:href|xlink:href)\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]!);
  if (references.some((reference) => /^https?:/i.test(reference))) errors.push(`${path}: contains an external HTTP reference`);
  if (/url\(\s*["']?https?:/i.test(svg)) errors.push(`${path}: contains an external CSS URL`);
}
for (const category of Object.keys(nordicAssetPaths)) if (!mappingSource.includes(`mapCategory(nordicAssetPaths.${category})`)) errors.push(`typed URL mapping omits category: ${category}`);

if (existsSync(join(repositoryRoot, 'dist'))) {
  const raster = walk(join(repositoryRoot, 'dist')).filter((path) => /\.(?:png|jpe?g|gif|webp|avif)$/i.test(path));
  if (raster.length) errors.push(`raster files present in dist: ${raster.map((path) => normalize(relative(repositoryRoot, path))).join(', ')}`);
}

if (errors.length) {
  console.error(`Nordic asset audit failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(1);
}
console.log(`Nordic asset audit clean: ${expected.length} mapped SVGs (${Object.entries(counts).map(([key, value]) => `${key} ${value}`).join(', ')}).`);
