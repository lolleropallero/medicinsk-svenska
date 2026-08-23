import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenNordicAssetPaths, nordicAssetPaths } from '../src/lib/nordic-asset-inventory.ts';
import { flattenVisualFixAssetPaths, visualFixAssetPaths } from '../src/lib/visual-fix-asset-inventory.ts';
import { flattenRewardVisualAssetPaths } from '../src/lib/reward-visual-asset-inventory.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nordicRoot = join(repositoryRoot, 'src', 'assets', 'nordic-v1');
const visualFixRoot = join(repositoryRoot, 'src', 'assets', 'visual-fix-v4');
const rewardVisualRoot = join(repositoryRoot, 'src', 'assets', 'rewards-kruunu-kilpi');
const audioRoot = join(repositoryRoot, 'src', 'assets', 'audio');
const soundCatalog = readFileSync(join(repositoryRoot, 'src', 'lib', 'sound', 'catalog.ts'), 'utf8');
const musicCatalog = readFileSync(join(repositoryRoot, 'src', 'lib', 'music', 'catalog.ts'), 'utf8');
const visualFixMapping = readFileSync(join(repositoryRoot, 'src', 'lib', 'visual-fix-assets.ts'), 'utf8');
const rewardBoxMapping = readFileSync(join(repositoryRoot, 'src', 'lib', 'reward-box-assets.ts'), 'utf8');
const errors: string[] = [];
const audioFiles=['ui-tap.ogg','reveal.ogg','correct.ogg','incorrect.ogg','overlay-open.ogg','overlay-close.ogg','milestone.ogg','reward-reveal.ogg'];
const semanticSounds=['ui-tap','reveal','correct','incorrect','overlay-open','overlay-close','quest-complete','achievement','level-up','reward-reveal'];
const normalize = (path: string) => path.replaceAll('\\', '/');
const walk = (directory: string): string[] => existsSync(directory)
  ? readdirSync(directory).flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    })
  : [];

const nordicExpected = flattenNordicAssetPaths();
const v4Expected = flattenVisualFixAssetPaths();
const rewardVisualExpected = flattenRewardVisualAssetPaths();
const nordicCounts = {
  brand: Object.keys(nordicAssetPaths.brand).length,
  rarity: Object.keys(nordicAssetPaths.rarity).length,
  achievements: Object.keys(nordicAssetPaths.achievements).length,
  leagues: Object.keys(nordicAssetPaths.leagues).length,
  decks: Object.keys(nordicAssetPaths.decks).length,
};
const requiredNordicCounts = { brand: 5, rarity: 4, achievements: 12, leagues: 6, decks: 7 };
const v4Counts = {
  descriptionCategories: Object.keys(visualFixAssetPaths.descriptionCategories).length,
  backgrounds: Object.keys(visualFixAssetPaths.backgrounds).length,
};
const requiredV4Counts = { descriptionCategories: 7, backgrounds: 4 };

for (const [category, count] of Object.entries(requiredNordicCounts)) {
  if (nordicCounts[category as keyof typeof nordicCounts] !== count) errors.push(`Nordic ${category}: expected ${count}, mapped ${nordicCounts[category as keyof typeof nordicCounts]}`);
}
for (const [category, count] of Object.entries(requiredV4Counts)) {
  if (v4Counts[category as keyof typeof v4Counts] !== count) errors.push(`V4 ${category}: expected ${count}, mapped ${v4Counts[category as keyof typeof v4Counts]}`);
}
if (nordicExpected.length !== 34) errors.push(`expected 34 retained Nordic SVG mappings, found ${nordicExpected.length}`);
if (v4Expected.length !== 11) errors.push(`expected exactly 11 retained V4 production mappings, found ${v4Expected.length}`);
if (rewardVisualExpected.length !== 4) errors.push(`expected exactly four Kruunu & Kilpi reward mappings, found ${rewardVisualExpected.length}`);
if (new Set(rewardVisualExpected).size !== rewardVisualExpected.length) errors.push('Kruunu & Kilpi mapping contains duplicate paths');

