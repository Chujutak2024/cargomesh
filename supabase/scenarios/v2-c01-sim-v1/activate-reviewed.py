"""Preview by default. Hosted writes require separate human rollout approval."""
from pathlib import Path
import argparse,hashlib,json,re,subprocess

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--expected-sha256',required=True)
p.add_argument('--project-ref',default='yhimeajpzicjbxpbzsyh')
p.add_argument('--apply',action='store_true')
p.add_argument('--approval-reference')
p.add_argument('--ack-carrier-quote-authority',action='store_true')
p.add_argument('--output',type=Path)
p.add_argument('--repo-root',type=Path,default=Path(__file__).resolve().parents[3])
a=p.parse_args();source=Path(__file__).resolve().parent
if a.project_ref!='yhimeajpzicjbxpbzsyh':p.error('Unexpected target project')
if not re.fullmatch('[a-f0-9]{64}',a.expected_sha256):p.error('Expected SHA-256 required')
body=(source/'C01-SIM-v1.json').read_bytes();digest=hashlib.sha256(body).hexdigest()
if digest!=a.expected_sha256:p.error('Dataset differs from reviewed SHA-256')
m=json.loads(body);seed=(source/'seed.sql').read_text(encoding='utf-8')
embedded=re.search(r'\$c01manifest\$(.*?)\$c01manifest\$',seed,re.S)
if not embedded or hashlib.sha256(embedded.group(1).encode()).hexdigest()!=digest:p.error('Seed embeds a different dataset')
if m['autoConfirmAllowed'] is not False or any(x['value']['dispatch']['autoConfirm'] for x in m['operations'] if x['api']=='quotePolicy'):p.error('Automatic booking confirmation not approved')
summary={'mode':'PREVIEW','dataset':m['dataset'],'version':m['version'],'sha256':digest,'operations':len(m['operations']),'autoConfirm':False,'projectRef':a.project_ref,'hostedWrites':0}
if not a.apply:
 print(json.dumps(summary));raise SystemExit(0)
if not a.approval_reference or not a.ack_carrier_quote_authority or a.output is None:p.error('--apply requires the human approval reference, Carrier quote-authority acknowledgement, and output directory')
# The psql prologue is replaced only after equivalent explicit approval/hash/target
# checks above. Native transaction, identity checks and mandatory hash gate remain.
parts=seed.split('\nbegin;\n',1)
if len(parts)!=2:p.error('Unexpected seed format')
query='begin;\n'+parts[1]
query=query.replace(":'c01_expected_sha256'","'"+digest+"'")
if '\\quit' in query or '\\if' in query or "c01_expected_sha256'" in query:p.error('Unresolved seed guard')
a.output.mkdir(parents=True,exist_ok=True)
query_path=a.output/'reviewed-activation.sql';query_path.write_text(query,encoding='utf-8',newline='\n')
r=subprocess.run(['npx.cmd','--yes','supabase@2.117.0','db','query','--linked','--project-ref',a.project_ref,'--file',str(query_path),'--output','json'],cwd=a.repo_root,capture_output=True,text=True,encoding='utf-8',timeout=120)
if r.returncode:
 (a.output/'activation-error.log').write_text(r.stderr,encoding='utf-8');raise RuntimeError('Native activation failed; see scoped log. Do not retry with different keys.')
results=json.loads(r.stdout)['rows'];record=next(x['activation_result'] for x in results if 'activation_result' in x)
summary.update({'mode':'APPLIED','hostedWrites':'23 native operations plus their receipts/relations; no order/bookings created','approvalReference':a.approval_reference,'record':record})
(a.output/'ACTIVATION-RESULT.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps({'mode':'APPLIED','dataset':m['dataset'],'sha256':digest,'references':len(record['references']),'autoConfirm':False}))
