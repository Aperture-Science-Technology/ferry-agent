"""Remove only the empty Source created by this audit, after ownership checks."""
import asyncio,uuid,json
from sqlalchemy import select,func
from ferry_agent.db import async_session_factory
from ferry_agent.models import Source,User,LibraryItem,Gateway
async def main():
 async with async_session_factory() as db:
  user=(await db.execute(select(User).where(User.email=='ferry-agent-test.erupt070@passinbox.com'))).scalar_one()
  assert str(user.id)=='48c90f27-b635-42b0-9b89-73b21d345088'
  source=(await db.execute(select(Source).where(Source.id==uuid.UUID('aeac9e9a-f285-4af8-a513-98fe49c2f8de'),Source.user_id==user.id))).scalar_one_or_none()
  if source is None:print('Source audit déjà absente');return
  assert source.type.value=='torrent_gateway'
  assert source.created_at.isoformat().startswith('2026-10-03T11:26:12')
  assert (await db.execute(select(func.count()).select_from(LibraryItem).where(LibraryItem.source_id==source.id))).scalar_one()==0
  assert (await db.execute(select(func.count()).select_from(Gateway).where(Gateway.user_id==user.id))).scalar_one()==0
  await db.delete(source);await db.commit()
  print(json.dumps({'deleted_source':str(source.id),'owner':str(user.id),'references':0}))
asyncio.run(main())
