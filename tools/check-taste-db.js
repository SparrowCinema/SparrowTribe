// Real PostgreSQL execution in PGlite. Install tools/taste-tests dependencies,
// or set SPARROW_PGLITE to an existing trusted PGlite module path.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.SPARROW_PGLITE||'./taste-tests/node_modules/@electric-sql/pglite');
(async()=>{const db=new PGlite();await db.exec("create role anon; create role authenticated; create table public.test_profiles(code text primary key,data jsonb); create function public.mg_pull(code text) returns jsonb language sql as $$select jsonb_build_object('data',p.data,'rev',1) from public.test_profiles p where p.code=$1$$;");
const sql=fs.readFileSync(path.join(__dirname,'../backend/taste-v1.sql'),'utf8');await db.exec(sql);await db.exec(sql);await db.exec("insert into sparrow_taste.films values('test-film'),('second-film');");
const code=i=>'SP-'+(String.fromCharCode(65+i).repeat(4)+'-').repeat(5)+String.fromCharCode(65+i).repeat(4);
for(let i=0;i<4;i++)await db.query('insert into public.test_profiles values($1,$2)',[code(i),JSON.stringify({watched:{'test-film':{d:'2026-11-08'}}})]);
const vote=async(i,fun,bore,rev)=>{const r=await db.query('select public.st_taste_vote($1,$2,$3,$4,$5) x',[code(i),'test-film',fun,bore,rev]);return r.rows[0].x;};
const read=async()=>{const r=await db.query("select public.st_taste_read(array['test-film']) x");return r.rows[0].x.films[0];};
await vote(0,0,5,1);await vote(1,4,null,1);let a=await read();assert.equal(a.funN,2);assert.equal(a.funAvg,null);assert.equal(a.boreN,1);assert.equal(a.pairN,1);
await vote(2,5,1,1);a=await read();assert.equal(a.funAvg,3);assert.equal(a.boreAvg,null);assert.equal(a.pairFun,null);
await vote(3,3,3,1);a=await read();assert.equal(a.pairN,3);assert.equal(a.pairFun,2.67);assert.equal(a.pairBore,3);
assert((await vote(0,0,5,1)).ok);assert.equal((await read()).funN,4);await vote(0,5,0,2);assert.equal((await read()).funN,4);assert.equal((await vote(0,1,1,1)).reason,'stale');
await vote(0,null,null,3);a=await read();assert.equal(a.funN,3);assert.equal(a.pairN,2);assert.equal(a.pairFun,null);
await assert.rejects(()=>vote(0,6,0,4));await assert.rejects(()=>vote(0,-1,0,4));
await db.exec('set role anon;');await assert.rejects(()=>db.query('select * from sparrow_taste.ballots'));await assert.rejects(()=>db.query("insert into sparrow_taste.ballots values('x','test-film',5,0,1,now())"));a=await read();assert.equal(a.funN,3);assert(!JSON.stringify(a).includes('voter'));await db.exec('reset role;');
// Whole-catalogue reads list only rated films; unrated films are omitted (= zero).
{const all=(await db.query('select public.st_taste_read() x')).rows[0].x;assert(all.films.some(f=>f.id==='test-film'));assert(!all.films.some(f=>f.id==='second-film'));}
// New catalogue films self-register on the first watched-gated vote; unwatched ones stay out.
await db.query('update public.test_profiles set data=jsonb_set(data::jsonb,\'{watched,new-film}\',\'{"d":"2026-11-09"}\')::jsonb where code=$1',[code(2)]);
{const ok=(await db.query("select public.st_taste_vote($1,'new-film',4,null,1) x",[code(2)])).rows[0].x;assert.equal(ok.ok,true);assert.equal(ok.summary.funN,1);
 await assert.rejects(()=>db.query("select public.st_taste_vote($1,'never-watched',4,null,1) x",[code(3)]));
 assert.equal((await db.query("select count(*)::int n from sparrow_taste.films where id='never-watched'")).rows[0].n,0);
 assert.equal((await db.query("select public.st_taste_vote($1,'never-watched',null,null,1) x",[code(3)])).rows[0].x.ok,true);}
for(let n=4;n<30;n++){const r=await vote(1,n%6,1,n);if(r.reason==='rate_limited')break;}assert.equal((await vote(1,1,1,100)).reason,'rate_limited');
await db.close();console.log('PASS: PostgreSQL migration/idempotency, zero/partial samples, independent means, paired averages, replacement/withdrawal, replay/stale requests, ACLs and rate limits.');})().catch(e=>{console.error(e.message,e.where||'',e.position,e.internalPosition,(e.query||e.internalQuery||'').slice(Math.max(0,Number(e.position||e.internalPosition)-150),Number(e.position||e.internalPosition)+150));process.exit(1);});
