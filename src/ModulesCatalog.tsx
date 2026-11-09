import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  Layers3,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
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
  debug: Cpu,
};

export function ModulesCatalog({
  progress,
  disabled,
  onSelectModule,
}: {
  progress: Progress;
  disabled: boolean;
  onSelectModule: (moduleId: string) => void;
}) {
  const [selectedTopic, setSelectedTopic] = useState<TopicId | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'mastered' | 'review' | 'unexplored'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const ratings = progress.moduleRatings ?? {};
  const completedList = new Set(progress.completedModules ?? []);

  const filtered = learningModules.filter(m => {
    // Topic filter
    if (selectedTopic !== 'all' && m.topic !== selectedTopic) return false;

    // Status filter
    const r = ratings[m.id];
    if (statusFilter === 'mastered' && r?.knowsTopic !== 'mastered') return false;
    if (statusFilter === 'review' && (r?.knowsTopic !== 'partially' && r?.knowsTopic !== 'not_known')) return false;
    if (statusFilter === 'unexplored' && completedList.has(m.id)) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = m.title.toLowerCase().includes(q);
      const matchSubtitle = m.subtitle.toLowerCase().includes(q);
      const matchSummary = m.summary.toLowerCase().includes(q);
      const matchConcepts = m.keyConcepts.some(c => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
      if (!matchTitle && !matchSubtitle && !matchSummary && !matchConcepts) return false;
    }

    return true;
  });

  return (
    <div className="modules-catalog-wrap">
      {/* Header */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">BROWSE &amp; LEARN VERIFICATION ARCHITECTURE</div>
          <h1>NVIDIA DV Learning Modules<span className="green-dot">.</span></h1>
          <p>
            Interactive, graphical learning modules designed for senior hardware verification
            engineers. Explore hardware timing, formal assertions, and microarchitecture.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="catalog-toolbar card">
        <div className="search-input-wrap">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search modules, concepts, SVA properties, AXI, CDC..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="topic-filters-row">
          <button
            className={`topic-filter-btn ${selectedTopic === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedTopic('all')}
          >
            All Disciplines ({learningModules.length})
          </button>
          {topics.map(t => (
            <button
              key={t.id}
              className={`topic-filter-btn ${selectedTopic === t.id ? 'active' : ''}`}
              onClick={() => setSelectedTopic(t.id)}
            >
              {t.short}
            </button>
          ))}
        </div>

        <div className="status-filters-row">
          <span>Status:</span>
          {(['all', 'mastered', 'review', 'unexplored'] as const).map(s => (
            <button
              key={s}
              className={`status-filter-pill ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Modules Grid */}
      <div className="modules-grid">
        {filtered.length === 0 ? (
          <div className="empty-catalog card">
            <BookOpen size={32} />
            <h3>No learning modules match your filter.</h3>
            <p>Try resetting the search query or selecting "All Disciplines".</p>
            <button
              className="button secondary"
              onClick={() => {
                setSelectedTopic('all');
                setStatusFilter('all');
                setSearchQuery('');
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filtered.map((mod, index) => {
            const r = ratings[mod.id];
            const isCompleted = completedList.has(mod.id);
            const isMastered = r?.knowsTopic === 'mastered';
            const needsReview = r && (r.knowsTopic === 'partially' || r.knowsTopic === 'not_known');

            return (
              <div key={mod.id} className="module-card card">
                <div className="card-top-row">
                  <span className="topic-chip">{mod.topicName}</span>
                  <div className="top-right-badges">
                    <span className="level-badge">{mod.level}</span>
                    <span className="time-badge">
                      <Clock size={12} /> {mod.estimatedMinutes}m
                    </span>
                  </div>
                </div>

                <h3 className="module-title">{mod.title}</h3>
                <p className="module-subtitle">{mod.subtitle}</p>

                <div className="module-tags-row">
                  {mod.keyConcepts.slice(0, 2).map((kc, i) => (
                    <span key={i} className="concept-chip">
                      {kc.tag}
                    </span>
                  ))}
                </div>

                <div className="module-card-footer">
                  <div className="status-indicator-wrap">
                    {isMastered ? (
                      <span className="status-pill success">
                        <CheckCircle2 size={13} /> Mastered
                      </span>
                    ) : needsReview ? (
                      <span className="status-pill review">
                        <RotateCcw size={13} /> Needs Review
                      </span>
                    ) : (
                      <span className="status-pill ready">Ready to Learn</span>
                    )}

                    {r && (
                      <span className="rating-pill">
                        <Star size={12} fill="currentColor" /> {r.qualityScore}.0
                      </span>
                    )}
                  </div>

                  <button
                    className="button primary small"
                    disabled={disabled}
                    onClick={() => onSelectModule(mod.id)}
                  >
                    {isCompleted ? 'Review Module' : 'Start Module'}
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

