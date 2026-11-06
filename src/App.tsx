import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, BarChart3, BookOpen, Check, CheckCircle2, ChevronRight, CircleHelp, Cloud, CloudOff, Code2, Cpu, ExternalLink, Flame, Home, Layers3, LoaderCircle, LockKeyhole, LogOut, Mail, RotateCcw, ShieldCheck, Sparkles, Target, Waves, X, Zap } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { questions, reading, topics, type TopicId } from './content';
import { advance, answer, emptyProgress, firstAttempts, localDay, newQueue, previousDay, reviewQueue, startSession, statistics, type Progress } from './domain';
import { configured, setupError, loadProgress, saveProgress, supabase, type CloudRecord } from './cloud';
import './styles.css';

type View = 'home' | 'practice' | 'review' | 'progress';
type IconType = typeof Cpu;
const topicIcons: Record<TopicId, IconType> = { sv: Code2, sva: ShieldCheck, uvm: Layers3, cdc: Waves, arch: Cpu, debug: Activity };
const nav: { id: View; label: string; icon: IconType }[] = [{ id: 'home', label: 'Overview', icon: Home }, { id: 'practice', label: 'Practice', icon: BookOpen }, { id: 'review', label: 'Review', icon: RotateCcw }, { id: 'progress', label: 'Progress', icon: BarChart3 }];
const pct = (n: number, total: number) => total ? Math.round(n / total * 100) : 0;
function Logo() { return <span className="logo"><span className="logo-symbol"><Cpu size={23} strokeWidth={1.8} /></span><span>mind<span className="logo-light">reps</span><span className="logo-dot">.</span></span></span>; }
function Circuit() { return <svg className="circuit" viewBox="0 0 360 260" aria-hidden="true"><defs><pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" fill="#d0ef89" opacity=".15" /></pattern></defs><rect width="360" height="260" fill="url(#dots)"/><g fill="none" stroke="#a7bb8e" strokeWidth="1.2" opacity=".5"><path d="M0 65h70v52h46M0 195h83v-46h33M220 117h57V66h83M220 149h80v47h60M165 0v62M188 199v61M0 228h45v-16h17v16h17v-16h17v16h20"/><path d="M135 62V47h60v15M135 199v15h30v46M220 132h140"/></g><g fill="#cceaa4"><circle cx="70" cy="65" r="3"/><circle cx="83" cy="195" r="3"/><circle cx="277" cy="66" r="3"/><circle cx="300" cy="196" r="3"/></g><rect x="116" y="62" width="104" height="137" rx="13" fill="#293526" stroke="#92a578"/><rect x="131" y="77" width="74" height="107" rx="6" fill="#202a1e" stroke="#556848"/><g stroke="#a3bc86" strokeWidth="3">{[89,106,123,140,157,174].map(y=><React.Fragment key={y}><path d={`M107 ${y}h9M220 ${y}h9`}/></React.Fragment>)}</g><text x="168" y="119" textAnchor="middle" fill="#d3efac" fontSize="23" fontFamily="monospace">RTL</text><text x="168" y="142" textAnchor="middle" fill="#8da17b" fontSize="8" fontFamily="monospace" letterSpacing="2">THINK. VERIFY.</text><path d="M146 160h10v-8h12v8h12v-8h11" fill="none" stroke="#cceaa4" strokeWidth="1.5"/><rect x="251" y="22" width="91" height="30" rx="15" fill="#d0ef89"/><path d="m263 37 4 4 7-8" fill="none" stroke="#283722" strokeWidth="1.5"/><text x="302" y="40" textAnchor="middle" fill="#283722" fontSize="9" fontFamily="monospace">PASS</text><text x="24" y="246" fill="#829575" fontSize="8" fontFamily="monospace" letterSpacing="1">01 — REASON BEYOND THE RTL</text></svg>; }

export function App() {
  const [auth, setAuth] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!configured);
  const [demo, setDemo] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authCheck, setAuthCheck] = useState(0);
  // Every account transition gets a fresh workspace, even A -> signed out -> A.
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    let receivedEvent = false;
    let userId: string | undefined;
    const accept = (session: Session | null) => {
      if (!alive) return;
      if (session?.user.id !== userId) {
        userId = session?.user.id;
        setGeneration(n => n + 1);
      }
      setAuth(session); setAuthReady(true); setAuthError('');
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedEvent = true; accept(session);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive || receivedEvent) return;
      if (error) { setAuthError(error.message); setAuthReady(true); }
      else accept(data.session);
    }).catch(e => { if (alive && !receivedEvent) { setAuthError(message(e)); setAuthReady(true); } });
    return () => { alive = false; subscription.unsubscribe(); };
  }, [authCheck]);
  if (!authReady) return <Loading label="Opening your workspace…" />;
  if (authError) return <div className="loading-page"><Logo/><div className="gate-card"><h1>Let’s reconnect.</h1><p role="alert">{authError}</p><button className="button primary" onClick={()=>{setAuthReady(false);setAuthError('');setAuthCheck(n=>n+1);}}>Retry sign-in connection</button></div></div>;
  if (!auth && !demo) return <Gate onDemo={()=>setDemo(true)} />;
  return <Workspace key={demo?'preview':`${auth!.user.id}:${generation}`} demo={demo} onExitDemo={()=>setDemo(false)} />;
}

