import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudOff,
  Code2,
  Compass,
  Cpu,
  ExternalLink,
  Flame,
  Home,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Waves,
  X,
  Zap,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { topics, type TopicId } from './content';
import { learningModules } from './learningModules';
import {
  emptyProgress,
  rateAndCompleteModule,
  setActiveModule,
  statistics,
  type Progress,
  type ModuleRating,
} from './domain';
import { configured, setupError, loadProgress, saveProgress, supabase, type CloudRecord } from './cloud';
import { ModulesCatalog } from './ModulesCatalog';
import { ModuleViewer } from './ModuleViewer';
import { KnowledgeMap } from './KnowledgeMap';
import { QualityInsights } from './QualityInsights';
import './styles.css';

type View = 'home' | 'modules' | 'viewer' | 'knowledge' | 'insights';
type IconType = typeof Cpu;

const nav: { id: View; label: string; icon: IconType }[] = [
  { id: 'home', label: 'Overview', icon: Home },
  { id: 'modules', label: 'Modules', icon: BookOpen },
  { id: 'viewer', label: 'Interactive Studio', icon: Cpu },
  { id: 'knowledge', label: 'Knowledge Map', icon: Compass },
  { id: 'insights', label: 'Quality Insights', icon: Sparkles },
];

function Logo() {
  return (
    <span className="logo">
      <span className="logo-symbol">
        <Cpu size={23} strokeWidth={1.8} />
      </span>
      <span>
        mind<span className="logo-light">reps</span>
        <span className="logo-dot">.</span>
      </span>
    </span>
  );
}

export function App() {
  const [auth, setAuth] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!configured);
  const [demo, setDemo] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authCheck, setAuthCheck] = useState(0);
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
      setAuth(session);
      setAuthReady(true);
      setAuthError('');
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedEvent = true;
      accept(session);
    });

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive || receivedEvent) return;
        if (error) {
          setAuthError(error.message);
          setAuthReady(true);
        } else accept(data.session);
      })
      .catch(e => {
        if (alive && !receivedEvent) {
          setAuthError(message(e));
          setAuthReady(true);
        }
      });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [authCheck]);

  if (!authReady) return <Loading label="Opening your workspace…" />;
  if (authError)
    return (
      <div className="loading-page">
        <Logo />
        <div className="gate-card">
          <h1>Let’s reconnect.</h1>
          <p role="alert">{authError}</p>
          <button
            className="button primary"
            onClick={() => {
              setAuthReady(false);
              setAuthError('');
              setAuthCheck(n => n + 1);
            }}
          >
            Retry sign-in connection
          </button>
        </div>
      </div>
    );
  if (!auth && !demo) return <Gate onDemo={() => setDemo(true)} />;
  return (
    <Workspace
      key={demo ? 'preview' : `${auth!.user.id}:${generation}`}
      demo={demo}
      onExitDemo={() => setDemo(false)}
    />
  );
}