const nordicActual = walk(nordicRoot).filter((path) => extname(path).toLowerCase() === '.svg').map((path) => normalize(relative(nordicRoot, path))).sort((left, right) => left.localeCompare(right));
const v4Actual = walk(visualFixRoot).filter((path) => /\.(?:svg|webp)$/i.test(path)).map((path) => normalize(relative(visualFixRoot, path))).sort((left, right) => left.localeCompare(right));
const rewardVisualActual = walk(rewardVisualRoot).filter((path) => path.toLowerCase().endsWith('.svg')).map((path) => normalize(relative(rewardVisualRoot, path))).sort((left, right) => left.localeCompare(right));
if (nordicActual.length !== 34) errors.push(`expected 34 retained Nordic SVG files, found ${nordicActual.length}`);
if (v4Actual.length !== 11) errors.push(`expected exactly 11 retained V4 production files, found ${v4Actual.length}`);
if (rewardVisualActual.length !== 4) errors.push(`expected exactly four Kruunu & Kilpi SVGs, found ${rewardVisualActual.length}`);
for (const path of nordicActual) if (!nordicExpected.includes(path as typeof nordicExpected[number])) errors.push(`unmapped Nordic SVG: ${path}`);
for (const path of nordicExpected) if (!nordicActual.includes(path)) errors.push(`missing Nordic SVG: ${path}`);
for (const path of v4Actual) if (!v4Expected.includes(path)) errors.push(`unmapped V4 production asset: ${path}`);
for (const path of v4Expected) {
  if (!v4Actual.includes(path)) errors.push(`missing V4 production asset: ${path}`);
  if (!visualFixMapping.includes(`../assets/visual-fix-v4/${path}?url`) && !rewardBoxMapping.includes(`../assets/visual-fix-v4/${path}?url`)) errors.push(`V4 runtime mapping lacks static import: ${path}`);
}
for (const path of rewardVisualActual) if (!rewardVisualExpected.includes(path as typeof rewardVisualExpected[number])) errors.push(`unmapped Kruunu & Kilpi SVG: ${path}`);
for (const path of rewardVisualExpected) {
  if (!rewardVisualActual.includes(path)) errors.push(`missing Kruunu & Kilpi SVG: ${path}`);
  if (!rewardBoxMapping.includes(`../assets/rewards-kruunu-kilpi/${path}?url`)) errors.push(`Kruunu & Kilpi runtime mapping lacks static import: ${path}`);
}
if (existsSync(join(visualFixRoot, 'rewards', 'box-hud.svg'))) errors.push('obsolete visual-fix-v4/rewards/box-hud.svg retained');
if (existsSync(join(visualFixRoot, 'rewards', 'box-standard.svg'))) errors.push('obsolete visual-fix-v4/rewards/box-standard.svg retained');
if (/box-(?:hud|standard)\.svg/.test(`${visualFixMapping}\n${rewardBoxMapping}`)) errors.push('obsolete V4 standard/HUD SVG remains in runtime mappings');
if (!/standard:\s*\{\s*small:\s*rewardHudUrl,\s*normal:\s*rewardStandardUrl,\s*large:\s*rewardStandardUrl/s.test(rewardBoxMapping)) errors.push('standard reward size mapping is incomplete');

const actualAudio=walk(audioRoot).filter(path=>/\.(?:ogg|wav|mp3)$/i.test(path)).map(path=>normalize(relative(audioRoot,path))).sort((left,right)=>left.localeCompare(right));
const actualSfx=actualAudio.filter(file=>!file.includes('/'));
const actualMusic=actualAudio.filter(file=>file.startsWith('music/'));
if(actualSfx.length!==8)errors.push(`expected exactly 8 application SFX files, found ${actualSfx.length}`);
for(const file of audioFiles){
  if(!actualSfx.includes(file))errors.push(`missing approved audio: ${file}`);
  const absolute=join(audioRoot,file);
  if(existsSync(absolute)){
    const bytes=readFileSync(absolute);
    if(!bytes.length)errors.push(`empty audio: ${file}`);
    if(bytes.subarray(0,4).toString('ascii')!=='OggS')errors.push(`${file}: invalid OGG signature`);
  }
  if(!soundCatalog.includes(`../../assets/audio/${file}?url`))errors.push(`audio catalog lacks static import: ${file}`);
}
for(const id of semanticSounds)if(!soundCatalog.includes(`'${id}'`)&&!soundCatalog.includes(`${id}:`))errors.push(`missing semantic sound mapping: ${id}`);
if((soundCatalog.match(/milestoneUrl/g)??[]).length<4)errors.push('milestone audio is not intentionally shared by three semantic events');
if(actualSfx.some(file=>/\.(?:wav|mp3)$/i.test(file)))errors.push('WAV or MP3 duplicate bundled with application SFX');

const musicFiles=Array.from({length:5},(_,index)=>`music/music-${String(index+1).padStart(2,'0')}.mp3`);
const musicHashes=['eebd0a569f78a866a32b317d4593b47a457e03c99d739d9db5fe97a4b56fd2d8','0c4d96d57b0086d5aff0549420f91a7665ec27c435d0c0ebf4b1f8b72bfdf5eb','a4fc88deaa3a00168af6000586e28f369718915b35952637c52874208d14eb46','606c40aac1ab739f31aecaf64ac2aee6b79cc8f0321bae7023320a79fca8400e','44d3f0f5ca943ef3124d7826b1ad36ae724a5ab209144831c745bea50309c9fb'];
if(actualMusic.length!==5)errors.push(`expected exactly five background music files, found ${actualMusic.length}`);
for(const [index,file] of musicFiles.entries()){
  if(!actualMusic.includes(file))errors.push(`missing background music: ${file}`);
  const absolute=join(audioRoot,file);
  if(existsSync(absolute)){
    const bytes=readFileSync(absolute);if(!bytes.length)errors.push(`empty background music: ${file}`);
    const startsId3=bytes.subarray(0,3).toString('ascii')==='ID3',startsFrame=bytes[0]===0xff&&(bytes[1]!&0xe0)===0xe0;
    if(!startsId3&&!startsFrame)errors.push(`${file}: invalid MP3 signature`);
    if(createHash('sha256').update(bytes).digest('hex')!==musicHashes[index])errors.push(`${file}: SHA-256 differs from approved manifest`);
  }
  const name=file.replace('music/','');
  if(!musicCatalog.includes(`../../assets/audio/music/${name}?url`))errors.push(`music catalog lacks static import: ${name}`);
}
for(const id of ['music-01','music-02','music-03','music-04','music-05'])if(!musicCatalog.includes(`'${id}'`))errors.push(`music catalog missing ID: ${id}`);
if(/https?:\/\//i.test(musicCatalog))errors.push('music catalog contains an external URL');
if(/\btitle\s*:/i.test(musicCatalog))errors.push('music catalog exposes a title');
if((musicCatalog.match(/^import music\d{2} /gm)??[]).length!==5)errors.push('music catalog must import exactly five assets');

const allowedWebp = new Set<string>(Object.values(visualFixAssetPaths.backgrounds));
for (const path of v4Actual.filter((path) => path.endsWith('.webp'))) {
  if (!allowedWebp.has(path)) errors.push(`unapproved V4 raster: ${path}`);
  const bytes = readFileSync(join(visualFixRoot, path));
  if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') errors.push(`${path}: invalid WebP signature`);
}

for (const [root, paths] of [[nordicRoot, nordicActual], [visualFixRoot, v4Actual.filter((path) => path.endsWith('.svg'))], [rewardVisualRoot, rewardVisualActual]] as const) {
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
  if (/\.png$/i.test(path)) errors.push(`unapproved PNG asset: ${relativePath}`);
  if (/\.(?:jpe?g|gif|avif)$/i.test(path)) errors.push(`unapproved raster asset: ${relativePath}`);
}

const runtimeFiles = walk(join(repositoryRoot, 'src')).filter((path) => /\.(?:astro|ts|css)$/i.test(path));
for (const path of runtimeFiles) {
  const source = readFileSync(path, 'utf8');
  if (/box-seal-(?:common|golden|legendary)|box-cross-(?:fi|sv)/i.test(source)) errors.push(`${normalize(relative(repositoryRoot, path))}: obsolete reward composition reference`);
  if (/visual-fix-v4\/rewards\/box-(?:hud|standard)\.svg|reference-sheet\.png/i.test(source)) errors.push(`${normalize(relative(repositoryRoot, path))}: obsolete or inspection-only reward asset reference`);
  if (/(?:src\s*=|url\()[^\n)]*https?:\/\//i.test(source)) errors.push(`${normalize(relative(repositoryRoot, path))}: external image URL`);
  if (/(?:new Audio|audio\.src)[^\n]*https?:\/\//i.test(source)) errors.push(`${normalize(relative(repositoryRoot, path))}: external runtime audio URL`);
}

if (errors.length) {
  console.error(`Asset audit failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exit(1);
}
console.log('Asset audit clean: 34 Nordic SVGs, 11 retained V4 assets, four Kruunu & Kilpi reward SVGs, four local WebPs, exactly eight approved local SFX OGGs, and exactly five local music MP3s.');