function Workspace({demo,onExitDemo}:{demo:boolean;onExitDemo:()=>void}) {
  const [record, setRecord] = useState<CloudRecord | null>(null);
  const recordRef = useRef<CloudRecord | null>(null);
  const [view, setView] = useState<View>('home');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Progress | null>(null);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(new Date());
  const mounted = useRef(false);
  const pendingRef = useRef<Progress | null>(null);
  const keepPending = (value: Progress | null) => { pendingRef.current = value; setPending(value); };
  const load = async () => {
    if (busyRef.current || demo) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const row = await loadProgress();
      if (!mounted.current) return;
      recordRef.current = row; setRecord(row); keepPending(null);
    }
    catch (e) { if (mounted.current) setError(message(e)); }
    finally { if (mounted.current) { busyRef.current = false; setBusy(false); } }
  };
  useEffect(() => {
    mounted.current = true;
    if (demo) { const row = { revision: 0, payload: emptyProgress() }; recordRef.current = row; setRecord(row); }
    else void load();
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const refresh = () => { setNow(new Date()); if (!document.hidden && !pendingRef.current && !demo) void load(); };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh); };
  }, [demo]);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [view, record?.payload.session?.index]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (busyRef.current || pending) { event.preventDefault(); } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);

  const mutate = async (transform: (p: Progress) => Progress, retryPayload?: Progress) => {
    if (busyRef.current || (!retryPayload && pendingRef.current) || !recordRef.current) return false;
    const previous = recordRef.current;
    busyRef.current = true; setBusy(true); setError('');
    let next: Progress | undefined;
    try {
      next = retryPayload ?? { ...transform(previous.payload), lastMutation: crypto.randomUUID() };
      const row = demo ? { revision: previous.revision + 1, payload: next } : await saveProgress(previous, next);
      if (!mounted.current) return false;
      recordRef.current = row; setRecord(row); keepPending(null); return true;
    } catch (e) { if (mounted.current) { setError(message(e)); if (next) keepPending(next); } return false; }
    finally { if (mounted.current) { busyRef.current = false; setBusy(false); } }
  };
  const logout = async () => {
    if (busy || pending) return;
    if (demo) { onExitDemo(); return; }
    try { const result = await supabase?.auth.signOut(); if (result?.error) throw result.error; }
    catch (e) { if (mounted.current) setError(message(e)); }
  };
  const start = async (mode: 'new' | 'review', topic: TopicId | 'all' = 'all') => {
    if (recordRef.current?.payload.session) { setNotice('Your saved session is still in progress. Finish it or end it before starting another.'); setView('practice'); return; }
    if (await mutate(p => startSession(p, mode, topic))) { setNotice(''); setView('practice'); }
  };
  const go = (next: View) => { setNotice(''); setView(next); };
  if (!record) return <div className="loading-page"><Logo />{busy ? <Loading label="Loading your cloud progress…" /> : <div className="gate-card"><CloudOff size={32}/><h1>Let’s reconnect.</h1><p>{error || 'Your saved progress has not loaded yet.'}</p><button className="button primary" onClick={()=>void load()}>Retry connection <RotateCcw size={17}/></button><button className="button quiet" onClick={()=>void logout()}>Sign out</button></div>}</div>;
  const p = record.payload;
  const stats = statistics(p, now);
  const session = p.session;
  const navToPractice = () => { if (session) go('practice'); else void start('new'); };
  const disabled = busy || Boolean(pending);
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar"><a className="brand-link" href="#" onClick={e=>{e.preventDefault();go('home');}} aria-label="MindReps overview"><Logo /></a><div className="sidebar-label">YOUR WORKSPACE</div><nav aria-label="Main navigation">{nav.map(item=><button key={item.id} aria-current={view===item.id?'page':undefined} className={`nav-item ${view===item.id?'active':''}`} onClick={()=>go(item.id)}><item.icon size={19}/><span>{item.label}</span>{item.id==='review' && stats.reviewCount>0 && <span className="nav-badge">{stats.reviewCount}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="side-note"><Sparkles size={19}/><p>One good question.<br/><strong>A sharper engineer.</strong></p><span>BUILT THROUGH PRACTICE</span></div><button aria-label={demo?'Exit preview':'Sign out'} className="profile" onClick={()=>void logout()} disabled={disabled}><span className="avatar">Y</span><span><strong>Your workspace</strong><small>{demo?'Preview mode':'Personal learning lab'}</small></span><LogOut size={16}/></button></div></aside>
    <div className="main-shell"><header className="topbar"><div className="mobile-logo"><Logo /></div><span className="breadcrumb">Workspace <ChevronRight size={13}/><strong>{nav.find(n=>n.id===view)?.label}</strong></span><div className="topbar-right"><span className={`cloud-status ${demo?'muted':''}`}><span className={`status-dot ${busy?'pulsing':''}`}/>{demo?'Preview · not saved':busy?'Saving…':pending?'Save needs attention':error?'Connection needs attention':'Cloud connected'}</span><span className="top-streak"><Flame size={17}/>{stats.streak}<span>day streak</span></span><span className="avatar desktop-avatar">Y</span><button className="mobile-signout" aria-label={demo?'Exit preview':'Sign out'} disabled={disabled} onClick={()=>void logout()}><LogOut size={19}/></button></div></header>
    <main id="main-content" tabIndex={-1}><div className="content-wrap">
      {demo && <div className="preview-banner"><CircleHelp size={17}/><span>Interactive preview. Progress resets when you leave. Connect Supabase for real practice.</span><button onClick={()=>void logout()}>Setup <ArrowRight size={14}/></button></div>}
      {error && <div className="error-banner" role="alert"><CloudOff size={20}/><div><strong>{pending?'Your change has not been confirmed.':'Connection needs attention.'}</strong><p>{error}</p><div className="inline-actions">{pending && <button onClick={()=>void mutate(p=>p,pending)} disabled={busy}>Retry save</button>}<button disabled={busy} onClick={()=>void load()}>Reload cloud progress</button></div></div></div>}
      {notice && <div className="notice" role="status">{notice}<button aria-label="Dismiss notice" onClick={()=>setNotice('')}><X size={16}/></button></div>}
      {view==='home' && <>
        <div className="page-heading"><div><div className="eyebrow">SMALL SESSIONS. DEEPER UNDERSTANDING.</div><h1>Welcome to your next level<span className="green-dot">.</span></h1><p>A little deliberate practice. A lot more confidence.</p></div><span className="date-label">{now.toLocaleDateString('en-US',{month:'short',day:'numeric',weekday:'short'})}</span></div>
        <div className="overview-grid"><section className="hero"><div className="hero-copy"><span className="hero-tag"><span/> YOUR DAILY DESIGN CHALLENGE</span><h2>Think like<br/>the <em>hardware.</em></h2><p>Go beyond the right answer.<br/>Understand why the design works.</p><button className="button lime" disabled={disabled || (!session && !newQueue(p).length)} onClick={navToPractice}>{session?'Continue practice':'Start a session'}<ArrowRight size={18}/></button><span className="hero-foot">{session?`${session.index + 1} of ${session.queue.length} · pick up where you left off`:`${Math.min(p.goal,newQueue(p).length)} questions · your pace, your progress`}</span></div><Circuit /></section>
        <section className="daily-card card"><div className="card-top"><span className="eyebrow">TODAY’S TARGET</span><Target size={18}/></div><div className="goal-ring" style={{'--progress':`${Math.min(stats.todayCount/p.goal,1)*100}%`} as React.CSSProperties}><div><strong>{Math.min(stats.todayCount,p.goal)}<span>/{p.goal}</span></strong><small>questions</small></div></div><h3>{stats.todayCount>=p.goal?'Goal complete. Well earned.':'Make room for a little growth.'}</h3><p>{stats.todayCount>=p.goal?'Your daily practice is in the books.':`${Math.max(p.goal-stats.todayCount,0)} more to reach your daily goal.`}</p><div className="daily-footer"><Flame size={17}/><strong>{stats.streak}-day streak</strong><span>Keep showing up.</span></div></section></div>
        <div className="stats-grid"><Stat icon={Zap} label="Total XP" value={stats.xp.toLocaleString()} note="Every insight adds up" color="sage"/><Stat icon={Target} label="First-try accuracy" value={stats.accuracy===null?'—':`${stats.accuracy}%`} note={stats.completed?'Based on new questions':'Your baseline starts here'} color="lavender"/><Stat icon={CheckCircle2} label="Questions explored" value={`${stats.completed}`} suffix={`/ ${questions.length}`} note="Build depth, one at a time" color="sand"/></div>
        <div className="section-heading"><div><span className="eyebrow">YOUR LEARNING PATH</span><h2>Build your verification instincts</h2></div><span className="section-meta">6 topics · {questions.length} challenges</span></div><div className="topic-grid">{topics.map((t,i)=><TopicCard key={t.id} topic={t} index={i} p={p} disabled={disabled} onClick={()=>void start('new',t.id)}/>)}</div>
        <div className="bottom-note"><ShieldCheck size={17}/><span>Learn the reasoning. Not just the answer.</span><span>Designed for depth.</span></div>
      </>}
      {view==='practice' && <Practice p={p} disabled={disabled} onStart={()=>void start('new')} onSelect={selected=>void mutate(p=>p.session?{...p,session:{...p.session,selected}}:p)} onSubmit={()=>void mutate(p=>answer(p))} onNext={()=>void mutate(advance)} onEnd={()=>void mutate(p=>({...p,session:null}))} onReview={()=>go('review')}/>}
      {view==='review' && <><PageTitle eyebrow="TURN MISTAKES INTO UNDERSTANDING" title="A second look. A stronger grasp." description="Revisit questions you missed. A correct review clears the item from this queue."/><div className="review-intro card"><span className="icon-box lavender"><RotateCcw size={25}/></span><div><h2>{stats.reviewCount?`${stats.reviewCount} insights waiting for you`:'A clean slate.'}</h2><p>{stats.reviewCount?'Your latest answer on these questions needs another look.':'Missed questions will appear here after you practice.'}</p></div><button className="button primary" disabled={disabled||!stats.reviewCount} onClick={()=>void start('review')}>Start review <ArrowRight size={17}/></button></div><div className="review-list">{reviewQueue(p).map(id=>{const q=questions.find(q=>q.id===id)!;const t=topics.find(t=>t.id===q.topic)!;const last=p.attempts.filter(a=>a.questionId===id).at(-1)!;return <div className="review-row card" key={id}><span className={`icon-box ${t.color}`}><BookOpen size={20}/></span><div><span className="eyebrow">{t.short} · {q.level}</span><h3>{q.title}</h3><small>Last practiced {new Date(last.at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</small></div><span className="review-pill">Needs review</span></div>;})}</div></>}
      {view==='progress' && <ProgressPage p={p} now={now} disabled={disabled} demo={demo} onGoal={goal=>void mutate(p=>({...p,goal}))}/>}
    </div><footer className="main-footer"><span>MindReps <span> / </span> Your personal verification lab</span><span>Stay curious. Keep building.</span></footer></main></div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{nav.map(item=><button key={item.id} aria-current={view===item.id?'page':undefined} className={view===item.id?'active':''} onClick={()=>go(item.id)}><item.icon size={21}/><span>{item.label}</span>{item.id==='review'&&stats.reviewCount>0&&<i/>}</button>)}</nav>
    <div className="sr-only" role="status" aria-live="polite">{busy?'Saving change':pending?'Save failed':demo?'Preview mode':error?'Connection needs attention':'Progress connected to cloud'}</div>
  </div>;
}
function message(e: unknown) { return e instanceof Error ? e.message : 'Something went wrong. Please try again.'; }
function Loading({label}:{label:string}) { return <div className="loading"><LoaderCircle className="spin" size={25}/><p>{label}</p></div>; }
function PageTitle({eyebrow,title,description}:{eyebrow:string;title:string;description:string}) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div>; }
function Stat({icon:Icon,label,value,suffix,note,color}:{icon:IconType;label:string;value:string;suffix?:string;note:string;color:string}) { return <section className="stat card"><span className={`icon-box ${color}`}><Icon size={20}/></span><div><span className="stat-label">{label}</span><div className="stat-value">{value}<small>{suffix}</small></div><p>{note}</p></div></section>; }
function TopicCard({topic:t,index,p,disabled,onClick}:{topic:typeof topics[number];index:number;p:Progress;disabled:boolean;onClick:()=>void}) {
  const Icon = topicIcons[t.id]; const done = firstAttempts(p).filter(a=>questions.find(q=>q.id===a.questionId)?.topic===t.id).length;
  const total = questions.filter(q=>q.topic===t.id).length;
  return <button className="topic-card card" disabled={disabled||done===total} onClick={onClick}><div className="topic-top"><span className={`icon-box ${t.color}`}><Icon size={22}/></span><span className="topic-number">0{index+1}</span></div><h3>{t.name}</h3><p>{t.description}</p><div className="topic-bottom"><span>{done===total?'All explored':`${done} of ${total} explored`}</span><ArrowRight size={17}/></div><div className="thin-progress"><span style={{width:`${pct(done,total)}%`}}/></div></button>;
}

