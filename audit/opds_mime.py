from probe import *
import probe
old=probe.redact
probe.redact=lambda x:'[XML omitted]' if isinstance(x,str) and '<?xml' in x else old(x)
op=None
try:
 op=req('POST','/api/v1/opds/tokens',json={'label':'AUDIT contrat XML'}).json()
 created=json.loads((ROOT/'created.json').read_text());created['opds'].append(op['id']);(ROOT/'created.json').write_text(json.dumps(created,indent=2))
 for tail in ['', '/all','/recent','/authors','/author?name=Audit','/search?q=Audit','/opensearch.xml']:req('GET','/opds/'+op['token']+tail,headers={})
finally:
 if op:req('POST','/api/v1/opds/tokens/revoke',json={'token_id':op['id']})
 for p in ['books','devices','gateways','opds/tokens','sources','users/me','deliveries']:req('GET','/api/v1/'+p)
