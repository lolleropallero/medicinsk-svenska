import { readdirSync,readFileSync,statSync } from 'node:fs';
import { join } from 'node:path';

const brokenGoal=['10 tehtävää','päivän kapseliin'].join(' ');
const forbidden=[brokenGoal,'Palkintokapseli','Putkisuoja','Uudelleenarvontatunnus','Kausipolku','Kausipisteet'];
const files=(directory:string):string[]=>readdirSync(directory).flatMap(name=>{const path=join(directory,name);return statSync(path).isDirectory()?files(path):/\.(?:html|js)$/.test(name)?[path]:[];});
const activeExerciseHtml=['dist/kortit/harjoitus/index.html','dist/fraasit/harjoitus/index.html','dist/kuvailu/harjoitus/index.html'];
const languageLabels=['Suomi','Svenska','Suomeksi','Ruotsiksi'];
const visibleMarker=/<span(?=[^>]*class="[^"]*\blanguage-ribbon\b[^"]*")[^>]*>\s*([^<\s][^<]*)<\/span>/gi;
const matches=files('dist').flatMap(path=>{const content=readFileSync(path,'utf8');return forbidden.filter(value=>content.includes(value)).map(value=>`${path}: ${value}`);});
for(const path of activeExerciseHtml){const content=readFileSync(path,'utf8');for(const match of content.matchAll(visibleMarker))matches.push(`${path}: visible language marker text "${match[1]!.trim()}"`);}
for(const path of files('dist/_astro').filter(path=>/harjoitus\.[^\\/]+\.js$/.test(path))){const content=readFileSync(path,'utf8');for(const label of languageLabels)if(content.includes(`"${label}"`)||content.includes(`'${label}'`))matches.push(`${path}: active exercise label ${label}`);}
if(matches.length){console.error(`Forbidden learner-visible copy found:\n${matches.join('\n')}`);process.exit(1);}
console.log(`Built-copy audit clean: ${files('dist').length} HTML/JavaScript files checked.`);
