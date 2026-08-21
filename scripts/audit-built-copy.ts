import { readdirSync,readFileSync,statSync } from 'node:fs';
import { join } from 'node:path';

const brokenGoal=['10 tehtävää','päivän kapseliin'].join(' ');
const forbidden=[brokenGoal,'Palkintokapseli','Putkisuoja','Uudelleenarvontatunnus','Kausipolku','Kausipisteet'];
const files=(directory:string):string[]=>readdirSync(directory).flatMap(name=>{const path=join(directory,name);return statSync(path).isDirectory()?files(path):/\.(?:html|js)$/.test(name)?[path]:[];});
const matches=files('dist').flatMap(path=>{const content=readFileSync(path,'utf8');return forbidden.filter(value=>content.includes(value)).map(value=>`${path}: ${value}`);});
if(matches.length){console.error(`Forbidden learner-visible copy found:\n${matches.join('\n')}`);process.exit(1);}
console.log(`Built-copy audit clean: ${files('dist').length} HTML/JavaScript files checked.`);
