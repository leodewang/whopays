"""Live API integration test. Requires an isolated disposable group's key JSON path.
Never point this at a real dinner group. No credentials are stored in this file.
"""
import json,sys,uuid,urllib.request,urllib.error,concurrent.futures,hashlib,secrets
keys=json.load(open(sys.argv[1]));url='https://jwceragcqobmveqsplbf.supabase.co/functions/v1/leaderboard'
def call(action='read',data=None,key=None,origin=None,group=None):
 headers={'Content-Type':'application/json','X-Group-Key':keys['member'] if key is None else key}
 if origin:headers['Origin']=origin
 req=urllib.request.Request(url,data=json.dumps({'group':group or keys['group'],'action':action,'data':data or {}}).encode(),headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=25) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def check(name,condition):
 assert condition,name
 print('PASS',name)
def record():return {'id':str(uuid.uuid4()),'dinner_id':dinner,'game':'Card Draw','entries':[{'name':' Leo ','outcome':'loss','cents':2450},{'name':'Sam','outcome':'win','cents':0}]}
dinner=str(uuid.uuid4())
check('missing key denied',call(key='')[0]==401)
check('wrong key denied',call(key='a'*64)[0]==403)
check('cross-group access denied',call(group=str(uuid.uuid4()))[0]==403)
check('unapproved browser origin denied',call(origin='https://example.com')[0]==403)
status,b=call(origin='https://leodewang.github.io');check('authorized empty board',status==200 and b['board']==[])
r=record()
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:responses=list(pool.map(lambda _:call('record',r),range(4)))
check('concurrent retries accepted',all(s==200 for s,_ in responses))
s,b=call();check('retries counted once with normalized name',len(b['recent'])==1 and b['board'][0]['key']=='leo' and b['board'][0]['cents']==2450 and b['board'][0]['losses']==1)
r['entries'][0]['cents']=999;check('conflicting retry rejected',call('record',r)[0]==400)
x=record();x['entries'][0]['cents']=-1;check('negative money rejected',call('record',x)[0]==400)
x=record();x['entries'][0]['cents']=1.5;check('fractional cents rejected',call('record',x)[0]==400)
x=record();x['entries'][1]['name']='LEO';check('case-insensitive duplicate names rejected',call('record',x)[0]==400)
check('member cannot void',call('void',{'id':r['id']})[0]==400)
x=record();x['replaces']=r['id'];check('member cannot correct',call('record',x)[0]==400)
x['entries'][0]['cents']=1200;check('owner correction succeeds',call('record',x,key=keys['owner'])[0]==200)
s,b=call();check('correction counted once, original retained voided',b['board'][0]['cents']==1200 and b['board'][0]['losses']==1 and len(b['recent'])==2 and sum(bool(t['voided_at']) for t in b['recent'])==1)
check('correction retry safe',call('record',x,key=keys['owner'])[0]==200)
p=record();p['game']='PLO Showdown';p['entries'][0]['cents']=0;check('poker save',call('record',p)[0]==200)
check('poker separate from dinner',call(data={'mode':'plo'})[1]['board'][0]['losses']==1 and call()[1]['board'][0]['losses']==1)
check('other dinner empty',call(data={'dinner_id':str(uuid.uuid4())})[1]['board']==[])
check('owner can void',call('void',{'id':x['id']},key=keys['owner'])[0]==200)
check('void removes scores',call()[1]['board']==[])
newkey=secrets.token_hex(32);h=hashlib.sha256(newkey.encode()).hexdigest()
check('member cannot rotate',call('rotate',{'member_hash':h})[0]==400)
check('owner can rotate',call('rotate',{'member_hash':h},key=keys['owner'])[0]==200)
check('revoked member key denied',call()[0]==403)
check('new member key accepted',call(key=newkey)[0]==200)
