from probe import *
import io,zipfile,re
# Never persist credentials, URLs, or Atom content containing OPDS secrets.
import probe
old_redact=probe.redact
probe.redact=lambda x: '[XML/HTML omitted]' if isinstance(x,str) and ('<?xml' in x or '<html' in x.lower()) else old_redact(x)
created={'books':[],'devices':[],'gateways':[],'opds':[]}
def remember(kind,id):
 created[kind].append(id);(ROOT/'created.json').write_text(json.dumps(created,indent=2));return id
def ok(r):r.raise_for_status();return r.json()
buf=io.BytesIO()
with zipfile.ZipFile(buf,'w') as z:
 z.writestr('mimetype','application/epub+zip');z.writestr('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');z.writestr('content.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Audit Ferry</dc:title><dc:identifier id="id">audit-ferry</dc:identifier><dc:language>fr</dc:language></metadata><manifest><item id="text" href="text.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="text"/></spine></package>');z.writestr('text.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Audit</title></head><body><p>Test fonctionnel temporaire.</p></body></html>')
(ROOT/'fixture.epub').write_bytes(buf.getvalue())
try:
 profile=ok(req('GET','/api/v1/users/me'))
 assert ok(req('GET','/api/v1/books'))['total']==0
 for p in ['devices','gateways','opds/tokens']:assert ok(req('GET','/api/v1/'+p))==[]
 d=remember('devices',ok(req('POST','/api/v1/devices',json={'brand':'kindle','name':'AUDIT temporaire','email_address':'audit@kindle.com'}))['id'])
 req('GET',f'/api/v1/devices/{d}');req('GET',f'/api/v1/devices/{d}/methods')
 req('PATCH',f'/api/v1/devices/{d}',json={'name':'AUDIT modifié','conversion_profile':'reader_7in_plus'})
 for provider in ['dropbox','drive']:req('GET',f'/api/v1/devices/{d}/link',params={'provider':provider})
 req('GET',f'/api/v1/devices/{d}/link/callback')
 req('POST',f'/api/v1/devices/{d}/link/callback',json={'provider':'invalid','code':'audit'})
 req('PATCH','/api/v1/users/me',json={'default_format':'pdf'})
 req('PATCH','/api/v1/users/me',json={'default_format':profile['default_format']})
 sources=ok(req('GET','/api/v1/sources'));s=sources[0]
 req('PATCH','/api/v1/sources/'+s['id'],json={'enabled':False})
 req('PATCH','/api/v1/sources/'+s['id'],json={'enabled':s['enabled']})
 search=ok(req('POST','/api/v1/books/search',json={'query':'Pride and Prejudice','scope':['legal']}))
 (ROOT/'search.json').write_text(json.dumps(search,ensure_ascii=False,indent=2))
 chosen=next((x for x in search if x['source']=='gutenberg'),None)
 if chosen:
  r=req('POST','/api/v1/books',json={'source':chosen['source'],'result_id':chosen['result_id']})
  if r.status_code==201:remember('books',r.json()['id'])
 b=remember('books',ok(req('POST','/api/v1/books/upload',files={'file':('audit.epub',buf.getvalue(),'application/epub+zip')}))['id'])
 req('GET',f'/api/v1/books/{b}');req('GET',f'/api/v1/books/{b}/deliveries');req('GET',f'/api/v1/covers/{b}')
 req('PATCH',f'/api/v1/books/{b}',json={'title':'Audit Titre','author':'Audit Auteur','page_count':12,'description':'Description audit','language':'fr','publisher':'Audit','published_year':2026,'isbn':'AUDIT'})
 req('GET','/api/v1/books',params={'q':'audit titre','page':1,'limit':1})
 req('PATCH',f'/api/v1/books/{b}',json={'page_count':None,'description':None})
 req('PATCH',f'/api/v1/books/{b}',json={'title':None})
 req('GET',f'/api/v1/books/{b}')
 r=req('POST',f'/api/v1/books/{b}/download-link',json={})
 if r.status_code==200:req('GET',r.json()['url'].removeprefix(BASE),headers={})
 # Rejected method cannot send mail.
 req('POST','/api/v1/deliveries',json={'library_item_id':b,'device_id':d,'method':'dropbox'})
 req('GET','/api/v1/deliveries/00000000-0000-0000-0000-000000000000')
 op=ok(req('POST','/api/v1/opds/tokens',json={'label':'AUDIT temporaire'}));remember('opds',op['id'])
 req('GET','/api/v1/opds/tokens')
 for suffix in ['', '/all','/authors','/author?name=Audit%20Auteur','/recent','/search?q=Audit','/opensearch.xml',f'/cover/{b}',f'/download/{b}']:
  req('GET','/opds/'+op['token']+suffix,headers={})
 # Empty contract body and bad types demonstrate validation without writes.
 req('POST','/api/v1/books',json={});req('POST','/api/v1/books',json=[])
 req('PATCH','/api/v1/users/me',json={'default_format':None})
 req('GET','/api/v1/users/me')
 gw=ok(req('POST','/api/v1/gateways',json={'name':'AUDIT temporaire'}));g=remember('gateways',gw['gateway_id'])
 req('POST','/api/v1/gateways/pair',json={'pairing_token':gw['pairing_token']},headers={})
 req('POST','/api/v1/gateways/poll',headers={'X-Gateway-Key':gw['gateway_key']})
 req('GET',f'/api/v1/gateways/{g}/jobs')
 queued=ok(req('POST','/api/v1/books',json={'source':'gateway:'+g,'result_id':'audit-reference'}));job=queued['gateway_job_id']
 req('GET',f'/api/v1/gateways/jobs/{job}');req('GET',f'/api/v1/gateways/{g}/jobs')
 req('POST','/api/v1/gateways/poll',headers={'X-Gateway-Key':gw['gateway_key']})
 r=req('POST',f'/api/v1/gateways/jobs/{job}/fetch-result',headers={'X-Gateway-Key':gw['gateway_key']},files={'file':('audit-gateway.epub',buf.getvalue(),'application/epub+zip')})
 if r.status_code==200:remember('books',r.json()['library_item_id'])
 req('GET',f'/api/v1/gateways/jobs/{job}')
 req('POST',f'/api/v1/gateways/jobs/{job}/search-results',headers={'X-Gateway-Key':gw['gateway_key']},json=[])
 rotated=ok(req('POST',f'/api/v1/gateways/{g}/recreate'))
 req('POST','/api/v1/gateways/poll',headers={'X-Gateway-Key':gw['gateway_key']})
 req('POST','/api/v1/gateways/revoke',json={'gateway_id':g})
finally:
 for id in created['opds']:req('POST','/api/v1/opds/tokens/revoke',json={'token_id':id})
 for id in created['books']:req('DELETE','/api/v1/books/'+id)
 for id in created['devices']:req('DELETE','/api/v1/devices/'+id)
 for id in created['gateways']:req('DELETE','/api/v1/gateways/'+id)
 for p in ['books','devices','gateways','opds/tokens','users/me','sources','deliveries']:req('GET','/api/v1/'+p)
