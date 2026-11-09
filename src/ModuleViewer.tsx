import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  ExternalLink,
  Flame,
  HelpCircle,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Zap,
} from 'lucide-react';
import type { LearningModule } from './learningModules';
import type { ModuleRating, Progress } from './domain';
import { InteractiveVisualizer } from './InteractiveVisualizers';

const qualityTags = [
  'Replicate this interactive visualizer',
  'Clear SystemVerilog/SVA code breakdown',
  'High NVIDIA interview relevance',
  'Great edge-case analysis',
  'Add more timing waveforms',
  'Needs deeper formal proofs',
];

export function ModuleViewer({
  module: mod,
  progress,
  disabled,
  onBack,
  onRate,
}: {
  module: LearningModule;
  progress: Progress;
  disabled: boolean;
  onBack: () => void;
  onRate: (
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
  ) => void;
}) {
  const existingRating = progress.moduleRatings?.[mod.id];
  const [activeTab, setActiveTab] = useState<'interactive' | 'breakdown' | 'interview' | 'references'>('interactive');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Scoring Modal state
  const [showModal, setShowModal] = useState(false);
  const [qualityScore, setQualityScore] = useState<number>(existingRating?.qualityScore ?? 5);
  const [depthRating, setDepthRating] = useState<'too_shallow' | 'balanced' | 'advanced_thorough'>(
    existingRating?.depthRating ?? 'advanced_thorough'
  );
  const [visualRating, setVisualRating] = useState<'needs_diagrams' | 'helpful' | 'exceptional'>(
    existingRating?.visualRating ?? 'exceptional'
  );
  const [knowsTopic, setKnowsTopic] = useState<'mastered' | 'partially' | 'not_known'>(
    existingRating?.knowsTopic ?? 'mastered'
  );
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>(
    existingRating?.confidence ?? 'high'
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(
    existingRating?.tags ?? ['Replicate this interactive visualizer', 'High NVIDIA interview relevance']
  );
  const [notes, setNotes] = useState<string>(existingRating?.notes ?? '');
  const [submittedMessage, setSubmittedMessage] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags(curr =>
      curr.includes(tag) ? curr.filter(t => t !== tag) : [...curr, tag]
    );
  };

  const copyCode = (id: string, code: string) => {
    void navigator.clipboard?.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleSubmitRating = (e: React.FormEvent) => {
    e.preventDefault();
    onRate(mod.id, {
      qualityScore,
      depthRating,
      visualRating,
      knowsTopic,
      confidence,
      notes,
      tags: selectedTags,
    });
    setSubmittedMessage(true);
    setTimeout(() => {
      setShowModal(false);
      setSubmittedMessage(false);
    }, 1200);
  };

  return (
    <div className="module-viewer-wrap">
      {/* Top Navigation */}
      <div className="viewer-topbar">
        <button className="text-button" onClick={onBack} disabled={disabled}>
          <ArrowLeft size={16} /> All Learning Modules
        </button>
        <div className="viewer-top-meta">
          <span className="topic-chip">{mod.topicName}</span>
          <span className="level-chip">{mod.level}</span>
          <span>~{mod.estimatedMinutes} min study</span>
          {existingRating && (
            <span className={`status-badge ${existingRating.knowsTopic}`}>
              <CheckCircle2 size={13} />
              {existingRating.knowsTopic === 'mastered'
                ? 'Mastered'
                : existingRating.knowsTopic === 'partially'
                ? 'In Review'
                : 'Learning'}
            </span>
          )}
        </div>
      </div>

      {/* Module Title Banner */}
      <div className="module-header-card card">
        <span className="eyebrow">NVIDIA DESIGN VERIFICATION LEARNING MODULE</span>
        <h1>{mod.title}</h1>
        <p className="subtitle">{mod.subtitle}</p>
        <p className="summary">{mod.summary}</p>

        {/* Key Concepts row */}
        <div className="concepts-row">
          {mod.keyConcepts.map((kc, i) => (
            <div key={i} className="concept-pill">
              <span className="concept-tag">{kc.tag}</span>
              <strong>{kc.title}:</strong> {kc.description}
            </div>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="module-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'interactive'}
          className={`tab-btn ${activeTab === 'interactive' ? 'active' : ''}`}
          onClick={() => setActiveTab('interactive')}
        >
          <Cpu size={16} />
          <span>Interactive Visualizer &amp; Lab</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'breakdown'}
          className={`tab-btn ${activeTab === 'breakdown' ? 'active' : ''}`}
          onClick={() => setActiveTab('breakdown')}
        >
          <BookOpen size={16} />
          <span>Hardware Architecture &amp; RTL Deep Dive</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'interview'}
          className={`tab-btn ${activeTab === 'interview' ? 'active' : ''}`}
          onClick={() => setActiveTab('interview')}
        >
          <ShieldCheck size={16} />
          <span>NVIDIA Interview &amp; Silicon Gotchas</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'references'}
          className={`tab-btn ${activeTab === 'references' ? 'active' : ''}`}
          onClick={() => setActiveTab('references')}
        >
          <ExternalLink size={16} />
          <span>Standards &amp; References</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="tab-content-area">
        {/* Tab 1: Interactive Graphical Tool */}
        {activeTab === 'interactive' && (
          <section className="tab-pane">
            <div className="interactive-intro card">
              <div className="intro-header">
                <span className="icon-box sage">
                  <Cpu size={22} />
                </span>
                <div>
                  <h2>{mod.interactiveTitle}</h2>
                  <p>{mod.interactiveSubtitle}</p>
                </div>
              </div>
              <p className="instructions">
                <strong>How to explore:</strong> {mod.interactiveInstructions}
              </p>
            </div>
            <InteractiveVisualizer type={mod.interactiveType} />
          </section>
        )}

        {/* Tab 2: Architecture & RTL Breakdown */}
        {activeTab === 'breakdown' && (
          <section className="tab-pane">
            <div className="sections-list">
              {mod.sections.map(sec => (
                <article key={sec.id} className="module-section-card card">
                  <h2>{sec.title}</h2>
                  <div className="section-body">
                    {sec.content.split('\n\n').map((paragraph, idx) => (
                      <p key={idx}>{paragraph}</p>
                    ))}
                  </div>

                  {sec.code && (
                    <div className="code-viewer-wrap">
                      <div className="code-topbar">
                        <span>
                          <span className="code-dot" /> {sec.codeLang?.toUpperCase() ?? 'SYSTEMVERILOG'}
                        </span>
                        <button
                          className="copy-btn"
                          onClick={() => copyCode(sec.id, sec.code!)}
                          aria-label="Copy code snippet"
                        >
                          {copiedCodeId === sec.id ? (
                            <>
                              <Check size={13} /> Copied!
                            </>
                          ) : (
                            <>
                              <Copy size={13} /> Copy Code
                            </>
                          )}
                        </button>
                      </div>
                      <pre>
                        <code>{sec.code}</code>
                      </pre>
                      {sec.codeNotes && <small className="code-notes">{sec.codeNotes}</small>}
                    </div>
                  )}

                  {sec.callout && (
                    <div className={`section-callout ${sec.callout.type}`}>
                      <Sparkles size={18} />
                      <div>
                        <strong>{sec.callout.title}</strong>
                        <p>{sec.callout.body}</p>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Tab 3: NVIDIA Interview & Silicon Gotchas */}
        {activeTab === 'interview' && (
          <section className="tab-pane">
            <div className="interview-insights-card card">
              <span className="eyebrow">INTERVIEW PROVENANCE &amp; ARCHITECTURAL THEMES</span>
              <h2>How NVIDIA Evaluates Candidates on This Topic</h2>
              <p className="lead">{mod.nvidiaRelevance.interviewContext}</p>

              <div className="interview-qa-grid">
                <div className="qa-panel">
                  <h3>Frequently Asked Interview Questions</h3>
                  <ul className="questions-list">
                    {mod.nvidiaRelevance.keyQuestionsAsked.map((q, idx) => (
                      <li key={idx}>
                        <HelpCircle size={16} />
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="qa-panel">
                  <h3>What Senior Evaluators Look For</h3>
                  <div className="eval-callout">
                    <ShieldCheck size={20} />
                    <p>{mod.nvidiaRelevance.whatInterviewersLookFor}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tab 4: References */}
        {activeTab === 'references' && (
          <section className="tab-pane">
            <div className="references-card card">
              <span className="eyebrow">CURATED TECHNICAL REFERENCES</span>
              <h2>Standards, Papers &amp; Specifications</h2>
              <div className="ref-list">
                {mod.references.map((r, i) => (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ref-item"
                  >
                    <div>
                      <strong>{r.title}</strong>
                      <p>{r.note}</p>
                    </div>
                    <ExternalLink size={16} />
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Completion & Evaluation Footer Banner */}
      <div className="viewer-footer-banner card">
        <div className="footer-left">
          <Sparkles size={24} />
          <div>
            <h3>Finished browsing this module?</h3>
            <p>
              Score the module quality and update your topic knowledge status to power the
              learning map and guide new module creation.
            </p>
          </div>
        </div>
        <button
          className="button lime"
          disabled={disabled}
          onClick={() => setShowModal(true)}
        >
          {existingRating ? 'Update Module Evaluation' : 'Complete & Score Module'}
          <ArrowRight size={17} />
        </button>
      </div>

      {/* End-of-Module Scoring & Knowledge Modal */}
      {showModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-top">
              <div>
                <span className="eyebrow">MODULE COMPLETION &amp; FEEDBACK</span>
                <h2>Evaluate Module: {mod.title}</h2>
              </div>
              <button
                className="close-modal"
                onClick={() => setShowModal(false)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitRating}>
              {/* Question 1: Module Quality */}
              <div className="question-block">
                <span className="q-label">
                  Question 1: How would you rate the quality of this learning module?
                </span>
                <p className="q-desc">
                  This data tells us what learning module quality is good so we can replicate
                  high-performing modules and improve weaker ones.
                </p>

                {/* Star rating */}
                <div className="star-rating-row">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      className={`star-btn ${qualityScore >= star ? 'filled' : ''}`}
                      onClick={() => setQualityScore(star)}
                      aria-label={`${star} of 5 stars`}
                    >
                      <Star size={24} />
                    </button>
                  ))}
                  <span className="rating-label">
                    {qualityScore === 5
                      ? '5/5 · Exceptional (Replicate this format)'
                      : qualityScore === 4
                      ? '4/5 · High Quality'
                      : qualityScore === 3
                      ? '3/5 · Adequate'
                      : qualityScore === 2
                      ? '2/5 · Needs Work'
                      : '1/5 · Poor / Rework Required'}
                  </span>
                </div>

                {/* Depth & Visuals */}
                <div className="radio-group-row">
                  <div className="radio-field">
                    <label>Depth of Technical Content:</label>
                    <select
                      value={depthRating}
                      onChange={e =>
                        setDepthRating(
                          e.target.value as 'too_shallow' | 'balanced' | 'advanced_thorough'
                        )
                      }
                    >
                      <option value="balanced">Balanced &amp; Clear</option>
                      <option value="advanced_thorough">Advanced &amp; Thorough</option>
                      <option value="too_shallow">Too Shallow</option>
                    </select>
                  </div>

                  <div className="radio-field">
                    <label>Interactive &amp; Graphical Quality:</label>
                    <select
                      value={visualRating}
                      onChange={e =>
                        setVisualRating(
                          e.target.value as 'needs_diagrams' | 'helpful' | 'exceptional'
                        )
                      }
                    >
                      <option value="exceptional">Outstanding Graphical Tools</option>
                      <option value="helpful">Helpful Visuals</option>
                      <option value="needs_diagrams">Needs More Diagrams</option>
                    </select>
                  </div>
                </div>

                {/* Quality Tags */}
                <div className="tags-selection-wrap">
                  <label>What stood out? (Select all that apply to guide new modules):</label>
                  <div className="tag-chips">
                    {qualityTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className={`tag-chip ${selectedTags.includes(tag) ? 'chosen' : ''}`}
                        onClick={() => toggleTag(tag)}
                      >
                        <Tag size={12} /> {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Qualitative Feedback Text */}
                <div className="feedback-textarea-wrap">
                  <label htmlFor="feedback-notes">
                    Notes for Module Generation (What to replicate / what to improve):
                  </label>
                  <textarea
                    id="feedback-notes"
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Loved the cycle-by-cycle waveform simulator; would like more formal assertion examples on the full condition..."
                  />
                </div>
              </div>

              {/* Question 2: Topic Knowledge */}
              <div className="question-block highlight-knowledge">
                <span className="q-label">
                  Question 2: Do you know this topic? (Knowledge Map Assessment)
                </span>
                <p className="q-desc">
                  We use your response to build your personalized DV Knowledge Map and track
                  which topics you are proficient in.
                </p>

                <div className="knowledge-choices">
                  <button
                    type="button"
                    className={`knowledge-choice ${knowsTopic === 'mastered' ? 'selected' : ''}`}
                    onClick={() => setKnowsTopic('mastered')}
                  >
                    <div className="choice-indicator mastered" />
                    <div>
                      <strong>Mastered / Proficient</strong>
                      <p>
                        I understand this thoroughly and can handle advanced NVIDIA DV technical
                        rounds and silicon implementation.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`knowledge-choice ${knowsTopic === 'partially' ? 'selected' : ''}`}
                    onClick={() => setKnowsTopic('partially')}
                  >
                    <div className="choice-indicator partially" />
                    <div>
                      <strong>Partially Understood</strong>
                      <p>
                        I grasp the core principles, but need to review tricky corner cases and
                        hardware timing again.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`knowledge-choice ${knowsTopic === 'not_known' ? 'selected' : ''}`}
                    onClick={() => setKnowsTopic('not_known')}
                  >
                    <div className="choice-indicator not_known" />
                    <div>
                      <strong>Still Learning / Don't Know Yet</strong>
                      <p>
                        This concept is new or challenging. I need to study prerequisites and
                        revisit this module later.
                      </p>
                    </div>
                  </button>
                </div>

                <div className="confidence-row">
                  <label>Self-Assessment Confidence:</label>
                  <div className="conf-buttons">
                    {(['high', 'medium', 'low'] as const).map(c => (
                      <button
                        key={c}
                        type="button"
                        className={`conf-btn ${confidence === c ? 'active' : ''}`}
                        onClick={() => setConfidence(c)}
                      >
                        {c.toUpperCase()} CONFIDENCE
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {submittedMessage ? (
                <div className="modal-success-banner">
                  <CheckCircle2 size={20} />
                  <span>Evaluation saved! Knowledge map &amp; quality insights updated. (+30 XP)</span>
                </div>
              ) : (
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button quiet"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="button primary">
                    Save Evaluation &amp; Update Knowledge Map
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

