// Native Web APIs only; secrets stay in Supabase's server environment.
const SITE = 'https://leodewang.github.io';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function handler(req: Request): Promise<Response> {
  const headers = {'Access-Control-Allow-Origin':SITE,'Access-Control-Allow-Headers':'content-type, x-group-key','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'};
  const reply = (body: unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if (req.headers.has('origin') && req.headers.get('origin')!==SITE) return reply({error:'Origin not allowed'},403);
  if (req.method==='OPTIONS') return new Response(null,{status:204,headers});
  if (req.method!=='POST') return reply({error:'Method not allowed'},405);
  const key=req.headers.get('x-group-key')||'';
  if(!/^[0-9a-f]{64}$/.test(key)) return reply({error:'Enter a valid group code'},401);
  if(!req.headers.get('content-type')?.startsWith('application/json')) return reply({error:'JSON required'},415);
  try {
    // Stream with a hard limit, even if Content-Length is absent or dishonest.
    const reader=req.body?.getReader(); if(!reader) return reply({error:'Body required'},400);
    let size=0; const chunks: Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return reply({error:'Request too large'},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
    const body=JSON.parse(new TextDecoder().decode(bytes));
    if(!body || !UUID.test(body.group||'') || !['read','record','void','rotate'].includes(body.action)) return reply({error:'Invalid request'},400);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
    const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const res=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/whopays_api',{
      method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},
      body:JSON.stringify({p_group:body.group,p_hash:hash,p_action:body.action,p_data:body.data||{}}),signal:AbortSignal.timeout(10000)
    });
    const data=await res.json();
    if(!res.ok){const message=data.message||'';if(message==='Access denied')return reply({error:'Group code is invalid or has been revoked'},403);
      const allowed=['Owner access required','Round already saved with different details','Round was voided','Round not found','Use distinct player names','Names must be 1–40 characters','Invalid amount','Invalid outcome','Invalid poker outcome','Dinner games need exactly one loser','Need 2–8 players'];
      return reply({error:allowed.includes(message)?message:'Could not process this request'},400);
    }
    return reply(data,data.status||200);
  } catch {return reply({error:'Could not reach the leaderboard. Please retry.'},503);}
}
Deno.serve(handler);
