import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenNordicAssetPaths, nordicAssetPaths } from '../src/lib/nordic-asset-inventory.ts';
import { flattenVisualFixAssetPaths, visualFixAssetPaths } from '../src/lib/visual-fix-asset-inventory.ts';
import { flattenStandardBoxV5AssetPaths } from '../src/lib/standard-box-v5-asset-inventory.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nordicRoot = join(repositoryRoot, 'src', 'assets', 'nordic-v1');
const visualFixRoot = join(repositoryRoot, 'src', 'assets', 'visual-fix-v4');
const standardBoxV5Root = join(repositoryRoot, 'src', 'assets', 'standard-box-v5');
const visualFixMapping = readFileSync(join(repositoryRoot, 'src', 'lib', 'visual-fix-assets.ts'), 'utf8');
const rewardBoxMapping = readFileSync(join(repositoryRoot, 'src', 'lib', 'reward-box-assets.ts'), 'utf8');
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
const standardBoxV5Expected = flattenStandardBoxV5AssetPaths();
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
const requiredV4Counts = { rewards: 2, descriptionCategories: 7, backgrounds: 4 };

for (const [category, count] of Object.entries(requiredNordicCounts)) {
  if (nordicCounts[category as keyof typeof nordicCounts] !== count) errors.push(`Nordic ${category}: expected ${count}, mapped ${nordicCounts[category as keyof typeof nordicCounts]}`);
}
for (const [category, count] of Object.entries(requiredV4Counts)) {
  if (v4Counts[category as keyof typeof v4Counts] !== count) errors.push(`V4 ${category}: expected ${count}, mapped ${v4Counts[category as keyof typeof v4Counts]}`);
}
if (nordicExpected.length !== 34) errors.push(`expected 34 retained Nordic SVG mappings, found ${nordicExpected.length}`);
if (v4Expected.length !== 13) errors.push(`expected exactly 13 retained V4 production mappings, found ${v4Expected.length}`);
if (standardBoxV5Expected.length !== 3) errors.push(`expected exactly three Standard Box V5 mappings, found ${standardBoxV5Expected.length}`);
if (new Set(standardBoxV5Expected).size !== standardBoxV5Expected.length) errors.push('Standard Box V5 mapping contains duplicate paths');

const nordicActual = walk(nordicRoot).filter((path) => extname(path).toLowerCase() === '.svg').map((path) => normalize(relative(nordicRoot, path))).sort((left, right) => left.localeCompare(right));
const v4Actual = walk(visualFixRoot).filter((path) => /\.(?:svg|webp)$/i.test(path)).map((path) => normalize(relative(visualFixRoot, path))).sort((left, right) => left.localeCompare(right));
const standardBoxV5Actual = walk(standardBoxV5Root).filter((path) => path.toLowerCase().endsWith('.png')).map((path) => normalize(relative(standardBoxV5Root, path))).sort((left, right) => left.localeCompare(right));
if (nordicActual.length !== 34) errors.push(`expected 34 retained Nordic SVG files, found ${nordicActual.length}`);
if (v4Actual.length !== 13) errors.push(`expected exactly 13 retained V4 production files, found ${v4Actual.length}`);
if (standardBoxV5Actual.length !== 3) errors.push(`expected exactly three Standard Box V5 PNGs, found ${standardBoxV5Actual.length}`);
for (const path of nordicActual) if (!nordicExpected.includes(path as typeof nordicExpected[number])) errors.push(`unmapped Nordic SVG: ${path}`);
for (const path of nordicExpected) if (!nordicActual.includes(path)) errors.push(`missing Nordic SVG: ${path}`);
for (const path of v4Actual) if (!v4Expected.includes(path)) errors.push(`unmapped V4 production asset: ${path}`);
for (const path of v4Expected) {
  if (!v4Actual.includes(path)) errors.push(`missing V4 production asset: ${path}`);
  if (!visualFixMapping.includes(`../assets/visual-fix-v4/${path}?url`) && !rewardBoxMapping.includes(`../assets/visual-fix-v4/${path}?url`)) errors.push(`V4 runtime mapping lacks static import: ${path}`);
}
for (const path of standardBoxV5Actual) if (!standardBoxV5Expected.includes(path as typeof standardBoxV5Expected[number])) errors.push(`unmapped Standard Box V5 PNG: ${path}`);
for (const path of standardBoxV5Expected) {
  if (!standardBoxV5Actual.includes(path)) errors.push(`missing Standard Box V5 PNG: ${path}`);
  if (!rewardBoxMapping.includes(`../assets/standard-box-v5/${path}?url`)) errors.push(`Standard Box V5 runtime mapping lacks static import: ${path}`);
}

