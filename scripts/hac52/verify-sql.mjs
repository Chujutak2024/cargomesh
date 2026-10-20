import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,sql} from './provision-local.mjs';
try{
 const result=sql(await fs.readFile(path.join(ROOT,'supabase/tests/hac52_client_context.test.sql'),'utf8'));
 const lines=result.split(/\r?\n/).filter(line=>/^(not ok|ok |1\.\.|#)/.test(line));
 console.log(lines.join('\n'));
 if(process.argv[2])await fs.writeFile(process.argv[2],lines.join('\n')+'\n');
 if(lines.some(line=>line.startsWith('not ok'))||!lines.some(line=>/^1\.\.[1-9]/.test(line)))throw new Error('Focused SQL suite failed or did not finish.');
 console.log('Focused HAC-52 SQL suite completed under authenticated + real synthetic JWT claims; fixture transaction rolled back.');
}catch(error){console.error(error.message);process.exitCode=1;}
