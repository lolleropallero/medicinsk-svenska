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
if(svgFiles.length!==45)matches.push(`dist: expected 45 emitted SVG assets, found ${svgFiles.length}`);
for(const path of svgFiles)if(!/\.[A-Za-z0-9_-]{6,}\.svg$/.test(path))matches.push(`${path}: SVG filename is not hashed`);
for(const path of rasterFiles)matches.push(`${path}: raster image emitted`);
for(const path of outputFiles.filter(path=>/\.(?:html|css|js)$/i.test(path))){const content=readFileSync(path,'utf8');if(/(?:url\(|src=)[^\n)]*https?:\/\//i.test(content))matches.push(`${path}: external asset URL emitted`);for(const [label,geometry] of obsoleteInlineGeometry)if(content.includes(geometry))matches.push(`${path}: obsolete inline ${label} geometry emitted`);}
if(matches.length){console.error(`Forbidden learner-visible copy found:\n${matches.join('\n')}`);process.exit(1);}
console.log(`Built-output audit clean: ${files('dist').length} HTML/JavaScript files checked; ${svgFiles.length} hashed SVGs; 0 raster assets.`);
