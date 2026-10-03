from probe import *
chosen=next(x for x in json.loads((ROOT/'search.json').read_text()) if x['source']=='standard_ebooks')
b=None
try:
 r=req('POST','/api/v1/books',json={'source':chosen['source'],'result_id':chosen['result_id'],'result':chosen})
 if r.status_code==201:
  b=r.json()['id'];created=json.loads((ROOT/'created.json').read_text());created['books'].append(b);(ROOT/'created.json').write_text(json.dumps(created,indent=2))
  req('GET','/api/v1/books/'+b)
finally:
 if b:req('DELETE','/api/v1/books/'+b)
 for p in ['books','devices','gateways','opds/tokens','sources','users/me','deliveries']:req('GET','/api/v1/'+p)