function Workspace({
  demo,
  onExitDemo,
}: {
  demo: boolean;
  onExitDemo: () => void;
}) {
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

  const keepPending = (value: Progress | null) => {
    pendingRef.current = value;
    setPending(value);
  };

  const load = async () => {
    if (busyRef.current || demo) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const row = await loadProgress();
      if (!mounted.current) return;
      recordRef.current = row;
      setRecord(row);
      keepPending(null);
    } catch (e) {
      if (mounted.current) setError(message(e));
    } finally {
      if (mounted.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  useEffect(() => {
    mounted.current = true;
    if (demo) {
      const row = { revision: 0, payload: emptyProgress() };
      recordRef.current = row;
      setRecord(row);
    } else void load();
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      setNow(new Date());
      if (!document.hidden && !pendingRef.current && !demo) void load();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [demo]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view]);

  const mutate = async (
    transform: (p: Progress) => Progress,
    retryPayload?: Progress
  ) => {
    if (busyRef.current || (!retryPayload && pendingRef.current) || !recordRef.current)
      return false;
    const previous = recordRef.current;
    busyRef.current = true;
    setBusy(true);
    setError('');
    let next: Progress | undefined;
    try {
      next =
        retryPayload ?? {
          ...transform(previous.payload),
          lastMutation: crypto.randomUUID(),
        };
      const row = demo
        ? { revision: previous.revision + 1, payload: next }
        : await saveProgress(previous, next);
      if (!mounted.current) return false;
      recordRef.current = row;
      setRecord(row);
      keepPending(null);
      return true;
    } catch (e) {
      if (mounted.current) {
        setError(message(e));
        if (next) keepPending(next);
      }
      return false;
    } finally {
      if (mounted.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const logout = async () => {
    if (busy || pending) return;
    if (demo) {
      onExitDemo();
      return;
    }
    try {
      const result = await supabase?.auth.signOut();
      if (result?.error) throw result.error;
    } catch (e) {
      if (mounted.current) setError(message(e));
    }
  };

  const go = (next: View) => {
    setNotice('');
    setView(next);
  };

  const handleSelectModule = (moduleId: string) => {
    void mutate(p => setActiveModule(p, moduleId));
    go('viewer');
  };

  const handleRateModule = (
    moduleId: string,
    rating: {
      qualityScore: number;
      depthRating: 'too_shallow' | 'balanced' | 'advanced_thorough';
      visualRating: 'needs_diagrams' | 'helpful' | 'exceptional';
      knowsTopic: 'mastered' | 'partially' | 'not_known';
      confidence: 'high' | 'medium' | 'low';
      notes?: string;
      tags?: string[];
    }
  ) => {
    void mutate(p => rateAndCompleteModule(p, moduleId, rating, now));
  };

  if (!record)
    return (
      <div className="loading-page">
        <Logo />
        {busy ? (
          <Loading label="Loading your cloud progress…" />
        ) : (
          <div className="gate-card">
            <CloudOff size={32} />
            <h1>Let’s reconnect.</h1>
            <p>{error || 'Your saved progress has not loaded yet.'}</p>
            <button className="button primary" onClick={() => void load()}>
              Retry connection <RotateCcw size={17} />
            </button>
            <button className="button quiet" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        )}
      </div>
    );

  const p = record.payload;
  const stats = statistics(p, now);
  const disabled = busy || Boolean(pending);

  // Active module for the viewer
  const activeModule =
    learningModules.find(m => m.id === p.activeModuleId) ?? learningModules[0];

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <a
          className="brand-link"
          href="#"
          onClick={e => {
            e.preventDefault();
            go('home');
          }}
          aria-label="MindReps overview"
        >
          <Logo />
        </a>

        <div className="sidebar-label">LEARNING LAB</div>
        <nav aria-label="Main navigation">
          {nav.map(item => (
            <button
              key={item.id}
              aria-current={view === item.id ? 'page' : undefined}
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              onClick={() => go(item.id)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === 'knowledge' && stats.masteredCount > 0 && (
                <span className="nav-badge success">{stats.masteredCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="side-note">
            <Sparkles size={19} />
            <p>
              Interactive modules.
              <br />
              <strong>Deep silicon intuition.</strong>
            </p>
            <span>BUILT FOR ADVANCED DV</span>
          </div>
          <button
            aria-label={demo ? 'Exit preview' : 'Sign out'}
            className="profile"
            onClick={() => void logout()}
            disabled={disabled}
          >
            <span className="avatar">Y</span>
            <span>
              <strong>Your workspace</strong>
              <small>{demo ? 'Preview mode' : 'Personal learning lab'}</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-logo">
            <Logo />
          </div>
          <span className="breadcrumb">
            MindReps <ChevronRight size={13} />
            <strong>{nav.find(n => n.id === view)?.label}</strong>
          </span>
          <div className="topbar-right">
            <span className={`cloud-status ${demo ? 'muted' : ''}`}>
              <span className={`status-dot ${busy ? 'pulsing' : ''}`} />
              {demo
                ? 'Preview · not saved'
                : busy
                ? 'Saving…'
                : pending
                ? 'Save needs attention'
                : error
                ? 'Connection needs attention'
                : 'Cloud connected'}
            </span>
            <span className="top-streak">
              <Flame size={17} />
              {stats.streak}
              <span>day streak</span>
            </span>
            <span className="avatar desktop-avatar">Y</span>
            <button
              className="mobile-signout"
              aria-label={demo ? 'Exit preview' : 'Sign out'}
              disabled={disabled}
              onClick={() => void logout()}
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>

        <main id="main-content" tabIndex={-1}>
          <div className="content-wrap">
            {demo && (
              <div className="preview-banner">
                <CircleHelp size={17} />
                <span>
                  Interactive preview. Ratings and progress reset when you leave. Connect Supabase
                  for persistent cloud learning.
                </span>
                <button onClick={() => void logout()}>
                  Setup <ArrowRight size={14} />
                </button>
              </div>
            )}
            {error && (
              <div className="error-banner" role="alert">
                <CloudOff size={20} />
                <div>
                  <strong>
                    {pending
                      ? 'Your change has not been confirmed.'
                      : 'Connection needs attention.'}
                  </strong>
                  <p>{error}</p>
                  <div className="inline-actions">
                    {pending && (
                      <button onClick={() => void mutate(p => p, pending)} disabled={busy}>
                        Retry save
                      </button>
                    )}
                    <button disabled={busy} onClick={() => void load()}>
                      Reload cloud progress
                    </button>
                  </div>
                </div>
              </div>
            )}
            {notice && (
              <div className="notice" role="status">
                {notice}
                <button aria-label="Dismiss notice" onClick={() => setNotice('')}>
                  <X size={16} />
                </button>
              </div>
            )}

            {/* View 1: Home Overview */}
            {view === 'home' && (
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">INTERACTIVE LEARNING LAB</div>
                    <h1>
                      Welcome to your DV studio<span className="green-dot">.</span>
                    </h1>
                    <p>Browse advanced silicon concepts. Step through waveforms. Master verification.</p>
                  </div>
                  <span className="date-label">
                    {now.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      weekday: 'short',
                    })}
                  </span>
                </div>

                <div className="overview-grid">
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="hero-tag">
                        <span /> NVIDIA DESIGN VERIFICATION TRACK
                      </span>
                      <h2>
                        Think like
                        <br />
                        the <em>hardware.</em>
                      </h2>
                      <p>
                        No multiple-choice quizzes. Rich, interactive modules with cycle-by-cycle
                        waveform simulators and silicon postmortems.
                      </p>
                      <button
                        className="button lime"
                        disabled={disabled}
                        onClick={() => handleSelectModule(activeModule.id)}
                      >
                        {p.completedModules.includes(activeModule.id)
                          ? 'Review Active Module'
                          : 'Explore Active Module'}
                        <ArrowRight size={18} />
                      </button>
                      <span className="hero-foot">
                        Current focus: {activeModule.title} · ~{activeModule.estimatedMinutes} min
                      </span>
                    </div>
                    <Circuit />
                  </section>

                  <section className="daily-card card">
                    <div className="card-top">
                      <span className="eyebrow">TODAY’S TARGET</span>
                      <Target size={18} />
                    </div>
                    <div
                      className="goal-ring"
                      style={
                        {
                          '--progress': `${Math.min(stats.todayCount / p.goal, 1) * 100}%`,
                        } as React.CSSProperties
                      }
                    >
                      <div>
                        <strong>
                          {Math.min(stats.todayCount, p.goal)}
                          <span>/{p.goal}</span>
                        </strong>
                        <small>modules</small>
                      </div>
                    </div>
                    <h3>
                      {stats.todayCount >= p.goal
                        ? 'Target achieved. Solid mastery.'
                        : 'Explore a module today.'}
                    </h3>
                    <p>
                      {stats.todayCount >= p.goal
                        ? 'Your daily verification learning is complete.'
                        : `${Math.max(p.goal - stats.todayCount, 0)} more to meet your target.`}
                    </p>
                    <div className="daily-footer">
                      <Flame size={17} />
                      <strong>{stats.streak}-day streak</strong>
                      <span>Consistent growth.</span>
                    </div>
                  </section>
                </div>

                <div className="stats-grid">
                  <Stat
                    icon={Zap}
                    label="Verification XP"
                    value={stats.xp.toLocaleString()}
                    note="+20 XP per module · +10 XP for feedback"
                    color="sage"
                  />
                  <Stat
                    icon={ShieldCheck}
                    label="Topics Mastered"
                    value={`${stats.masteredCount} / ${stats.totalModulesCount}`}
                    note={`${Math.round((stats.masteredCount / stats.totalModulesCount) * 100)}% overall DV proficiency`}
                    color="lavender"
                  />
                  <Stat
                    icon={Star}
                    label="Avg Module Quality"
                    value={stats.averageQuality ? `${stats.averageQuality}/5` : '—'}
                    note={
                      stats.averageQuality
                        ? `${stats.highQualityCount} rated 4-5 stars`
                        : 'Score modules to guide quality'
                    }
                    color="sand"
                  />
                </div>

                {/* Quick Topic Explorer */}
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">EXPLORE CURATED DISCIPLINES</span>
                    <h2>NVIDIA Design Verification Modules</h2>
                  </div>
                  <span className="section-meta">
                    {learningModules.length} Advanced Learning Modules
                  </span>
                </div>

                <div className="topic-grid">
                  {topics.map((t, i) => {
                    const domainModules = learningModules.filter(m => m.topic === t.id);
                    const domainMastered = domainModules.filter(
                      m => p.moduleRatings?.[m.id]?.knowsTopic === 'mastered'
                    ).length;
                    return (
                      <button
                        key={t.id}
                        className="topic-card card"
                        disabled={disabled}
                        onClick={() => {
                          if (domainModules[0]) handleSelectModule(domainModules[0].id);
                        }}
                      >
                        <div className="topic-top">
                          <span className={`icon-box ${t.color}`}>
                            <BookOpen size={22} />
                          </span>
                          <span className="topic-number">0{i + 1}</span>
                        </div>
                        <h3>{t.name}</h3>
                        <p>{t.description}</p>
                        <div className="topic-bottom">
                          <span>
                            {domainMastered} of {domainModules.length} Mastered
                          </span>
                          <ArrowRight size={17} />
                        </div>
                        <div className="thin-progress">
                          <span
                            style={{
                              width: `${domainModules.length ? (domainMastered / domainModules.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* View 2: Learning Modules Catalog */}
            {view === 'modules' && (
              <ModulesCatalog
                progress={p}
                disabled={disabled}
                onSelectModule={handleSelectModule}
              />
            )}

            {/* View 3: Active Interactive Module Viewer */}
            {view === 'viewer' && (
              <ModuleViewer
                module={activeModule}
                progress={p}
                disabled={disabled}
                onBack={() => go('modules')}
                onRate={handleRateModule}
              />
            )}

            {/* View 4: User Knowledge Map */}
            {view === 'knowledge' && (
              <KnowledgeMap progress={p} onSelectModule={handleSelectModule} />
            )}

            {/* View 5: Quality Insights */}
            {view === 'insights' && <QualityInsights progress={p} />}
          </div>

          <footer className="main-footer">
            <span>
              MindReps <span> / </span> Interactive Silicon Verification Lab
            </span>
            <span>No MCQs · Built for Engineering Depth</span>
          </footer>
        </main>
      </div>

      {/* Mobile Navigation */}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map(item => (
          <button
            key={item.id}
            aria-current={view === item.id ? 'page' : undefined}
            className={view === item.id ? 'active' : ''}
            onClick={() => go(item.id)}
          >
            <item.icon size={21} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sr-only" role="status" aria-live="polite">
        {busy
          ? 'Saving change'
          : pending
          ? 'Save failed'
          : demo
          ? 'Preview mode'
          : error
          ? 'Connection needs attention'
          : 'Progress connected to cloud'}
      </div>
    </div>
  );
}

function message(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}

function Loading({ label }: { label: string }) {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={25} />
      <p>{label}</p>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
  color,
}: {
  icon: IconType;
  label: string;
  value: string;
  note: string;
  color: string;
}) {
  return (
    <section className="stat card">
      <span className={`icon-box ${color}`}>
        <Icon size={20} />
      </span>
      <div>
        <span className="stat-label">{label}</span>
        <div className="stat-value">{value}</div>
        <p>{note}</p>
      </div>
    </section>
  );
}

function Circuit() {
  return (
    <svg className="circuit" viewBox="0 0 360 260" aria-hidden="true">
      <defs>
        <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r=".8" fill="#d0ef89" opacity=".15" />
        </pattern>
      </defs>
      <rect width="360" height="260" fill="url(#dots)" />
      <g fill="none" stroke="#a7bb8e" strokeWidth="1.2" opacity=".5">
        <path d="M0 65h70v52h46M0 195h83v-46h33M220 117h57V66h83M220 149h80v47h60M165 0v62M188 199v61M0 228h45v-16h17v16h17v-16h17v16h20" />
        <path d="M135 62V47h60v15M135 199v15h30v46M220 132h140" />
      </g>
      <g fill="#cceaa4">
        <circle cx="70" cy="65" r="3" />
        <circle cx="83" cy="195" r="3" />
        <circle cx="277" cy="66" r="3" />
        <circle cx="300" cy="196" r="3" />
      </g>
      <rect x="116" y="62" width="104" height="137" rx="13" fill="#293526" stroke="#92a578" />
      <rect x="131" y="77" width="74" height="107" rx="6" fill="#202a1e" stroke="#556848" />
      <g stroke="#a3bc86" strokeWidth="3">
        {[89, 106, 123, 140, 157, 174].map(y => (
          <React.Fragment key={y}>
            <path d={`M107 ${y}h9M220 ${y}h9`} />
          </React.Fragment>
        ))}
      </g>
      <text x="168" y="119" textAnchor="middle" fill="#d3efac" fontSize="23" fontFamily="monospace">
        RTL
      </text>
      <text
        x="168"
        y="142"
        textAnchor="middle"
        fill="#8da17b"
        fontSize="8"
        fontFamily="monospace"
        letterSpacing="2"
      >
        THINK. VERIFY.
      </text>
      <path d="M146 160h10v-8h12v8h12v-8h11" fill="none" stroke="#cceaa4" strokeWidth="1.5" />
      <rect x="251" y="22" width="91" height="30" rx="15" fill="#d0ef89" />
      <path d="m263 37 4 4 7-8" fill="none" stroke="#283722" strokeWidth="1.5" />
      <text x="302" y="40" textAnchor="middle" fill="#283722" fontSize="9" fontFamily="monospace">
        DV LAB
      </text>
      <text
        x="24"
        y="246"
        fill="#829575"
        fontSize="8"
        fontFamily="monospace"
        letterSpacing="1"
      >
        01 — INTERACTIVE LEARNING MODULES
      </text>
    </svg>
  );
}

function Gate({ onDemo }: { onDemo: () => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [useCode, setUseCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);

  const send = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin + window.location.pathname,
        },
      });
      if (error) throw error;
      setSent(true);
      setUseCode(false);
      setCode('');
      setRetryAt(Date.now() + 60000);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      });
      if (error) throw error;
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate-shell">
      <section className="gate-story">
        <Logo />
        <div>
          <span className="hero-tag">
            <span /> YOUR PERSONAL VERIFICATION LAB
          </span>
          <h1>
            Better instincts.
            <br />
            Interactive modules
            <br />
            at your <em>pace.</em>
          </h1>
          <p>
            Hardware learning modules for the engineer who wants to master the why.
          </p>
          <Circuit />
        </div>
        <span className="gate-story-footer">RTL · VERIFICATION · MICROARCHITECTURE</span>
      </section>
      <section className="gate-main">
        <div className="gate-mobile-logo">
          <Logo />
        </div>
        <div className="gate-card">
          <span className="icon-box sage">
            <LockKeyhole size={23} />
          </span>
          <div className="eyebrow">A WORKSPACE OF YOUR OWN</div>
          <h1>
            {configured
              ? sent
                ? 'Check your inbox.'
                : 'Welcome to MindReps.'
              : 'Your learning lab is ready.'}
          </h1>
          <p>
            {configured
              ? sent
                ? useCode
                  ? 'Enter the code included in your sign-in email.'
                  : 'Open the sign-in link in your email to return to MindReps. Only the authorized owner can access saved progress.'
                : 'Sign in through email to pick up where you left off.'
              : 'The interface and learning module bank are ready. Connect your Supabase project to turn on private sign-in and cloud progress.'}
          </p>
          {configured ? (
            <form onSubmit={sent ? verify : send}>
              {!sent ? (
                <>
                  <label htmlFor="email">Your email</label>
                  <div className="input-wrap">
                    <Mail size={18} />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      disabled={busy}
                    />
                  </div>
                </>
              ) : (
                <>
                  {useCode && (
                    <>
                      <label htmlFor="otp">Email code</label>
                      <input
                        className="otp-input"
                        id="otp"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                        minLength={6}
                        maxLength={10}
                        required
                        placeholder="Enter your code"
                        disabled={busy}
                      />
                    </>
                  )}
                  <p className="small-copy">
                    Sent to {email.trim()}. Check your spam folder if it does not arrive.
                  </p>
                </>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              {(!sent || useCode) && (
                <button className="button primary full" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <>
                      {sent ? 'Open my workspace' : 'Send sign-in email'}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              )}
              {sent && (
                <>
                  {!useCode && (
                    <button
                      className="button secondary full"
                      type="button"
                      disabled={busy}
                      onClick={() => setUseCode(true)}
                    >
                      My email includes a code
                    </button>
                  )}
                  <div className="gate-form-links">
                    <button
                      type="button"
                      onClick={() => {
                        setSent(false);
                        setUseCode(false);
                        setCode('');
                        setError('');
                      }}
                      disabled={busy}
                    >
                      Change email
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        if (Date.now() < retryAt) {
                          setError('Please wait one minute before requesting another email.');
                          return;
                        }
                        void send(e);
                      }}
                      disabled={busy}
                    >
                      Resend email
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : (
            <>
              {setupError && (
                <p className="form-error" role="status">
                  {setupError}
                </p>
              )}
              <ol className="setup-steps">
                <li>
                  <span>01</span>
                  <div>
                    <strong>Create a free Supabase project</strong>
                    <small>Run supabase/schema.sql in its SQL editor.</small>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Authorize your account</strong>
                    <small>Add your user and enable email sign-in.</small>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Connect and deploy</strong>
                    <small>Follow SETUP.md for keys and GitHub Pages.</small>
                  </div>
                </li>
              </ol>
              <button className="button primary full" onClick={onDemo}>
                Explore the interactive preview <ArrowRight size={18} />
              </button>
              <p className="preview-disclaimer">
                Preview modules and evaluations stay in memory and are not saved.
              </p>
            </>
          )}
          <div className="gate-privacy">
            <ShieldCheck size={15} />
            <span>
              {configured
                ? 'No public signup. Your progress stays yours.'
                : 'One learner. No distractions. Built for depth.'}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
