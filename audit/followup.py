from probe import *
import concurrent.futures
created=json.loads((ROOT/'created.json').read_text())
def remember(kind,id):
 created[kind].append(id);(ROOT/'created.json').write_text(json.dumps(created,indent=2));return id
def ok(r):r.raise_for_status();return r.json()
bs=[];gs=[];ts=[]
try:
 for p in ['/health','/healthz','/openapi.json']:
  r=req('GET',p,headers={})
  if r.headers.get('location','').startswith('/'):
   req('GET',r.headers['location'],headers={})
 chosen=next(x for x in json.loads((ROOT/'search.json').read_text()) if x['source']=='gutenberg')
 r=req('POST','/api/v1/books',json={'source':chosen['source'],'result_id':chosen['result_id'],'result':chosen})
 b=remember('books',ok(r)['id']);bs.append(b)
 req('GET',f'/api/v1/covers/{b}')
 op=ok(req('POST','/api/v1/opds/tokens',json={'label':'AUDIT couverture'}));remember('opds',op['id']);ts.append(op['id'])
 req('GET',f"/opds/{op['token']}/cover/{b}",headers={})
 req('POST','/api/v1/opds/tokens/revoke',json={'token_id':op['id']});ts.remove(op['id'])
 req('GET',f"/opds/{op['token']}",headers={})
 gw=ok(req('POST','/api/v1/gateways',json={'name':'AUDIT recherche'}));g=remember('gateways',gw['gateway_id']);gs.append(g)
 rotated=ok(req('POST',f'/api/v1/gateways/{g}/recreate'))
 req('POST','/api/v1/gateways/pair',json={'pairing_token':gw['pairing_token']},headers={})
 req('POST','/api/v1/gateways/pair',json={'pairing_token':rotated['pairing_token']},headers={})
 h={'X-Gateway-Key':rotated['gateway_key']}
 req('POST','/api/v1/gateways/poll',headers=h)
 with concurrent.futures.ThreadPoolExecutor() as pool:
  fut=pool.submit(req,'POST','/api/v1/books/search',json={'query':'AUDIT','scope':['gateway:'+g]})
  for _ in range(15):
   time.sleep(.3);r=req('POST','/api/v1/gateways/poll',headers=h)
   if r.status_code==200:
    job=r.json()['job_id'];break
  else:raise RuntimeError('no search job')
  req('POST',f'/api/v1/gateways/jobs/{job}/search-results',headers=h,json=[{'source':'gateway:'+g,'result_id':'audit-guid','guid':'audit-guid','indexer_id':99,'title':'Titre indexeur audit','author':'Auteur audit','format':'epub'}])
  fut.result()
 req('GET',f'/api/v1/gateways/jobs/{job}')
 req('POST','/api/v1/gateways/revoke',json={'gateway_id':g})
 req('POST','/api/v1/gateways/poll',headers=h)
 req('POST',f'/api/v1/gateways/{g}/recreate')
finally:
 for id in ts:req('POST','/api/v1/opds/tokens/revoke',json={'token_id':id})
 for id in bs:req('DELETE','/api/v1/books/'+id)
 for id in gs:req('DELETE','/api/v1/gateways/'+id)
