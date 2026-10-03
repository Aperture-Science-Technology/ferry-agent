import pathlib,json,re,collections,hashlib
R=pathlib.Path(__file__).resolve().parent;root=R.parent
report=(R/'REVUE-FONCTIONNELLE.md').read_text();spec=json.loads((root/'openapi.json').read_text())
assert spec==json.loads((R/'openapi-deployed.json').read_text())==json.loads((R/'openapi-code.json').read_text())
endpoints=re.findall(r'^\| (GET|POST|PATCH|DELETE) \| `([^`]+)` \|',report,re.M)
expected=[(m.upper(),p) for p,ms in spec['paths'].items() for m in ms]
assert collections.Counter(endpoints)==collections.Counter(expected)
tools=json.loads((R/'contract-inventory.json').read_text())
for t in tools:assert len(re.findall(r'^\| `'+t['name']+r'` \|',report,re.M))==1
assert len(tools)==36 and len(expected)==55
assert len(re.findall(r'^### F\d+ —',report,re.M))==8
logs=[json.loads(x) for x in (R/'http.jsonl').read_text().splitlines()];end={x['path']:x for x in logs[-7:]}
assert end['/api/v1/books']['response']['total']==0
for p in ['devices','gateways','opds/tokens','deliveries']:assert end['/api/v1/'+p]['response']==[]
initial={x['path']:x['response'] for x in logs[:11]}
assert end['/api/v1/users/me']['response']==initial['/api/v1/users/me']
assert sorted(end['/api/v1/sources']['response'],key=lambda x:x['id'])==sorted(initial['/api/v1/sources'],key=lambda x:x['id'])
for p in R.glob('*.py'):compile(p.read_text(),str(p),'exec')
for p in R.glob('*.jsonl'):
 for line in p.read_text().splitlines():json.loads(line)
print('PASS : 36 outils, 55 opérations, 8 défauts, contrat identique et nettoyage final contrôlés.')
print('HTTP requests:',len(logs),'plus',len((R/'wrapper-http.jsonl').read_text().splitlines()),'appels HTTP des fonctions MCP.')
print('Dernière preuve:',logs[-1]['time'])
for part in ['Les 36 outils MCP','Les 55 opérations du cœur']:
 sec=report.split('## '+('2. ' if part.startswith('Les 36') else '3. ')+part)[1].split('###')[0]
 print(part,collections.Counter(re.findall(r'\| (OK|DÉFAUT|NON VÉRIFIABLE) \|',sec)))
