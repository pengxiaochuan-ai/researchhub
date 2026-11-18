// Reuse the approved existing compiled unit groups; never rebuild, seed or run native all.
import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),pkg=JSON.parse(readFileSync(root+'app/server/package.json'));
const commands=['test','test:research-workflow','test:wp01:auth','posttest'].map(k=>pkg.scripts[k]);
const paths=[...new Set(commands.flatMap(c=>c.match(/dist\/[A-Za-z0-9_./-]+\.spec\.js/g)??[]))];assert(paths.length>50);console.log('WP02 approved compiled groups: '+paths.length+' files');const r=spawnSync(process.execPath,['--test',...paths],{cwd:root+'app/server',stdio:'inherit'});process.exitCode=r.status??1;
