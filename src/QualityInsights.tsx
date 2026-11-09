import React, { useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  Copy,
  FileCode2,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Sparkles,
  Star,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react';
import { learningModules } from './learningModules';
import type { Progress } from './domain';

export function QualityInsights({ progress }: { progress: Progress }) {
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const ratings = Object.values(progress.moduleRatings ?? {});
  const totalRated = ratings.length;

  const totalScore = ratings.reduce((sum, r) => sum + r.qualityScore, 0);
  const avgScore = totalRated > 0 ? (totalScore / totalRated).toFixed(1) : null;

  const highQuality = ratings.filter(r => r.qualityScore >= 4);
  const lowQuality = ratings.filter(r => r.qualityScore <= 3);

  // Collect tag frequencies
  const tagCounts: Record<string, number> = {};
  for (const r of ratings) {
    for (const tag of r.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  // Construct structured AI Generation Brief
  const generateBrief = () => {
    const highRatedTitles = highQuality.map(r => {
      const m = learningModules.find(mod => mod.id === r.moduleId);
      return `- ${m?.title ?? r.moduleId} (${r.qualityScore}/5 stars): ${r.notes || 'No custom notes'}`;
    });

    const lowRatedTitles = lowQuality.map(r => {
      const m = learningModules.find(mod => mod.id === r.moduleId);
      return `- ${m?.title ?? r.moduleId} (${r.qualityScore}/5 stars): ${r.notes || 'Needs improvement'}`;
    });

    const mastered = ratings
      .filter(r => r.knowsTopic === 'mastered')
      .map(r => learningModules.find(m => m.id === r.moduleId)?.title ?? r.moduleId);

    const gaps = ratings
      .filter(r => r.knowsTopic !== 'mastered')
      .map(r => learningModules.find(m => m.id === r.moduleId)?.title ?? r.moduleId);

    return `=== MINDREPS MODULE GENERATION BRIEF & QUALITY SPEC ===

USER KNOWLEDGE STATUS:
- Mastered Topics (${mastered.length}):
${mastered.map(t => `  * ${t}`).join('\n') || '  (None yet)'}

- Knowledge Gaps to Target (${gaps.length}):
${gaps.map(t => `  * ${t}`).join('\n') || '  (None yet)'}

PROVEN QUALITY PATTERNS (REPLICATE THESE):
- Average User Rating: ${avgScore || 'N/A'} / 5.0
- Top Rated Modules:
${highRatedTitles.join('\n') || '  (None rated >= 4 yet)'}

- User's Preferred Features (High Frequency Tags):
${sortedTags.map(([tag, count]) => `  * ${tag} (${count} votes)`).join('\n') || '  (No tags yet)'}

MODULES TO REFINE / REWORK:
${lowRatedTitles.join('\n') || '  (None rated <= 3)'}

SPECIFICATION FOR NEXT MODULE GENERATION:
1. Include an interactive cycle-by-cycle graphical simulator (SVG-based).
2. Cover advanced NVIDIA DV interview themes (e.g. FIFO assertions, CDC, protocol stalls).
3. Provide single-assignment verified SystemVerilog RTL and SVA assertions.
4. Include real silicon bug postmortems and IEEE 1800 scheduling details.`;
  };

  const copyBrief = () => {
    void navigator.clipboard?.writeText(generateBrief());
    setCopiedBrief(true);
    setTimeout(() => setCopiedBrief(false), 2000);
  };

  const copyJson = () => {
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        summary: {
          totalRated,
          averageQuality: avgScore,
          highQualityCount: highQuality.length,
          needsImprovementCount: lowQuality.length,
        },
        moduleRatings: progress.moduleRatings,
        completedModules: progress.completedModules,
      },
      null,
      2
    );
    void navigator.clipboard?.writeText(payload);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="quality-insights-wrap">
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">CONTINUOUS QUALITY OPTIMIZATION</div>
          <h1>Module Quality &amp; Generation Insights<span className="green-dot">.</span></h1>
          <p>
            Your feedback directly guides the creation of future learning modules. We analyze which
            formats and interactive tools provide maximum understanding so we can replicate them.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="stats-grid">
        <section className="stat card">
          <span className="icon-box sage">
            <Star size={20} />
          </span>
          <div>
            <span className="stat-label">Average Quality</span>
            <div className="stat-value">
              {avgScore ? `${avgScore}` : '—'}
              <small>/5</small>
            </div>
            <p>{totalRated} modules evaluated</p>
          </div>
        </section>

        <section className="stat card">
          <span className="icon-box lavender">
            <ThumbsUp size={20} />
          </span>
          <div>
            <span className="stat-label">Winning Patterns</span>
            <div className="stat-value">{highQuality.length}</div>
            <p>Rated 4 or 5 stars</p>
          </div>
        </section>

        <section className="stat card">
          <span className="icon-box sand">
            <ThumbsDown size={20} />
          </span>
          <div>
            <span className="stat-label">Needs Rework</span>
            <div className="stat-value">{lowQuality.length}</div>
            <p>Rated 3 stars or lower</p>
          </div>
        </section>
      </div>

      {/* Generation Brief Tool */}
      <div className="brief-generator card">
        <div className="brief-top">
          <span className="icon-box sage">
            <Sparkles size={24} />
          </span>
          <div>
            <span className="eyebrow">AI MODULE GENERATOR PROMPT</span>
            <h2>Export Module Quality &amp; Knowledge Brief</h2>
            <p>
              Use this structured brief to generate new modules that replicate your favorite
              interactive features and target your personal knowledge gaps.
            </p>
          </div>
        </div>

        <div className="brief-actions">
          <button className="button primary" onClick={copyBrief}>
            {copiedBrief ? (
              <>
                <Check size={16} /> Copied Generation Brief!
              </>
            ) : (
              <>
                <Copy size={16} /> Copy Generation Brief
              </>
            )}
          </button>
          <button className="button secondary" onClick={copyJson}>
            {copiedJson ? (
              <>
                <Check size={16} /> Copied JSON!
              </>
            ) : (
              <>
                <FileCode2 size={16} /> Copy Raw Quality Data (JSON)
              </>
            )}
          </button>
        </div>
      </div>

      {/* High Quality Patterns */}
      <div className="quality-sections-grid">
        <section className="card panel">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">WHAT’S WORKING</span>
              <h2>High-Quality Modules to Replicate</h2>
            </div>
            <ThumbsUp size={18} />
          </div>

          {highQuality.length === 0 ? (
            <p className="empty-state-copy">
              No modules rated 4+ stars yet. Complete and score modules to identify winning formats!
            </p>
          ) : (
            <div className="rated-modules-list">
              {highQuality.map(r => {
                const mod = learningModules.find(m => m.id === r.moduleId);
                return (
                  <div key={r.moduleId} className="rated-module-card">
                    <div className="rm-top">
                      <strong>{mod?.title ?? r.moduleId}</strong>
                      <span className="star-pill">
                        <Star size={13} fill="currentColor" /> {r.qualityScore}.0
                      </span>
                    </div>
                    {r.notes && <p className="rm-notes">"{r.notes}"</p>}
                    <div className="rm-tags">
                      {r.tags.map((t, idx) => (
                        <span key={idx} className="rm-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Needs Improvement */}
        <section className="card panel">
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">OPPORTUNITIES TO IMPROVE</span>
              <h2>Modules Requiring Refinement</h2>
            </div>
            <ThumbsDown size={18} />
          </div>

          {lowQuality.length === 0 ? (
            <p className="empty-state-copy">
              No low-rated modules currently logged. All rated modules meet high quality standards!
            </p>
          ) : (
            <div className="rated-modules-list">
              {lowQuality.map(r => {
                const mod = learningModules.find(m => m.id === r.moduleId);
                return (
                  <div key={r.moduleId} className="rated-module-card rework">
                    <div className="rm-top">
                      <strong>{mod?.title ?? r.moduleId}</strong>
                      <span className="star-pill low">
                        <Star size={13} fill="currentColor" /> {r.qualityScore}.0
                      </span>
                    </div>
                    {r.notes && <p className="rm-notes">"{r.notes}"</p>}
                    <small>Marked for technical depth and visual upgrades.</small>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