function Practice({p,disabled,onStart,onSelect,onSubmit,onNext,onEnd,onReview}:{p:Progress;disabled:boolean;onStart:()=>void;onSelect:(n:number[])=>void;onSubmit:()=>void;onNext:()=>void;onEnd:()=>void;onReview:()=>void}) {
  const [finished, setFinished] = useState<{correct:number;count:number;xp:number}|null>(null);
  const s=p.session;
  const previousSession=useRef(s);
  useEffect(()=>{ if(previousSession.current && !s && previousSession.current.answered && previousSession.current.index===previousSession.current.queue.length-1){const ids=new Set(previousSession.current.queue);const attempts=p.attempts.filter(a=>ids.has(a.questionId)).slice(-previousSession.current.queue.length);setFinished({correct:attempts.filter(a=>a.correct).length,count:attempts.length,xp:attempts.reduce((n,a)=>n+a.xp,0)});} if(s)setFinished(null);previousSession.current=s; },[s]);
  if (!s) return <><PageTitle eyebrow="DELIBERATE PRACTICE" title={finished?'That’s a session well spent.':'Make your next rep count.'} description={finished?'A little more understanding than when you started.':'Curated questions. Clear explanations. No countdown.'}/><div className="empty-practice card"><span className="large-icon"><CheckCircle2 size={35}/></span><h2>{finished?`${finished.correct} of ${finished.count} answered correctly`:'Ready to think it through?'}</h2><p>{finished?`You earned ${finished.xp} XP. Revisit any missed questions in Review.`:newQueue(p).length?`Your next session has up to ${p.goal} unseen questions, mixed across the learning path.`:'You have explored every question in this bank. Review missed questions, or add a new question pack in GitHub.'}</p><div className="inline-actions"><button className="button primary" onClick={onStart} disabled={disabled||!newQueue(p).length}>Start new practice <ArrowRight size={17}/></button><button className="button secondary" onClick={onReview}>Go to review <RotateCcw size={17}/></button></div></div></>;
  const q=questions.find(q=>q.id===s.queue[s.index]);
  if(!q)return <div className="card empty-practice"><h2>This question has been retired.</h2><p>Your previous answers are preserved. End this session to continue with the current bank.</p><button className="button primary" onClick={onEnd} disabled={disabled}>End session</button></div>;
  const topic=topics.find(t=>t.id===q.topic)!;
  const attempt=p.attempts.find(a=>a.id===s.attemptId);
  const multi=q.correct.length>1;
  return <div className="practice-wrap"><div className="practice-heading"><button className="text-button" onClick={onEnd} disabled={disabled}><ArrowLeft size={16}/> End session</button><span>{s.mode==='review'?'Review session':s.topic==='all'?'Mixed practice':`${topics.find(t=>t.id===s.topic)?.short ?? 'Topic'} practice`} <span className="separator">/</span> {s.index+1} of {s.queue.length}</span></div><div className="session-track" aria-label={`Question ${s.index+1} of ${s.queue.length}`}>{s.queue.map((id,i)=><span key={id} className={i<s.index?'done':i===s.index?'current':''}/>)}</div><div className="question-meta"><span className={`topic-chip ${topic.color}`}>{topic.short}</span><span>{q.level}</span><span>{multi?'Select all that apply':'Select one answer'}</span></div><div className="question-header"><span className="eyebrow">CHALLENGE {q.id.toUpperCase()}</span><h1>{q.title}</h1><p>{q.prompt}</p></div>{q.code&&<div className="code-card"><div><span><span className="code-dot"/> SystemVerilog</span><span>RTL / TRACE</span></div><pre><code>{q.code}</code></pre></div>}
    <div className="answer-options" role="group" aria-label={multi?'Select all correct answers':'Select the correct answer'}>{q.options.map((option,i)=>{const selected=s.selected.includes(i);const correct=q.correct.includes(i);return <button className={`answer-option ${selected?'selected':''} ${s.answered?(correct?'correct':selected?'incorrect':'faded'):''}`} key={i} disabled={disabled||s.answered} aria-pressed={selected} onClick={()=>onSelect(multi?(selected?s.selected.filter(n=>n!==i):[...s.selected,i]):[i])}><span className={`answer-letter ${multi?'square':''}`}>{s.answered&&correct?<Check size={16}/>:s.answered&&selected?<X size={16}/>:String.fromCharCode(65+i)}</span><span>{option.text}</span>{selected&&!s.answered&&<Check size={18} className="selected-check"/>}</button>;})}</div>
    {!s.answered?<div className="question-action"><span><LockKeyhole size={14}/> Take your time. Reason it out.</span><button className="button primary" disabled={disabled||!s.selected.length} onClick={onSubmit}>Check answer <ArrowRight size={17}/></button></div>:<section className={`explanation ${attempt?.correct?'is-correct':'is-wrong'}`} aria-label="Answer explanation"><div className="explanation-title"><span className="icon-box">{attempt?.correct?<CheckCircle2 size={24}/>:<Sparkles size={24}/>}</span><div><h2>{attempt?.correct?'Exactly. Here’s the reasoning.':'A useful mistake. Let’s unpack it.'}</h2><span>+{attempt?.xp??0} XP · {attempt?.correct?'Understanding, reinforced.':'Learning still counts.'}</span></div></div><p className="lesson">{q.lesson}</p><div className="option-explanations">{q.options.map((o,i)=><div key={i}><span className={q.correct.includes(i)?'reason-correct':''}>{String.fromCharCode(65+i)} {q.correct.includes(i)?'· Correct':''}</span><p>{o.why}</p></div>)}</div><div className="explanation-footer"><span><Cloud size={14}/> {configured?'Answer saved to cloud':'Preview · not saved'}</span><button className="button primary" onClick={onNext} disabled={disabled}>{s.index+1===s.queue.length?'Finish session':'Next question'}<ArrowRight size={17}/></button></div></section>}
  </div>;
}

