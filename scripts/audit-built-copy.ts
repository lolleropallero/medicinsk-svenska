import { readdirSync,readFileSync,statSync } from 'node:fs';
import { join } from 'node:path';

const brokenGoal=['10 tehtävää','päivän kapseliin'].join(' ');
const forbidden=[brokenGoal,'Palkintokapseli','Putkisuoja','Uudelleenarvontatunnus','Kausipolku','Kausipisteet'];
const files=(directory:string):string[]=>readdirSync(directory).flatMap(name=>{const path=join(directory,name);return statSync(path).isDirectory()?files(path):/\.(?:html|js)$/.test(name)?[path]:[];});
const activeExerciseHtml=['dist/kortit/harjoitus/index.html','dist/fraasit/harjoitus/index.html','dist/kuvailu/harjoitus/index.html','dist/tilanteet/harjoitus/index.html'];
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
const productionOrigin='https://medicinsksvenska.fi';
const retiredOrigin='https://medicinsk-svenska.aleksisalone.workers.dev';
for(const path of outputFiles.filter(path=>path.endsWith('.html'))){
  const content=readFileSync(path,'utf8'),relativePath=path.replace(/\\/g,'/').replace(/^dist\//,''),pathname=relativePath==='index.html'?'/':`/${relativePath.replace(/index\.html$/,'')}`,expected=`${productionOrigin}${pathname}`;
  const canonicals=[...content.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map(match=>match[1]);
  const openGraphUrls=[...content.matchAll(/<meta property="og:url" content="([^"]+)"/g)].map(match=>match[1]);
  if(canonicals.length!==1||canonicals[0]!==expected)matches.push(`${path}: expected one canonical URL ${expected}, found ${canonicals.join(', ')||'none'}`);
  if(openGraphUrls.length!==1||openGraphUrls[0]!==expected)matches.push(`${path}: expected one og:url ${expected}, found ${openGraphUrls.join(', ')||'none'}`);
}
const sitemapIndex=readFileSync('dist/sitemap-index.xml','utf8'),sitemap=readFileSync('dist/sitemap-0.xml','utf8'),robots=readFileSync('dist/robots.txt','utf8');
if(!sitemapIndex.includes(`${productionOrigin}/sitemap-0.xml`))matches.push('dist/sitemap-index.xml: canonical sitemap URL missing');
for(const route of ['/','/kortit/harjoitus/','/edistyminen/'])if(!sitemap.includes(`<loc>${productionOrigin}${route}</loc>`))matches.push(`dist/sitemap-0.xml: missing ${route}`);
if(!robots.includes(`Sitemap: ${productionOrigin}/sitemap-index.xml`))matches.push('dist/robots.txt: canonical sitemap reference missing');
for(const [path,content] of [['dist/sitemap-index.xml',sitemapIndex],['dist/sitemap-0.xml',sitemap],['dist/robots.txt',robots]] as const)if(content.includes(retiredOrigin))matches.push(`${path}: retired production origin emitted`);
const svgFiles=outputFiles.filter(path=>path.endsWith('.svg'));
const rasterFiles=outputFiles.filter(path=>/\.(?:png|jpe?g|gif|webp|avif)$/i.test(path));
const webpFiles=rasterFiles.filter(path=>path.endsWith('.webp'));
const pngFiles=rasterFiles.filter(path=>path.endsWith('.png'));
const otherRasterFiles=rasterFiles.filter(path=>!path.endsWith('.webp')&&!path.endsWith('.png'));
if(svgFiles.length!==46)matches.push(`dist: expected 46 emitted SVG assets, found ${svgFiles.length}`);
for(const path of svgFiles)if(!/\.[A-Za-z0-9_-]{6,}\.svg$/.test(path))matches.push(`${path}: SVG filename is not hashed`);
if(webpFiles.length!==4)matches.push(`dist: expected exactly four emitted WebP backgrounds, found ${webpFiles.length}`);
for(const name of ['home-dark','rewards-dark','shell-light','study-light'])if(!webpFiles.some(path=>path.includes(name)))matches.push(`dist: missing ${name} WebP background`);
for(const path of webpFiles)if(!/\.[A-Za-z0-9_-]{6,}\.webp$/.test(path))matches.push(`${path}: WebP filename is not hashed`);
if(pngFiles.length!==0)matches.push(`dist: expected no PNG assets, found ${pngFiles.length}`);
for(const name of ['reward-hud','reward-standard','reward-golden','reward-legendary'])if(!svgFiles.some(path=>path.includes(name)))matches.push(`dist: missing ${name} SVG`);
for(const path of otherRasterFiles)matches.push(`${path}: unapproved raster image emitted`);
for(const path of outputFiles)if(/box-(?:seal|cross)-(?:common|golden|legendary|fi|sv)/i.test(path))matches.push(`${path}: obsolete reward asset emitted`);
for(const path of outputFiles)if(/box-(?:hud|standard)\.[A-Za-z0-9_-]{6,}\.svg$|reference-sheet/i.test(path))matches.push(`${path}: obsolete or inspection-only standard reward asset emitted`);
for(const path of outputFiles.filter(path=>/\.(?:html|css|js)$/i.test(path))){const content=readFileSync(path,'utf8');if(/(?:url\(|src=)[^\n)]*https?:\/\//i.test(content))matches.push(`${path}: external asset URL emitted`);if(/box-seal-(?:common|golden|legendary)|box-cross-(?:fi|sv)/i.test(content))matches.push(`${path}: obsolete reward composition emitted`);for(const [label,geometry] of obsoleteInlineGeometry)if(content.includes(geometry))matches.push(`${path}: obsolete inline ${label} geometry emitted`);}
if(matches.length){console.error(`Forbidden learner-visible copy found:\n${matches.join('\n')}`);process.exit(1);}
console.log(`Built-output audit clean: ${files('dist').length} HTML/JavaScript files checked; ${svgFiles.length} hashed SVGs including four Kruunu & Kilpi rewards; four WebPs and no PNGs.`);
