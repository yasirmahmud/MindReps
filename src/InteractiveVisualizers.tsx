import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  Activity,
  Waves,
  RefreshCw,
  Plus,
  Minus,
} from 'lucide-react';
import type { InteractiveType } from './learningModules';

export function InteractiveVisualizer({ type }: { type: InteractiveType }) {
  switch (type) {
    case 'waveform-queue':
      return <WaveformQueueVisualizer />;
    case 'concurrency-mailbox':
      return <ConcurrencyVisualizer />;
    case 'fifo-assertion':
      return <SvaFifoVisualizer />;
    case 'handshake-stall':
      return <HandshakeVisualizer />;
    case 'cdc-gray-sync':
      return <CdcGrayVisualizer />;
    case 'reset-recovery':
      return <ResetTimingVisualizer />;
    case 'arbiter-round-robin':
      return <ArbiterVisualizer />;
    case 'credit-flow':
      return <CreditFlowVisualizer />;
    case 'uvm-phase-objection':
      return <UvmPhaseVisualizer />;
    case 'cache-coherence':
      return <CacheCoherenceVisualizer />;
    default:
      return <div>Visualizer ready.</div>;
  }
}

// 1. Queue Nonblocking Delta Cycle Waveform Simulator
function WaveformQueueVisualizer() {
  const [cycle, setCycle] = useState(0);
  const [push, setPush] = useState(true);
  const [pop, setPop] = useState(true);
  const [buggyCount, setBuggyCount] = useState(3);
  const [goldenCount, setGoldenCount] = useState(3);
  const [history, setHistory] = useState<
    { cycle: number; push: boolean; pop: boolean; buggy: number; golden: number }[]
  >([{ cycle: 0, push: true, pop: true, buggy: 3, golden: 3 }]);

  const stepCycle = () => {
    const nextCycle = cycle + 1;
    // Buggy model: if (push) count <= count + 1; if (pop) count <= count - 1;
    // In buggy model, pop evaluates using old state, superseding push!
    let nextBuggy = buggyCount;
    if (push && pop) {
      nextBuggy = Math.max(0, buggyCount - 1); // pop wins!
    } else if (push) {
      nextBuggy = Math.min(8, buggyCount + 1);
    } else if (pop) {
      nextBuggy = Math.max(0, buggyCount - 1);
    }

    // Golden model: atomic case
    let nextGolden = goldenCount;
    if (push && pop) {
      nextGolden = goldenCount; // holds occupancy!
    } else if (push) {
      nextGolden = Math.min(8, goldenCount + 1);
    } else if (pop) {
      nextGolden = Math.max(0, goldenCount - 1);
    }

    setCycle(nextCycle);
    setBuggyCount(nextBuggy);
    setGoldenCount(nextGolden);
    setHistory(h => [
      ...h.slice(-6),
      { cycle: nextCycle, push, pop, buggy: nextBuggy, golden: nextGolden },
    ]);
  };

  const resetSim = () => {
    setCycle(0);
    setBuggyCount(3);
    setGoldenCount(3);
    setHistory([{ cycle: 0, push, pop, buggy: 3, golden: 3 }]);
  };

  return (
    <div className="visualizer-box">
      <div className="vis-header">
        <div>
          <h4>Interactive Delta-Cycle & Nonblocking Scheduler Lab</h4>
          <p>Inspect how independent if-statements cause silent NBA update overrides</p>
        </div>
        <div className="vis-actions">
          <button className="vis-btn secondary" onClick={resetSim}>
            <RotateCcw size={14} /> Reset
          </button>
          <button className="vis-btn primary" onClick={stepCycle}>
            <Play size={14} /> Clock Step (Cycle {cycle + 1})
          </button>
        </div>
      </div>

      <div className="vis-controls-grid">
        <div className="vis-control-panel">
          <span className="vis-panel-title">Current Clock Cycle Inputs (Pre-Edge)</span>
          <div className="vis-toggle-row">
            <button
              className={`vis-toggle ${push ? 'active' : ''}`}
              onClick={() => setPush(!push)}
            >
              <Zap size={14} />
              <span>push_req: <strong>{push ? '1' : '0'}</strong></span>
            </button>
            <button
              className={`vis-toggle ${pop ? 'active' : ''}`}
              onClick={() => setPop(!pop)}
            >
              <Zap size={14} />
              <span>pop_req: <strong>{pop ? '1' : '0'}</strong></span>
            </button>
          </div>
          {push && pop && (
            <div className="vis-alert warning">
              <AlertTriangle size={15} />
              <span>Simultaneous push & pop active: Evaluates old state in Active region!</span>
            </div>
          )}
        </div>

        <div className="vis-metrics-panel">
          <div className="vis-metric-col buggy">
            <span className="vis-col-label">Buggy Sequential If RTL</span>
            <div className="vis-col-value">{buggyCount}</div>
            <small>Second statement overwrites first</small>
          </div>
          <div className="vis-metric-col golden">
            <span className="vis-col-label">Golden Single-Assignment RTL</span>
            <div className="vis-col-value">{goldenCount}</div>
            <small>Occupancy held atomically</small>
          </div>
        </div>
      </div>

      {/* Graphical Waveform View */}
      <div className="vis-waveform-container">
        <div className="vis-waveform-header">
          <span>Signal</span>
          <div className="vis-waveform-cycles">
            {history.map(h => (
              <span key={h.cycle}>Cycle {h.cycle}</span>
            ))}
          </div>
        </div>

        <div className="vis-signal-row">
          <span className="sig-name">clk</span>
          <div className="sig-trace">
            {history.map(h => (
              <div key={h.cycle} className="sig-pulse" />
            ))}
          </div>
        </div>

        <div className="vis-signal-row">
          <span className="sig-name">push</span>
          <div className="sig-trace">
            {history.map(h => (
              <div key={h.cycle} className={`sig-level ${h.push ? 'high' : 'low'}`}>
                {h.push ? '1' : '0'}
              </div>
            ))}
          </div>
        </div>

        <div className="vis-signal-row">
          <span className="sig-name">pop</span>
          <div className="sig-trace">
            {history.map(h => (
              <div key={h.cycle} className={`sig-level ${h.pop ? 'high' : 'low'}`}>
                {h.pop ? '1' : '0'}
              </div>
            ))}
          </div>
        </div>

        <div className="vis-signal-row highlight-bug">
          <span className="sig-name">buggy_count</span>
          <div className="sig-trace">
            {history.map(h => (
              <div key={h.cycle} className="sig-val error-glow">
                {h.buggy}
              </div>
            ))}
          </div>
        </div>

        <div className="vis-signal-row highlight-gold">
          <span className="sig-name">golden_count</span>
          <div className="sig-trace">
            {history.map(h => (
              <div key={h.cycle} className="sig-val golden-glow">
                {h.golden}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 2. OOP Concurrency & Memory Aliasing Inspector
function ConcurrencyVisualizer() {
  const [mode, setMode] = useState<'shared' | 'cloned'>('shared');
  const [step, setStep] = useState(0);

  const reset = () => setStep(0);
  const nextStep = () => setStep(s => Math.min(3, s + 1));

  const workers = [
    { id: 0, k: 0, writtenVal: 0 },
    { id: 1, k: 1, writtenVal: 1 },
    { id: 2, k: 2, writtenVal: 2 },
  ];

  return (
    <div className="visualizer-box">
      <div className="vis-header">
        <div>
          <h4>OOP Object Handle Aliasing & Heap Memory Inspector</h4>
          <p>Visualize stack handle pointers vs heap object allocations during fork..join_none</p>
        </div>
        <div className="vis-actions">
          <button
            className={`vis-btn ${mode === 'shared' ? 'primary' : 'secondary'}`}
            onClick={() => {
              setMode('shared');
              setStep(0);
            }}
          >
            Buggy Shared Handle
          </button>
          <button
            className={`vis-btn ${mode === 'cloned' ? 'primary' : 'secondary'}`}
            onClick={() => {
              setMode('cloned');
              setStep(0);
            }}
          >
            Safe Instance-per-Thread
          </button>
        </div>
      </div>

      <div className="vis-step-bar">
        <span>Execution Stage:</span>
        <button
          className="vis-btn secondary small"
          disabled={step === 0}
          onClick={reset}
        >
          Reset
        </button>
        <button
          className="vis-btn primary small"
          disabled={step === 3}
          onClick={nextStep}
        >
          {step === 3 ? 'Completed' : `Execute Worker ${step}`}
        </button>
      </div>

      <div className="vis-memory-topology">
        {/* Thread Stack Column */}
        <div className="mem-column">
          <span className="mem-heading">Thread Stacks (Local Handles)</span>
          <div className="thread-stack-list">
            {workers.map((w, i) => (
              <div
                key={w.id}
                className={`thread-card ${step > i ? 'executed' : step === i ? 'running' : ''}`}
              >
                <div className="thread-top">
                  <span>Worker Thread #{w.id}</span>
                  <small>automatic int k = {w.k}</small>
                </div>
                <div className="thread-handle">
                  <span>Handle: <code>t</code></span>
                  <ArrowRight size={13} />
                  <strong>
                    {mode === 'shared' ? '0x00A4 (Shared Heap)' : `0x00A${i + 4} (Local Heap)`}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Heap Memory Column */}
        <div className="mem-column">
          <span className="mem-heading">Heap Memory Space</span>
          {mode === 'shared' ? (
            <div className="heap-card single-heap">
              <div className="heap-addr">Heap Address: 0x00A4 (One Allocation)</div>
              <div className="heap-body">
                <div className="field-row">
                  <span>t.data</span>
                  <strong className="corrupt-val">
                    {step === 0 ? 'init (0)' : step === 1 ? '0' : step === 2 ? '1' : '2'}
                  </strong>
                </div>
              </div>
              <small className="heap-warning">
                All 3 threads overwrite the same physical memory location!
              </small>
            </div>
          ) : (
            <div className="heap-card-group">
              {workers.map((w, i) => (
                <div
                  key={w.id}
                  className={`heap-card ${step > i ? 'active' : 'idle'}`}
                >
                  <div className="heap-addr">Heap Address: 0x00A{i + 4}</div>
                  <div className="field-row">
                    <span>local_t.data</span>
                    <strong>{step > i ? w.k : 'uninitialized'}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mailbox / Queue Column */}
        <div className="mem-column">
          <span className="mem-heading">Receiver Mailbox</span>
          <div className="mailbox-queue">
            {[0, 1, 2].map(slot => {
              const filled = step > slot;
              return (
                <div key={slot} className={`mb-slot ${filled ? 'filled' : ''}`}>
                  <span>Slot #{slot}</span>
                  {filled ? (
                    <div>
                      <code>{mode === 'shared' ? 'ptr: 0x00A4' : `ptr: 0x00A${slot + 4}`}</code>
                      <p>
                        Value seen on get():{' '}
                        <strong>{mode === 'shared' ? step - 1 : slot}</strong>
                      </p>
                    </div>
                  ) : (
                    <small>Empty</small>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// 3. SVA FIFO Assertion & Vacuity Checker
function SvaFifoVisualizer() {
  const [count, setCount] = useState(2);
  const [wReq, setWReq] = useState(false);
  const [rReq, setRReq] = useState(false);
  const [lastOp, setLastOp] = useState<string>('idle');
  const [vacuousCheck, setVacuousCheck] = useState(true);

  const full = count === 4;
  const empty = count === 0;

  const stepWrite = () => {
    if (!full) {
      setCount(c => c + 1);
      setLastOp('write');
      setVacuousCheck(false);
    }
  };

  const stepRead = () => {
    if (!empty) {
      setCount(c => c - 1);
      setLastOp('read');
      setVacuousCheck(false);
    }
  };

  const stepSimultaneous = () => {
    setLastOp('simultaneous');
    setVacuousCheck(false);
  };

  return (
    <div className="visualizer-box">
      <div className="vis-header">
        <div>
          <h4>FIFO SVA Property Evaluator & Vacuity Monitor</h4>
          <p>Real-time evaluation of pre-edge sampled assertions and antecedent coverage</p>
        </div>
        <div className="vis-actions">
          <button
            className="vis-btn secondary small"
            onClick={() => {
              setCount(0);
              setLastOp('reset');
            }}
          >
            Reset (Count=0)
          </button>
        </div>
      </div>

      <div className="fifo-layout">
        {/* Buffer visual */}
        <div className="fifo-slots-wrap">
          <span className="vis-panel-title">
            FIFO Buffer Occupancy ({count}/4 slots used)
          </span>
          <div className="fifo-slots">
            {[0, 1, 2, 3].map(slot => (
              <div
                key={slot}
                className={`fifo-slot ${slot < count ? 'occupied' : 'vacant'}`}
              >
                <span>Slot {slot}</span>
                <strong>{slot < count ? 'DATA' : 'EMPTY'}</strong>
              </div>
            ))}
          </div>
          <div className="fifo-controls">
            <button
              className="vis-btn primary small"
              disabled={full}
              onClick={stepWrite}
            >
              <Plus size={14} /> w_req && !full
            </button>
            <button
              className="vis-btn secondary small"
              disabled={empty}
              onClick={stepRead}
            >
              <Minus size={14} /> r_req && !empty
            </button>
            <button
              className="vis-btn secondary small"
              disabled={empty || full}
              onClick={stepSimultaneous}
            >
              Simultaneous Push & Pop
            </button>
          </div>
        </div>

        {/* Live Assertion Evaluation */}
        <div className="sva-assertions-panel">
          <span className="vis-panel-title">Active SVA Concurrent Property Monitors</span>
          <div className="assertion-item pass">
            <CheckCircle2 size={16} />
            <div>
              <code>assert property (count &lt;= 4);</code>
              <small>Status: PASS (count={count})</small>
            </div>
          </div>

          <div className="assertion-item pass">
            <CheckCircle2 size={16} />
            <div>
              <code>assert property (full == (count == 4));</code>
              <small>
                Status: PASS (full={full ? '1' : '0'}, count={count})
              </small>
            </div>
          </div>

          <div className="assertion-item pass">
            <CheckCircle2 size={16} />
            <div>
              <code>assert property (empty == (count == 0));</code>
              <small>
                Status: PASS (empty={empty ? '1' : '0'}, count={count})
              </small>
            </div>
          </div>

          <div className={`assertion-item ${vacuousCheck ? 'vacuous' : 'exercised'}`}>
            <Zap size={16} />
            <div>
              <code>w_accept &amp;&amp; r_accept |=&gt; count == $past(count);</code>
              <small>
                {vacuousCheck
                  ? 'Antecedent Vacuous: No simultaneous transfer yet'
                  : 'Exercised Non-Vacuously: Implication passed!'}
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 4. Valid / Ready Handshake Simulator
function HandshakeVisualizer() {
  const [valid, setValid] = useState(true);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState(0xa0);
  const [history, setHistory] = useState<
    { cycle: number; valid: boolean; ready: boolean; data: number; status: string }[]
  >([{ cycle: 0, valid: true, ready: false, data: 0xa0, status: 'Stall cycle' }]);

  const stepCycle = () => {
    const cycle = history.length;
    let status = 'Stall cycle';
    if (valid && ready) {
      status = 'Handshake Accepted!';
    } else if (!valid && ready) {
      status = 'Idle ready';
    } else if (!valid && !ready) {
      status = 'Idle';
    }
    setHistory(h => [
      ...h.slice(-5),
      { cycle, valid, ready, data, status },
    ]);
  };

  const mutateData = () => {
    setData(d => d + 1);
  };

  const isStall = valid && !ready;

  return (
    <div className="visualizer-box">
      <div className="vis-header">
        <div>
          <h4>AXI / Streaming Handshake Protocol & Stall Stability Simulator</h4>
          <p>Inspect valid/ready backpressure and stability assertion compliance</p>
        </div>
        <div className="vis-actions">
          <button className="vis-btn secondary small" onClick={mutateData}>
            Mutate Data (Simulate Bug)
          </button>
          <button className="vis-btn primary" onClick={stepCycle}>
            <Play size={14} /> Step Handshake Cycle
          </button>
        </div>
      </div>

      <div className="handshake-grid">
        <div className="sig-toggles">
          <button
            className={`vis-toggle ${valid ? 'active' : ''}`}
            onClick={() => setValid(!valid)}
          >
            <span>Producer valid: <strong>{valid ? '1' : '0'}</strong></span>
          </button>
          <button
            className={`vis-toggle ${ready ? 'active' : ''}`}
            onClick={() => setReady(!ready)}
          >
            <span>Consumer ready: <strong>{ready ? '1' : '0'}</strong></span>
          </button>
          <div className="data-display">
            <span>Payload Data:</span>
            <strong>0x{data.toString(16).toUpperCase()}</strong>
          </div>
        </div>

        <div className="handshake-status-card">
          <span className="vis-panel-title">Protocol State Machine</span>
          <div className={`status-pill ${valid && ready ? 'success' : isStall ? 'warning' : 'idle'}`}>
            {valid && ready
              ? 'Handshake Transfer Accepted (valid && ready)'
              : isStall
              ? 'Backpressure Stall: Payload must remain frozen!'
              : 'Idle Channel'}
          </div>
          <div className="sva-live-check">
            <code>
              assert property (valid &amp;&amp; !ready |=&gt; valid &amp;&amp; $stable(data));
            </code>
            <small>
              {isStall
                ? 'Active contract: Producer locked in stall commitment.'
                : 'Free to present new data upon next handshake.'}
            </small>
          </div>
        </div>
      </div>

      <div className="handshake-log">
        <span className="log-title">Recent Cycles:</span>
        <div className="log-entries">
          {history.map(h => (
            <div key={h.cycle} className="log-row">
              <span>Cycle #{h.cycle}</span>
              <span>valid={h.valid ? '1' : '0'}</span>
              <span>ready={h.ready ? '1' : '0'}</span>
              <span>data=0x{h.data.toString(16).toUpperCase()}</span>
              <strong>{h.status}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 5. Asynchronous CDC Gray Pointer Synchronizer
function CdcGrayVisualizer() {
  const [binPtr, setBinPtr] = useState(0);
  const [flop1, setFlop1] = useState(0);
  const [flop2, setFlop2] = useState(0);
  const [skewAlert, setSkewAlert] = useState(false);

  const bin2gray = (n: number) => n ^ (n >> 1);
  const grayPtr = bin2gray(binPtr);

  const incWritePtr = () => {
    setBinPtr(p => (p + 1) % 16);
  };

  const stepReadClk = () => {
    setFlop2(flop1);
    setFlop1(grayPtr);
  };

  const injectSkew = () => {
    setSkewAlert(true);
    setTimeout(() => setSkewAlert(false), 3000);
  };

  return (
    <div className="visualizer-box">
      <div className="vis-header">
        <div>
          <h4>Asynchronous CDC Dual-Flop Gray Pointer Synchronizer</h4>
          <p>Trace pointer transfer from clk_wr to clk_rd with 2-stage synchronizers</p>
        </div>
        <div className="vis-actions">
          <button className="vis-btn secondary small" onClick={injectSkew}>
            Simulate Bus Skew Hazard
          </button>
          <button className="vis-btn secondary" onClick={incWritePtr}>
            +1 Write Clock Step
          </button>
          <button className="vis-btn primary" onClick={stepReadClk}>
            <Play size={14} /> Read Clock Edge
          </button>
        </div>
      </div>

      {skewAlert && (
        <div className="vis-alert error">
          <AlertTriangle size={16} />
          <span>
            Physical Bus Skew Violation: Multi-bit transitions without set_bus_skew constraint!
          </span>
        </div>
      )}

      <div className="cdc-stages-diagram">
        <div className="cdc-domain write-domain">
          <span className="domain-label">Write Domain (clk_wr)</span>
          <div className="ptr-card">
            <small>Binary Pointer</small>
            <strong>{binPtr.toString(2).padStart(4, '0')} ({binPtr})</strong>
          </div>
          <div className="convert-arrow">
            <span>bin ^ (bin &gt;&gt; 1)</span>
            <ArrowRight size={14} />
          </div>
          <div className="ptr-card gray">
            <small>Gray Coded (Registered)</small>
            <strong>{grayPtr.toString(2).padStart(4, '0')}</strong>
          </div>
        </div>

        <div className="cdc-barrier">
          <span>CLOCK DOMAIN BOUNDARY</span>
          <div className="barrier-line" />
        </div>

        <div className="cdc-domain read-domain">
          <span className="domain-label">Read Domain (clk_rd)</span>
          <div className="flop-box">
            <small>Synchronizer Flop 1</small>
            <strong>{flop1.toString(2).padStart(4, '0')}</strong>
            <span>Settling window (MTBF)</span>
          </div>
          <ArrowRight size={16} />
          <div className="flop-box stable">
            <small>Synchronizer Flop 2 (Safe)</small>
            <strong>{flop2.toString(2).padStart(4, '0')}</strong>
            <span>Resolved to clk_rd</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 6. Reset Recovery and Removal Timing Simulator
function ResetTimingVisualizer() {
  const [sliderPos, setSliderPos] = useState(25); // 0 to 100

  // 40 to 60 is the metastable violation window
  const isViolation = sliderPos >= 40 && sliderPos <= 60;

  return (
    <div className="visualizer-box">
      <div className="vis-header">
        <div>
          <h4>Reset Recovery ($t_{'{'}rec{'}'}$) & Removal ($t_{'{'}rem{'}'}$) Timing Window</h4>
          <p>Slide the reset deassertion instant relative to the clock rising edge</p>
        </div>
      </div>

      <div className="timing-slider-wrap">
        <label>
          Reset Deassertion Point:{' '}
          <strong>{sliderPos < 40 ? 'Early (Safe)' : sliderPos > 60 ? 'Late (Safe)' : 'METASTABLE HAZARD!'}</strong>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={sliderPos}
          onChange={e => setSliderPos(Number(e.target.value))}
          className="timing-slider"
        />
      </div>

      <div className={`timing-status-banner ${isViolation ? 'violation' : 'clean'}`}>
        {isViolation ? (
          <>
            <AlertTriangle size={18} />
            <span>
              TIMING VIOLATION: Reset deasserted within the flip-flop recovery/removal window! Flops may enter metastability or resolve on differing cycles.
            </span>
          </>
        ) : (
          <>
            <ShieldCheck size={18} />
            <span>
              CLEAN DEASSERTION: Reset released synchronously outside the forbidden setup/hold window.
            </span>
          </>
        )}
      </div>

      <div className="timing-diagram-graphic">
        <svg viewBox="0 0 500 140" className="timing-svg">
          {/* Clock Waveform */}
          <text x="10" y="35" fill="#8da17b" fontSize="11" fontFamily="monospace">
            clk
          </text>
          <path
            d="M 60 40 L 150 40 L 150 15 L 240 15 L 240 40 L 330 40 L 330 15 L 420 15 L 420 40 L 480 40"
            fill="none"
            stroke="#d3efac"
            strokeWidth="2"
          />

          {/* Metastability Window Shading around rising edge at x=240 */}
          <rect x="210" y="10" width="60" height="110" fill="rgba(240, 80, 80, 0.15)" stroke="red" strokeDasharray="3 3" />
          <text x="240" y="130" textAnchor="middle" fill="#ff7b72" fontSize="9" fontFamily="monospace">
            Forbidden Window [t_rec .. t_rem]
          </text>

          {/* Reset Deassertion Edge */}
          <text x="10" y="85" fill="#8da17b" fontSize="11" fontFamily="monospace">
            rst_n
          </text>
          <path
            d={`M 60 95 L ${100 + sliderPos * 2.8} 95 L ${100 + sliderPos * 2.8} 70 L 480 70`}
            fill="none"
            stroke="#a7bb8e"
            strokeWidth="2.5"
          />
        </svg>
      </div>
    </div>
  );
}

// 7. Round-Robin Arbiter Token Ring Simulator
function ArbiterVisualizer() {
  const [requests, setRequests] = useState([true, false, true, false]);
  const [priorityPtr, setPriorityPtr] = useState(0);
  const [grants, setGrants] = useState([false, false, false, false]);

  const toggleReq = (idx: number) => {
    const next = [...requests];
    next[idx] = !next[idx];
    setRequests(next);
  };

  const stepArbiter = () => {
    // Find first active request starting from priorityPtr
    let winner = -1;
    for (let i = 0; i < 4; i++) {
      const candidate = (priorityPtr + i) % 4;
      if (requests[candidate]) {
        winner = candidate;
        break;
      }
    }

    if (winner !== -1) {
      const nextGrants = [false, false, false, false];
      nextGrants[winner] = true;
      setGrants(nextGrants);
      setPriorityPtr((winner + 1) % 4);
    } else {
      setGrants([false, false, false, false]);
    }
  };

  return (
    <div className="visualizer-box">
      <div className="vis-header">
        <div>
          <h4>Rotating Priority Round-Robin Arbiter</h4>
          <p>Interactive 4-client arbiter with rotating priority mask and starvation prevention</p>
        </div>
        <div className="vis-actions">
          <button className="vis-btn primary" onClick={stepArbiter}>
            <Play size={14} /> Arbitrate Next Cycle
          </button>
        </div>
      </div>

      <div className="arbiter-grid">
        {[0, 1, 2, 3].map(client => (
          <div
            key={client}
            className={`client-card ${grants[client] ? 'granted' : ''} ${priorityPtr === client ? 'has-priority' : ''}`}
          >
            <div className="client-header">
              <span>Client #{client}</span>
              {priorityPtr === client && <span className="prio-tag">Priority #1</span>}
            </div>
            <button
              className={`vis-toggle ${requests[client] ? 'active' : ''}`}
              onClick={() => toggleReq(client)}
            >
              req[{client}]: <strong>{requests[client] ? 'Active' : 'Idle'}</strong>
            </button>
            <div className="grant-indicator">
              <span>grant[{client}]:</span>
              <strong>{grants[client] ? 'GRANTED' : '0'}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 8. Credit-Based Flow Control Simulator
function CreditFlowVisualizer() {
  const [credits, setCredits] = useState(8);
  const [forwardPipe, setForwardPipe] = useState<number[]>([0, 0, 0, 0]);
  const [rxBuffer, setRxBuffer] = useState<number[]>([]);
  const [returnPipe, setReturnPipe] = useState<number[]>([0, 0, 0, 0]);

  const sendFlit = () => {
    if (credits > 0) {
      setCredits(c => c - 1);
      setForwardPipe(p => [1, p[0], p[1], p[2]]);
    }
  };

  const stepCycle = () => {
    // Advance forward pipeline
    const arrivingFlit = forwardPipe[3];
    const nextForward = [0, forwardPipe[0], forwardPipe[1], forwardPipe[2]];

    // Advance reverse pipeline
    const returningCredit = returnPipe[3];
    const nextReturn = [0, returnPipe[0], returnPipe[1], returnPipe[2]];

    // If credit returned to TX, increment credit counter
    if (returningCredit > 0) {
      setCredits(c => c + returningCredit);
    }

    // If flit arrived at RX buffer
    let nextRx = [...rxBuffer];
    if (arrivingFlit > 0) {
      nextRx.push(1);
    }

    setForwardPipe(nextForward);
    setReturnPipe(nextReturn);
    setRxBuffer(nextRx);
  };

  const processRxFlit = () => {
    if (rxBuffer.length > 0) {
      setRxBuffer(r => r.slice(1));
      setReturnPipe(p => [1, p[0], p[1], p[2]]);
    }
  };

  const totalConservation =
    credits +
    forwardPipe.reduce((a, b) => a + b, 0) +
    rxBuffer.length +
    returnPipe.reduce((a, b) => a + b, 0);

  return (
    <div className="visualizer-box">
      <div className="vis-header">
        <div>
          <h4>NVLink / PCIe Credit-Based Flow Control Pipeline</h4>
          <p>Real-time credit tracking across multi-cycle round-trip flight delays</p>
        </div>
        <div className="vis-actions">
          <button className="vis-btn secondary small" disabled={credits === 0} onClick={sendFlit}>
            Send Flit ({credits} credits left)
          </button>
          <button
            className="vis-btn secondary small"
            disabled={rxBuffer.length === 0}
            onClick={processRxFlit}
          >
            Process & Return Credit
          </button>
          <button className="vis-btn primary" onClick={stepCycle}>
            <Play size={14} /> Step Interconnect Cycle
          </button>
        </div>
      </div>

      <div className="credit-conservation-bar">
        <span>Credit Conservation Invariant:</span>
        <strong>
          {credits} (TX) + {forwardPipe.reduce((a, b) => a + b, 0)} (Forward) + {rxBuffer.length} (RX Buffer) + {returnPipe.reduce((a, b) => a + b, 0)} (Return) = {totalConservation} / 8
        </strong>
      </div>

      <div className="credit-topology">
        <div className="pipe-box tx">
          <span className="pipe-title">Transmitter</span>
          <div className="credit-counter">
            <small>Credits Available</small>
            <strong>{credits}</strong>
          </div>
        </div>

        <div className="pipe-box forward">
          <span className="pipe-title">Forward Flit Pipeline (4 cycles)</span>
          <div className="pipe-stages">
            {forwardPipe.map((flit, i) => (
              <span key={i} className={`stage-dot ${flit ? 'active' : ''}`}>
                {flit ? 'FLIT' : '—'}
              </span>
            ))}
          </div>
        </div>

        <div className="pipe-box rx">
          <span className="pipe-title">Receiver Buffer</span>
          <div className="rx-occupancy">
            <small>Occupancy: {rxBuffer.length}/8</small>
            <div className="rx-dots">
              {[...Array(8)].map((_, i) => (
                <div key={i} className={`rx-slot ${i < rxBuffer.length ? 'filled' : ''}`} />
              ))}
            </div>
          </div>
        </div>

        <div className="pipe-box reverse">
          <span className="pipe-title">Reverse Credit Return Pipe (4 cycles)</span>
          <div className="pipe-stages">
            {returnPipe.map((c, i) => (
              <span key={i} className={`stage-dot credit ${c ? 'active' : ''}`}>
                {c ? 'CRD' : '—'}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 9. UVM Phase and Objection Lifecycle
function UvmPhaseVisualizer() {
  const [objections, setObjections] = useState(1);
  const [phaseIndex, setPhaseIndex] = useState(2);
  const phases = ['build_phase', 'connect_phase', 'run_phase', 'check_phase', 'report_phase'];

  const raise = () => setObjections(o => o + 1);
  const drop = () => setObjections(o => Math.max(0, o - 1));

  const advancePhase = () => {
    if (objections === 0) {
      setPhaseIndex(p => Math.min(phases.length - 1, p + 1));
      if (phaseIndex + 1 === 2) setObjections(1);
    }
  };

  return (
    <div className="visualizer-box">
      <div className="vis-header">
        <div>
          <h4>UVM Phasing & Objection Lifecycle Inspector</h4>
          <p>Inspect phase progression and avoid premature test termination</p>
        </div>
        <div className="vis-actions">
          <button className="vis-btn secondary small" onClick={raise}>
            + Raise Objection
          </button>
          <button className="vis-btn secondary small" disabled={objections === 0} onClick={drop}>
            - Drop Objection
          </button>
          <button className="vis-btn primary" disabled={objections > 0} onClick={advancePhase}>
            Advance Phase
          </button>
        </div>
      </div>

      <div className="uvm-phase-track">
        {phases.map((p, idx) => (
          <div
            key={p}
            className={`phase-node ${idx < phaseIndex ? 'done' : idx === phaseIndex ? 'active' : ''}`}
          >
            <span>0{idx + 1}</span>
            <strong>{p}</strong>
          </div>
        ))}
      </div>

      <div className="objection-status-box">
        <span className="vis-panel-title">Active Objection Count: {objections}</span>
        {objections > 0 ? (
          <div className="vis-alert info">
            <Zap size={15} />
            <span>Phase is LOCKED: Cannot progress to check_phase until all objections drop.</span>
          </div>
        ) : (
          <div className="vis-alert warning">
            <AlertTriangle size={15} />
            <span>Objections reached ZERO! Drain timer starts. Test will shut down immediately if no drain time set!</span>
          </div>
        )}
      </div>
    </div>
  );
}

// 10. Cache Coherence MESI Simulator
function CacheCoherenceVisualizer() {
  const [core0, setCore0] = useState<'M' | 'E' | 'S' | 'I'>('I');
  const [core1, setCore1] = useState<'M' | 'E' | 'S' | 'I'>('I');
  const [busLog, setBusLog] = useState<string>('System idle. Address 0x1000 in memory.');

  const core0Read = () => {
    if (core1 === 'M') {
      setCore1('S');
      setCore0('S');
      setBusLog('Core 0 Read: Core 1 in Modified state intervened, flushed to DRAM, both become Shared (S)');
    } else if (core1 === 'S' || core1 === 'E') {
      setCore1('S');
      setCore0('S');
      setBusLog('Core 0 Read: Line is already shared or exclusive in Core 1; both become Shared (S)');
    } else {
      setCore0('E');
      setBusLog('Core 0 Read: Miss in Core 1. Core 0 acquires Exclusive (E)');
    }
  };

  const core0Write = () => {
    setCore0('M');
    setCore1('I');
    setBusLog('Core 0 Write: Invalidation broadcast sent over snoop crossbar. Core 1 invalidated (I), Core 0 becomes Modified (M)');
  };

  const core1Read = () => {
    if (core0 === 'M') {
      setCore0('S');
      setCore1('S');
      setBusLog('Core 1 Read: Core 0 intervened from Modified, flushed to DRAM, both become Shared (S)');
    } else if (core0 === 'S' || core0 === 'E') {
      setCore0('S');
      setCore1('S');
      setBusLog('Core 1 Read: Line present in Core 0. Both become Shared (S)');
    } else {
      setCore1('E');
      setBusLog('Core 1 Read: Miss in Core 0. Core 1 acquires Exclusive (E)');
    }
  };

  const core1Write = () => {
    setCore1('M');
    setCore0('I');
    setBusLog('Core 1 Write: Invalidation broadcast sent over snoop crossbar. Core 0 invalidated (I), Core 1 becomes Modified (M)');
  };

  return (
    <div className="visualizer-box">
      <div className="vis-header">
        <div>
          <h4>MESI Cache Coherence Protocol Simulator</h4>
          <p>Address 0x1000 snoop invalidation and state transitions</p>
        </div>
      </div>

      <div className="coherence-grid">
        <div className="core-cache-card">
          <span className="core-title">GPU Core #0 L1 Cache</span>
          <div className={`mesi-badge state-${core0}`}>State: {core0}</div>
          <div className="core-actions">
            <button className="vis-btn secondary small" onClick={core0Read}>
              Read 0x1000
            </button>
            <button className="vis-btn primary small" onClick={core0Write}>
              Write 0x1000
            </button>
          </div>
        </div>

        <div className="snoop-bus-card">
          <span className="bus-title">Shared Snoop Bus / Interconnect</span>
          <p className="bus-log">{busLog}</p>
        </div>

        <div className="core-cache-card">
          <span className="core-title">GPU Core #1 L1 Cache</span>
          <div className={`mesi-badge state-${core1}`}>State: {core1}</div>
          <div className="core-actions">
            <button className="vis-btn secondary small" onClick={core1Read}>
              Read 0x1000
            </button>
            <button className="vis-btn primary small" onClick={core1Write}>
              Write 0x1000
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