function ProgressPage({p,now,disabled,demo,onGoal}:{p:Progress;now:Date;disabled:boolean;demo:boolean;onGoal:(n:number)=>void}) {
  const stats=statistics(p,now); const first=firstAttempts(p);
  const days:string[]=[]; let cursor=localDay(now);for(let i=0;i<14;i++){days.unshift(cursor);cursor=previousDay(cursor);}
  const download=()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),progress:p},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`mindreps-progress-${localDay(now)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <><PageTitle eyebrow="EVIDENCE OF YOUR EFFORT" title="A clearer picture of your progress." description="First attempts measure your baseline. Reviews build on what you’ve learned."/><div className="stats-grid"><Stat icon={Zap} label="Total XP" value={String(stats.xp)} note="20 XP correct · 5 XP for trying" color="sage"/><Stat icon={Target} label="First-try accuracy" value={stats.accuracy===null?'—':`${stats.accuracy}%`} note={`${first.filter(a=>a.correct).length} correct of ${first.length} first attempts`} color="lavender"/><Stat icon={Flame} label="Current streak" value={String(stats.streak)} suffix=" days" note="One answered question keeps it going" color="sand"/></div><div className="progress-grid"><section className="card panel"><div className="section-heading compact"><div><span className="eyebrow">CONSISTENCY OVER INTENSITY</span><h2>The last two weeks</h2></div><Activity size={20}/></div><div className="activity-chart">{days.map(day=>{const count=new Set(p.attempts.filter(a=>a.day===day).map(a=>a.questionId)).size;return <div key={day} className="activity-column"><div className="activity-bar-wrap"><div className={`activity-bar ${count?'has-activity':''}`} style={{height:`${count?Math.max(8,Math.min(count/p.goal*100,100)):4}%`}} title={`${day}: ${count} questions`} aria-label={`${day}: ${count} questions`}/></div><span>{Number(day.slice(-2))}</span></div>;})}</div><div className="chart-caption"><span>{new Date(days[0]+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span><span>Unique questions / day · bar height capped at daily goal</span><span>Today</span></div></section><section className="card panel goal-settings"><span className="eyebrow">A PACE YOU CAN KEEP</span><h2>Your daily goal</h2><p>Choose a small commitment. Build from there.</p><div className="goal-choices">{[5,10,15].map(goal=><button key={goal} className={p.goal===goal?'chosen':''} disabled={disabled} aria-pressed={p.goal===goal} onClick={()=>onGoal(goal)}><strong>{goal}</strong><span>questions</span></button>)}</div><small>Goal changes apply to new sessions. Repeat answers to the same question count once per day.</small></section></div><section className="card panel topic-performance"><div className="section-heading compact"><div><span className="eyebrow">KNOW WHERE TO FOCUS</span><h2>Understanding by topic</h2></div><span className="section-meta">First attempts only</span></div>{topics.map(t=>{const attempts=first.filter(a=>questions.find(q=>q.id===a.questionId)?.topic===t.id);const correct=attempts.filter(a=>a.correct).length;const value=pct(correct,attempts.length);const Icon=topicIcons[t.id];return <div className="performance-row" key={t.id}><span className={`icon-box ${t.color}`}><Icon size={19}/></span><div><strong>{t.name}</strong><small>{attempts.length?`${correct} correct · ${attempts.length} explored`:'Not explored yet'}</small></div><div className="performance-track"><span style={{width:`${value}%`}}/></div><strong className="performance-percent">{attempts.length?`${value}%`:'—'}</strong></div>;})}</section><div className="progress-grid"><section className="card panel"><span className="eyebrow">YOUR DATA, AT A GLANCE</span><h2>Saved along the way.</h2><p>{demo?'This preview does not save data.':'Answers, your session, and your daily goal are stored in your Supabase database. Resume on another device with the same account.'}</p><p className="small-copy">XP: 20 for a correct first answer, 5 for an incorrect first answer, and a one-time 10 XP when a missed question is first answered correctly. Streak days use your device’s local date.</p><button className="button secondary" onClick={download}><ArrowDownToLine size={16}/> Export progress</button></section><section className="card panel"><span className="eyebrow">KEEP DIGGING</span><h2>From the source</h2><p>Original practice questions. Authoritative references for going deeper.</p><div className="reading-list">{reading.map(r=><a href={r.url} target="_blank" rel="noreferrer" key={r.url}><span><strong>{r.name}</strong><small>{r.note}</small></span><ExternalLink size={15}/></a>)}</div></section></div></>;
}

function Gate({onDemo}:{onDemo:()=>void}) {
  const [email,setEmail]=useState('');
  const [code,setCode]=useState('');
  const [sent,setSent]=useState(false);
  const [useCode,setUseCode]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [retryAt,setRetryAt]=useState(0);
  const send=async(e:React.SyntheticEvent)=>{
    e.preventDefault();if(!supabase||busy)return;
    setBusy(true);setError('');
    try {
      const {error}=await supabase.auth.signInWithOtp({
        email:email.trim(),
        options:{shouldCreateUser:false,emailRedirectTo:window.location.origin+window.location.pathname},
      });
      if(error)throw error;
      setSent(true);setUseCode(false);setCode('');setRetryAt(Date.now()+60000);
    }catch(e){setError(message(e));}finally{setBusy(false);}
  };
  const verify=async(e:React.FormEvent)=>{
    e.preventDefault();if(!supabase||busy)return;
    setBusy(true);setError('');
    try {
      const {error}=await supabase.auth.verifyOtp({email:email.trim(),token:code.trim(),type:'email'});
      if(error)throw error;
    }catch(e){setError(message(e));}finally{setBusy(false);}
  };
  return <div className="gate-shell">
    <section className="gate-story"><Logo/><div><span className="hero-tag"><span/> YOUR PERSONAL VERIFICATION LAB</span><h1>Better instincts.<br/>One rep<br/>at a <em>time.</em></h1><p>Challenging questions for the engineer<br/>who wants to understand the why.</p><Circuit/></div><span className="gate-story-footer">RTL · VERIFICATION · MICROARCHITECTURE</span></section>
    <section className="gate-main"><div className="gate-mobile-logo"><Logo/></div><div className="gate-card">
      <span className="icon-box sage"><LockKeyhole size={23}/></span><div className="eyebrow">A WORKSPACE OF YOUR OWN</div>
      <h1>{configured?(sent?'Check your inbox.':'Welcome to MindReps.'):'Your learning lab is ready.'}</h1>
      <p>{configured?(sent?(useCode?'Enter the code included in your sign-in email.':'Open the sign-in link in your email to return to MindReps. Only the authorized owner can access saved progress.'):'Sign in through email to pick up where you left off.'):'The interface and question bank are ready. Connect your Supabase project to turn on private sign-in and cloud progress.'}</p>
      {configured?<form onSubmit={sent?verify:send}>
        {!sent?<><label htmlFor="email">Your email</label><div className="input-wrap"><Mail size={18}/><input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com" disabled={busy}/></div></>:<>
          {useCode&&<><label htmlFor="otp">Email code</label><input className="otp-input" id="otp" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} minLength={6} maxLength={10} required placeholder="Enter your code" disabled={busy}/></>}
          <p className="small-copy">Sent to {email.trim()}. Check your spam folder if it does not arrive.</p>
        </>}
        {error&&<p className="form-error" role="alert">{error}</p>}
        {(!sent||useCode)&&<button className="button primary full" disabled={busy}>{busy?<LoaderCircle className="spin" size={18}/>:<>{sent?'Open my workspace':'Send sign-in email'}<ArrowRight size={18}/></>}</button>}
        {sent&&<>
          {!useCode&&<button className="button secondary full" type="button" disabled={busy} onClick={()=>setUseCode(true)}>My email includes a code</button>}
          <div className="gate-form-links">
            <button type="button" onClick={()=>{setSent(false);setUseCode(false);setCode('');setError('');}} disabled={busy}>Change email</button>
            <button type="button" onClick={e=>{if(Date.now()<retryAt){setError('Please wait one minute before requesting another email.');return;}void send(e);}} disabled={busy}>Resend email</button>
          </div>
        </>}
      </form>:<>
        {setupError&&<p className="form-error" role="status">{setupError}</p>}
        <ol className="setup-steps"><li><span>01</span><div><strong>Create a free Supabase project</strong><small>Run supabase/schema.sql in its SQL editor.</small></div></li><li><span>02</span><div><strong>Authorize your account</strong><small>Add your user and enable email sign-in.</small></div></li><li><span>03</span><div><strong>Connect and deploy</strong><small>Follow SETUP.md for keys and GitHub Pages.</small></div></li></ol>
        <button className="button primary full" onClick={onDemo}>Explore the interactive preview <ArrowRight size={18}/></button><p className="preview-disclaimer">Preview answers stay in memory and are not saved.</p>
      </>}
      <div className="gate-privacy"><ShieldCheck size={15}/><span>{configured?'No public signup. Your progress stays yours.':'One learner. No distractions. Built for depth.'}</span></div>
    </div></section>
  </div>;
}
