import ast,json,re,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
s=json.loads((root/'openapi.json').read_text());tree=ast.parse((root/'mcp-server/ferry_mcp/server.py').read_text())
functions={n.name:n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef))}
def calls(n,seen=None):
 seen=set() if seen is None else seen
 out=[]
 for x in ast.walk(n):
  if isinstance(x,ast.Call) and isinstance(x.func,ast.Attribute) and isinstance(x.func.value,ast.Name) and x.func.value.id=='client' and x.func.attr in ('get','post','patch','delete'):
   raw=ast.unparse(x.args[0]);path=re.sub(r'\{.*?\}','{}',raw.strip('f').strip('\"\'')); matched=next((p for p in s['paths'] if re.sub(r'\{.*?\}','{}',p)==path),None)
   out.append({'line':x.lineno,'method':x.func.attr.upper(),'path':matched or raw,'request':ast.unparse(x),'exists':bool(matched and x.func.attr in s['paths'][matched])})
  if isinstance(x,ast.Call) and isinstance(x.func,ast.Name) and x.func.id in functions and x.func.id.startswith('_') and x.func.id not in seen:
   seen.add(x.func.id);out+=calls(functions[x.func.id],seen)
 return out
tools=[]
for n in functions.values():
 if any(ast.unparse(d)=='mcp.tool' for d in n.decorator_list):
  tools.append({'name':n.name,'line':n.lineno,'signature':ast.unparse(n.args),'calls':calls(n),'response_keys':sorted({x.args[0].value for x in ast.walk(n) if isinstance(x,ast.Call) and isinstance(x.func,ast.Attribute) and x.func.attr=='get' and x.args and isinstance(x.args[0],ast.Constant) and isinstance(x.args[0].value,str) and not x.args[0].value.startswith('/')})})
(root/'audit/contract-inventory.json').write_text(json.dumps(tools,indent=2,ensure_ascii=False))
lines=['# Inventaire mécanique des contrats','', '36 outils ; appels directs et helpers HTTP inclus. Les clés lues ci-dessous proviennent des `.get()` ; les accès indexés et les formateurs partagés sont analysés dans le rapport. Tous les appels ajoutent `Authorization: Bearer <assertion>` et `User-Agent: ferry-agent-mcp`. JSON : Content-Type application/json ajouté par httpx ; GET/DELETE sans corps.','']
for t in tools:
 lines+=['## '+t['name'],f"`server.py:{t['line']}` — `{t['signature']}`",'']
 for c in t['calls']:
  op=s['paths'].get(c['path'],{}).get(c['method'].lower(),{})
  lines += [f"- L{c['line']} : `{c['request']}` ; route {'présente' if c['exists'] else 'ABSENTE'}.", '  Contrat corps : `'+json.dumps(op.get('requestBody',{}),ensure_ascii=False)+'`', '  Paramètres métier : `'+json.dumps([p for p in op.get('parameters',[]) if p['in']!='header'],ensure_ascii=False)+'`']
 lines+=['','Clés de réponse lues : '+', '.join('`'+x+'`' for x in t['response_keys']), '']
lines+=['# Schémas : noms, types, obligatoires','']
for name,schema in s['components']['schemas'].items():lines += [f'## {name}','```json',json.dumps(schema,indent=2,ensure_ascii=False),'```','']
(root/'audit/CONTRATS.md').write_text('\n'.join(lines))
print(len(tools),'tools;',sum(not c['exists'] for t in tools for c in t['calls']),'missing calls')
