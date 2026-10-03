import os,sys,asyncio,json,uuid
from probe import *
os.environ['MCP_AUTH_ENABLED']='false'
sys.path.insert(0,str(ROOT.parent/'mcp-server'))
from ferry_mcp import server
server._resolve_user_token=token
async def on_request(r):
 if r.method=='POST' and r.url.path=='/api/v1/deliveries':raise RuntimeError('Audit: envoi interdit')
async def on_response(r):
 await r.aread()
 try:body=r.json()
 except Exception:body=r.text[:200]
 with (ROOT/'wrapper-http.jsonl').open('a') as f:f.write(json.dumps({'method':r.request.method,'path':r.request.url.path,'status':r.status_code,'response':redact(body)},ensure_ascii=False)+'\n')
server._client=lambda t:httpx.AsyncClient(base_url=BASE,headers={'Authorization':'Bearer '+t},event_hooks={'request':[on_request],'response':[on_response]},timeout=45)
async def call(name,**kw):
 try: out=await getattr(server,name)(**kw)
 except Exception as e:out=type(e).__name__+': '+str(e)
 with (ROOT/'wrapper-results.jsonl').open('a') as f:f.write(json.dumps({'tool':name,'args':kw,'output':out},ensure_ascii=False)+'\n')
 print(name,'recorded',flush=True)
 return out
async def main():
 created=json.loads((ROOT/'created.json').read_text());b=d=None
 profile=req('GET','/api/v1/users/me').json()
 try:
  r=req('POST','/api/v1/books/upload',files={'file':('audit.epub',(ROOT/'fixture.epub').read_bytes(),'application/epub+zip')});r.raise_for_status();b=r.json()['id'];created['books'].append(b)
  r=req('POST','/api/v1/devices',json={'brand':'kindle','name':'AUDIT MCP','email_address':'audit@kindle.com','conversion_profile':'tablet'});r.raise_for_status();d=r.json()['id'];created['devices'].append(d)
  (ROOT/'created.json').write_text(json.dumps(created,indent=2))
  for name in ['get_profile','get_mail_settings','list_library','list_devices','list_gateways','list_sources','list_deliveries','list_opds_tokens','diagnose']:await call(name)
  await call('get_device',device_id=d)
  await call('list_device_methods',device_id=d)
  await call('search_library_items',query='audit')
  await call('list_library_item_deliveries',item_id=b)
  await call('plan_delivery',item_id=b,device_id=d,format='mobi')
  await call('deliver_to_kindle',item_id=b,device_id=d,format='mobi',confirm=False)
  await call('deliver_to_kindle',item_id=str(uuid.UUID(int=0)),device_id=d,confirm=False)
  await call('deliver_to_kindle',item_id=b,device_id=d,kindle_email='audit-preview@kindle.com',confirm=False)
  req('GET','/api/v1/users/me')
  await call('update_profile',clear_kindle_email=True)
  await call('update_device',device_id=d,conversion_profile=None)
  req('GET',f'/api/v1/devices/{d}')
  req('PATCH',f'/api/v1/devices/{d}',json={'conversion_profile':None})
  await call('update_library_item',item_id=b,page_count=12)
  await call('update_library_item',item_id=b,page_count=None)
  req('GET',f'/api/v1/books/{b}')
  req('PATCH',f'/api/v1/books/{b}',json={'page_count':None})
  await call('deliver',item_id=b,device_id=d,confirm=False)
  await call('delete_library_item',item_id=b,confirm=False)
  await call('remove_device',device_id=d,confirm=False)
  req('PATCH',f'/api/v1/devices/{d}',json={'brand':None})
  req('GET',f'/api/v1/devices/{d}')
 finally:
  req('PATCH','/api/v1/users/me',json={'kindle_email':profile['kindle_email'],'default_format':profile['default_format']})
  if b:req('DELETE','/api/v1/books/'+b)
  if d:req('DELETE','/api/v1/devices/'+d)
asyncio.run(main())