for (const path of standardBoxV5Actual) {
  const bytes = readFileSync(join(standardBoxV5Root, path));
  if (bytes.length === 0) errors.push(`empty Standard Box V5 asset: ${path}`);
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) errors.push(`${path}: invalid PNG signature`);
  if (bytes.length < 26 || ![4, 6].includes(bytes[25]!)) errors.push(`${path}: PNG lacks an alpha channel`);
}
if (existsSync(join(visualFixRoot, 'rewards', 'box-hud.svg'))) errors.push('obsolete visual-fix-v4/rewards/box-hud.svg retained');
if (existsSync(join(visualFixRoot, 'rewards', 'box-standard.svg'))) errors.push('obsolete visual-fix-v4/rewards/box-standard.svg retained');
if (/box-(?:hud|standard)\.svg/.test(`${visualFixMapping}\n${rewardBoxMapping}`)) errors.push('obsolete V4 standard/HUD SVG remains in runtime mappings');
if (!/standard:\s*\{\s*small:\s*standardBoxV5Assets\.hud,\s*normal:\s*standardBoxV5Assets\.card,\s*large:\s*standardBoxV5Assets\.hero/s.test(rewardBoxMapping)) errors.push('standard reward size mapping is incomplete');
for (const kind of ['golden', 'legendary']) if (new RegExp(`${kind}:\\s*\\{[^}]*standardBoxV5`, 's').test(rewardBoxMapping)) errors.push(`${kind} rewards map to a Standard Box V5 PNG`);

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
  if (/(?:preview|reference-sheet)/i.test(relativePath)) errors.push(`inspection-only asset bundled: ${relativePath}`);
  if (/\.png$/i.test(path) && !standardBoxV5Expected.some((name) => relativePath === `standard-box-v5/${name}`)) errors.push(`unapproved PNG asset: ${relativePath}`);
  if (/\.(?:jpe?g|gif|avif)$/i.test(path)) errors.push(`unapproved raster asset: ${relativePath}`);
}

const runtimeFiles = walk(join(repositoryRoot, 'src')).filter((path) => /\.(?:astro|ts|css)$/i.test(path));
for (const path of runtimeFiles) {
  const source = readFileSync(path, 'utf8');
  if (/box-seal-(?:common|golden|legendary)|box-cross-(?:fi|sv)/i.test(source)) errors.push(`${normalize(relative(repositoryRoot, path))}: obsolete reward composition reference`);
  if (/visual-fix-v4\/rewards\/box-(?:hud|standard)\.svg|reference-sheet\.png/i.test(source)) errors.push(`${normalize(relative(repositoryRoot, path))}: obsolete or inspection-only reward asset reference`);
  if (/(?:src\s*=|url\()[^\n)]*https?:\/\//i.test(source)) errors.push(`${normalize(relative(repositoryRoot, path))}: external image URL`);
}

if (errors.length) {
  console.error(`Asset audit failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(1);
}
console.log('Asset audit clean: 34 Nordic SVGs, 13 retained V4 assets, and exactly three alpha-channel Standard Box V5 PNGs; four local WebPs allowed.');
