import { readdirSync,readFileSync,statSync } from 'node:fs';
import { join } from 'node:path';

const brokenGoal=['10 tehtävää','päivän kapseliin'].join(' ');
const forbidden=[brokenGoal,'Palkintokapseli','Putkisuoja','Uudelleenarvontatunnus','Kausipolku','Kausipisteet'];
const files=(directory:string):string[]=>readdirSync(directory).flatMap(name=>{const path=join(directory,name);return statSync(path).isDirectory()?files(path):/\.(?:html|js)$/.test(name)?[path]:[];});
const activeExerciseHtml=['dist/kortit/harjoitus/index.html','dist/fraasit/harjoitus/index.html','dist/kuvailu/harjoitus/index.html'];
const languageLabels=['Suomi','Svenska','Suomeksi','Ruotsiksi'];
const obsoleteInlineGeometry=[
  ['brand','M4 5.5C4 3.6 5.6 2'],
  ['reward box','M4 8h16v12H4'],
  ['achievement badge','m12 3 2.2 4.5'],
  ['league shield','M12 3 4 6v6c0 5'],
  ['anatomy deck','M8 21l1-7-2-5'],
  ['first-aid deck','rotate(-28 12 12)'],
] as const;
const visibleMarker=/<span(?=[^>]*class="[^"]*\blanguage-ribbon\b[^"]*")[^>]*>\s*([^<\s][^<]*)<\/span>/gi;
const matches=files('dist').flatMap(path=>{const content=readFileSync(path,'utf8');return forbidden.filter(value=>content.includes(value)).map(value=>`${path}: ${value}`);});
for(const path of activeExerciseHtml){const content=readFileSync(path,'utf8');for(const match of content.matchAll(visibleMarker))matches.push(`${path}: visible language marker text "${match[1]!.trim()}"`);}
for(const path of files('dist/_astro').filter(path=>/harjoitus\.[^\\/]+\.js$/.test(path))){const content=readFileSync(path,'utf8');for(const label of languageLabels)if(content.includes(`"${label}"`)||content.includes(`'${label}'`))matches.push(`${path}: active exercise label ${label}`);}
const emitted=(directory:string):string[]=>readdirSync(directory).flatMap(name=>{const path=join(directory,name);return statSync(path).isDirectory()?emitted(path):[path];});
const outputFiles=emitted('dist');
const svgFiles=outputFiles.filter(path=>path.endsWith('.svg'));
const rasterFiles=outputFiles.filter(path=>/\.(?:png|jpe?g|gif|webp|avif)$/i.test(path));
const webpFiles=rasterFiles.filter(path=>path.endsWith('.webp'));
const pngFiles=rasterFiles.filter(path=>path.endsWith('.png'));
const otherRasterFiles=rasterFiles.filter(path=>!path.endsWith('.webp')&&!path.endsWith('.png'));
if(svgFiles.length!==43)matches.push(`dist: expected 43 emitted SVG assets, found ${svgFiles.length}`);
for(const path of svgFiles)if(!/\.[A-Za-z0-9_-]{6,}\.svg$/.test(path))matches.push(`${path}: SVG filename is not hashed`);
if(webpFiles.length!==4)matches.push(`dist: expected exactly four emitted WebP backgrounds, found ${webpFiles.length}`);
for(const name of ['home-dark','rewards-dark','shell-light','study-light'])if(!webpFiles.some(path=>path.includes(name)))matches.push(`dist: missing ${name} WebP background`);
for(const path of webpFiles)if(!/\.[A-Za-z0-9_-]{6,}\.webp$/.test(path))matches.push(`${path}: WebP filename is not hashed`);
if(pngFiles.length!==3)matches.push(`dist: expected exactly three Standard Box V5 PNGs, found ${pngFiles.length}`);
for(const name of ['box-standard-hud','box-standard-card','box-standard-hero'])if(!pngFiles.some(path=>path.includes(name)))matches.push(`dist: missing ${name} PNG`);
for(const path of pngFiles)if(!/\.[A-Za-z0-9_-]{6,}\.png$/.test(path))matches.push(`${path}: PNG filename is not hashed`);
for(const path of otherRasterFiles)matches.push(`${path}: unapproved raster image emitted`);
for(const path of outputFiles)if(/box-(?:seal|cross)-(?:common|golden|legendary|fi|sv)/i.test(path))matches.push(`${path}: obsolete reward asset emitted`);
for(const path of outputFiles)if(/box-(?:hud|standard)\.[A-Za-z0-9_-]{6,}\.svg$|reference-sheet/i.test(path))matches.push(`${path}: obsolete or inspection-only standard reward asset emitted`);
for(const path of outputFiles.filter(path=>/\.(?:html|css|js)$/i.test(path))){const content=readFileSync(path,'utf8');if(/(?:url\(|src=)[^\n)]*https?:\/\//i.test(content))matches.push(`${path}: external asset URL emitted`);if(/box-seal-(?:common|golden|legendary)|box-cross-(?:fi|sv)/i.test(content))matches.push(`${path}: obsolete reward composition emitted`);for(const [label,geometry] of obsoleteInlineGeometry)if(content.includes(geometry))matches.push(`${path}: obsolete inline ${label} geometry emitted`);}
if(matches.length){console.error(`Forbidden learner-visible copy found:\n${matches.join('\n')}`);process.exit(1);}
console.log(`Built-output audit clean: ${files('dist').length} HTML/JavaScript files checked; ${svgFiles.length} hashed SVGs; four WebPs and exactly three Standard Box V5 PNGs.`);
