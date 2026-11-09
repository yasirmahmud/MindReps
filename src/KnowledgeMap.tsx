import React from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Code2,
  Compass,
  Cpu,
  Layers3,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Waves,
  Zap,
} from 'lucide-react';
import { topics, type TopicId } from './content';
import { learningModules, type LearningModule } from './learningModules';
import type { Progress } from './domain';

const topicIcons: Record<TopicId, typeof Cpu> = {
  sv: Code2,
  sva: ShieldCheck,
  uvm: Layers3,
  cdc: Waves,
  arch: Cpu,
  debug: Activity,
};

export function KnowledgeMap({
  progress,
  onSelectModule,
}: {
  progress: Progress;
  onSelectModule: (moduleId: string) => void;
}) {
  const ratings = progress.moduleRatings ?? {};
  const completedList = new Set(progress.completedModules ?? []);

  const totalModules = learningModules.length;
  const masteredCount = Object.values(ratings).filter(r => r.knowsTopic === 'mastered').length;
  const partialCount = Object.values(ratings).filter(r => r.knowsTopic === 'partially').length;
  const notKnownCount = Object.values(ratings).filter(r => r.knowsTopic === 'not_known').length;
  const unexploredCount = totalModules - completedList.size;

  const proficiencyPercent = totalModules > 0 ? Math.round((masteredCount / totalModules) * 100) : 0;

  return (
    <div className="knowledge-map-wrap">
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR VERIFICATION MASTERY PROFILE</div>
          <h1>NVIDIA DV Knowledge Map<span className="green-dot">.</span></h1>
          <p>
            Track your verified proficiency across core silicon design verification disciplines.
            Updated dynamically from your self-assessments.
          </p>
        </div>
      </div>

      {/* Summary KPI Stats */}
      <div className="stats-grid">
        <section className="stat card">
          <span className="icon-box sage">
            <Target size={20} />
          </span>
          <div>
            <span className="stat-label">Overall Proficiency</span>
            <div className="stat-value">
              {proficiencyPercent}
              <small>%</small>
            </div>
            <p>{masteredCount} of {totalModules} topics mastered</p>
          </div>
        </section>

        <section className="stat card">
          <span className="icon-box lavender">
            <CheckCircle2 size={20} />
          </span>
          <div>
            <span className="stat-label">Interview Ready</span>
            <div className="stat-value">{masteredCount}</div>
            <p>Topics marked Mastered</p>
          </div>
        </section>

        <section className="stat card">
          <span className="icon-box sand">
            <RotateCcw size={20} />
          </span>
          <div>
            <span className="stat-label">Need Review</span>
            <div className="stat-value">{partialCount + notKnownCount}</div>
            <p>{partialCount} partial · {notKnownCount} learning</p>
          </div>
        </section>

        <section className="stat card">
          <span className="icon-box blue">
            <BookOpen size={20} />
          </span>
          <div>
            <span className="stat-label">Unexplored</span>
            <div className="stat-value">{unexploredCount}</div>
            <p>Ready to discover</p>
          </div>
        </section>
      </div>

      {/* Domain Proficiency Breakdown Grid */}
      <div className="domain-breakdown-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">DOMAIN PROFICIENCY BREAKDOWN</span>
            <h2>Core Verification Pillars</h2>
          </div>
          <span className="section-meta">6 Specialized Domains</span>
        </div>

        <div className="domain-cards-grid">
          {topics.map(t => {
            const Icon = topicIcons[t.id];
            const domainModules = learningModules.filter(m => m.topic === t.id);
            const domainMastered = domainModules.filter(
              m => ratings[m.id]?.knowsTopic === 'mastered'
            ).length;
            const domainPartial = domainModules.filter(
              m => ratings[m.id]?.knowsTopic === 'partially'
            ).length;
            const domainPct =
              domainModules.length > 0
                ? Math.round((domainMastered / domainModules.length) * 100)
                : 0;

            return (
              <div key={t.id} className="domain-card card">
                <div className="domain-top">
                  <span className={`icon-box ${t.color}`}>
                    <Icon size={22} />
                  </span>
                  <div className="domain-header-meta">
                    <h3>{t.name}</h3>
                    <span className="domain-score">{domainPct}% Mastery</span>
                  </div>
                </div>

                <div className="domain-progress-bar">
                  <div
                    className="domain-fill"
                    style={{ width: `${domainPct}%` }}
                  />
                </div>

                <div className="domain-modules-list">
                  {domainModules.map(m => {
                    const r = ratings[m.id];
                    const status = r
                      ? r.knowsTopic === 'mastered'
                        ? 'mastered'
                        : r.knowsTopic === 'partially'
                        ? 'partially'
                        : 'not_known'
                      : 'unexplored';

                    return (
                      <button
                        key={m.id}
                        className={`domain-module-row status-${status}`}
                        onClick={() => onSelectModule(m.id)}
                      >
                        <div className="dm-info">
                          <span className={`dm-status-dot ${status}`} />
                          <span className="dm-title">{m.title}</span>
                        </div>
                        <div className="dm-right">
                          <span className={`dm-pill ${status}`}>
                            {status === 'mastered'
                              ? 'Mastered'
                              : status === 'partially'
                              ? 'Review'
                              : status === 'not_known'
                              ? 'Learning'
                              : 'Unexplored'}
                          </span>
                          <ArrowRight size={13} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggested Focus Areas */}
      <div className="focus-recommendations card">
        <span className="icon-box sage">
          <Sparkles size={24} />
        </span>
        <div>
          <span className="eyebrow">PERSONALIZED ROADMAP</span>
          <h2>Recommended Next Topics to Solidify</h2>
          <p>
            Based on your self-assessments, here are the topics you flagged for further review or
            haven’t explored yet.
          </p>
          <div className="suggested-buttons">
            {learningModules
              .filter(m => {
                const r = ratings[m.id];
                return !r || r.knowsTopic !== 'mastered';
              })
              .slice(0, 3)
              .map(m => (
                <button
                  key={m.id}
                  className="suggested-pill"
                  onClick={() => onSelectModule(m.id)}
                >
                  <Cpu size={14} />
                  <span>{m.title}</span>
                  <ArrowRight size={12} />
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

