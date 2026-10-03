from probe import *
created=json.loads((ROOT/'created.json').read_text());books=[];g=None;op=None
try:
 gw=req('POST','/api/v1/gateways',json={'name':'AUDIT double import'}).json();g=gw['gateway_id'];created['gateways'].append(g)
 req('POST','/api/v1/gateways/pair',json={'pairing_token':gw['pairing_token']},headers={})
 for n in (1,2):
  meta={'source':'gateway:'+g,'result_id':f'audit-cover-{n}','guid':f'audit-cover-{n}','title':f'Audit couverture {n}','author':'Auteur Audit','cover_url':'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg'}
  job=req('POST','/api/v1/books',json={'source':'gateway:'+g,'result_id':meta['result_id'],'result':meta}).json()['gateway_job_id']
  r=req('POST',f'/api/v1/gateways/jobs/{job}/fetch-result',headers={'X-Gateway-Key':gw['gateway_key']},files={'file':('audit.epub',(ROOT/'fixture.epub').read_bytes(),'application/epub+zip')});r.raise_for_status();b=r.json()['library_item_id'];books.append(b);created['books'].append(b)
  (ROOT/'created.json').write_text(json.dumps(created,indent=2))
  req('GET',f'/api/v1/books/{b}')
 req('GET',f'/api/v1/covers/{b}')
 op=req('POST','/api/v1/opds/tokens',json={'label':'AUDIT image'}).json();created['opds'].append(op['id']);(ROOT/'created.json').write_text(json.dumps(created,indent=2))
 req('GET',f"/opds/{op['token']}/cover/{b}",headers={})
finally:
 if op:req('POST','/api/v1/opds/tokens/revoke',json={'token_id':op['id']})
 for b in books:req('DELETE','/api/v1/books/'+b)
 if g:req('DELETE','/api/v1/gateways/'+g)
