import base64,json,time,uuid,pathlib
import jwt,httpx,re
ROOT=pathlib.Path(__file__).resolve().parent
BASE='https://ferry-agent.aperture-agency.org'
EMAIL='ferry-agent-test.erupt070@passinbox.com'
def token():
 lines=pathlib.Path('/home/glados/deployments/ferry-agent/.env').read_text().splitlines()
 v=next(x.split('=',1)[1].strip().strip('\"\'') for x in lines if x.startswith('MCP_CORE_ASSERTION_PRIVATE_KEY_B64='))
 now=int(time.time())
 return jwt.encode(dict(iss='ferry-agent-mcp',aud='ferry-core',sub='audit',email=EMAIL,iat=now,exp=now+240,jti=str(uuid.uuid4())),base64.b64decode(v),algorithm='EdDSA')
def redact(x):
 if isinstance(x,dict): return {k:('[SECRET]' if k in ('token','pairing_token','gateway_key','url','download_url') else redact(v)) for k,v in x.items()}
 if isinstance(x,list): return [redact(v) for v in x]
 return x
def req(m,p,**kw):
 headers=kw.pop('headers',{'Authorization':'Bearer '+token()})
 r=httpx.request(m,BASE+p,headers=headers,timeout=90,follow_redirects=False,**kw)
 try: data=r.json()
 except Exception: data=r.text[:1500] if 'text' in r.headers.get('content-type','') or 'xml' in r.headers.get('content-type','') else {'bytes':len(r.content)}
 entry=dict(time=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),method=m,path=re.sub(r'^/opds/[^/?]+', '/opds/[SECRET]', p) if p.startswith('/opds/') else '/api/v1/downloads/[SECRET]' if p.startswith('/api/v1/downloads/') else p,status=r.status_code,content_type=r.headers.get('content-type'),query=kw.get('params'),request=redact(kw.get('json')),location=r.headers.get('location'),response=redact(data))
 with (ROOT/'http.jsonl').open('a') as f:f.write(json.dumps(entry,ensure_ascii=False)+'\n')
 print(m,entry['path'],r.status_code,flush=True)
 return r
if __name__=='__main__':
 r=req('GET','/api/v1/users/me');assert r.status_code==200
 assert r.json()['email']==EMAIL
 for p in ['/health','/healthz','/api/v1/books','/api/v1/devices','/api/v1/gateways','/api/v1/opds/tokens','/api/v1/sources','/api/v1/deliveries','/api/v1/mail/settings']:
  req('GET',p)
 r=req('GET','/openapi.json'); (ROOT/'openapi-live.json').write_text(r.text)
