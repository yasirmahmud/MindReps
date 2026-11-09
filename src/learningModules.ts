import type { TopicId } from './content';

export type InteractiveType =
  | 'waveform-queue'
  | 'concurrency-mailbox'
  | 'fifo-assertion'
  | 'handshake-stall'
  | 'cdc-gray-sync'
  | 'reset-recovery'
  | 'arbiter-round-robin'
  | 'credit-flow'
  | 'uvm-phase-objection'
  | 'cache-coherence';

export type ModuleSection = {
  id: string;
  title: string;
  content: string;
  code?: string;
  codeLang?: string;
  codeNotes?: string;
  callout?: {
    type: 'nvidia-tip' | 'gotcha' | 'silicon-bug' | 'interview-insight';
    title: string;
    body: string;
  };
};

export type LearningModule = {
  id: string;
  topic: TopicId;
  topicName: string;
  level: 'Advanced' | 'Senior DV' | 'Staff DV';
  title: string;
  subtitle: string;
  estimatedMinutes: number;
  summary: string;
  architectureDiagramTitle: string;
  interactiveType: InteractiveType;
  interactiveTitle: string;
  interactiveSubtitle: string;
  interactiveInstructions: string;
  keyConcepts: { title: string; description: string; tag: string }[];
  sections: ModuleSection[];
  nvidiaRelevance: {
    interviewContext: string;
    keyQuestionsAsked: string[];
    whatInterviewersLookFor: string;
  };
  references: { title: string; url: string; note: string }[];
};

export const learningModules: LearningModule[] = [
  {
    id: 'mod-sv-queue',
    topic: 'sv',
    topicName: 'SystemVerilog & RTL',
    level: 'Advanced',
    title: 'Queue Occupancy & Nonblocking Delta-Cycle Dynamics',
    subtitle: 'RHS evaluation order, assignment overrides, and atomic state updates under simultaneous push/pop',
    estimatedMinutes: 15,
    summary:
      'Master the simulation event regions of SystemVerilog and understand why naive counter updates in RTL fail during simultaneous push/pop. Learn to design atomic next-state logic and verify interface acceptance contracts.',
    architectureDiagramTitle: 'Synchronous FIFO Queue Control & Delta-Cycle Scheduler',
    interactiveType: 'waveform-queue',
    interactiveTitle: 'Delta-Cycle & Nonblocking Assignment Waveform Simulator',
    interactiveSubtitle: 'Step through clock cycles and compare buggy sequential updates against atomic single-assignment logic',
    interactiveInstructions:
      'Toggle push and pop inputs, step clock cycles, and observe the scheduled updates. Notice how two nonblocking assignments in the same process evaluate with old state before scheduling, causing the later assignment to silently overwrite the earlier one.',
    keyConcepts: [
      {
        title: 'Nonblocking (<=) Two-Phase Semantics',
        description: 'Right-hand side expressions evaluate in the Active region using sampled pre-edge state; left-hand assignments commit in the NBA region.',
        tag: 'IEEE 1800-2017',
      },
      {
        title: 'Single-Process Assignment Overrides',
        description: 'Within a single always_ff block, if multiple nonblocking assignments target the same variable, the last evaluated assignment wins.',
        tag: 'Scheduling',
      },
      {
        title: 'Request vs Acceptance Separation',
        description: 'Never compute occupancy from raw requests. Only accepted handshakes (push_req && !full, pop_req && !empty) may advance pointers.',
        tag: 'Microarchitecture',
      },
    ],
    sections: [
      {
        id: 'scheduling-physics',
        title: '1. The SystemVerilog Stratified Event Queue',
        content: `In SystemVerilog, understanding how hardware synthesizes and how the IEEE standard simulates is critical for senior verification engineers. 

When you write:
\`\`\`systemverilog
always_ff @(posedge clk) begin
  if (push) count <= count + 1'b1;
  if (pop)  count <= count - 1'b1;
end
\`\`\`
Consider what happens when \`count = 3\` and both \`push\` and \`pop\` are asserted simultaneously:
1. In the **Active Region**, the first \`if\` evaluates \`count + 1\` using the old state (\`3 + 1 = 4\`) and schedules \`count <= 4\` into the **NBA Region**.
2. Immediately in the same process, the second \`if\` evaluates \`count - 1\` using the same old state (\`3 - 1 = 2\`) and schedules \`count <= 2\` into the **NBA Region**.
3. In the **NBA Region**, both assignments are retrieved. Because SystemVerilog mandates that statements within a sequential block execute in text order, the update scheduled by the second statement replaces the update from the first statement!
4. The settled count is **2**, not 3! A push was completely lost, corrupting FIFO occupancy and creating silicon silent data corruption.`,
        code: `// BUGGY IMPLEMENTATION - Silent update overwrite
always_ff @(posedge clk or negedge rst_n) begin
  if (!rst_n) begin
    count <= '0;
  end else begin
    if (push_req && !full) count <= count + 1'b1;
    if (pop_req && !empty) count <= count - 1'b1; // Overwrites push!
  end
end

// GOLDEN VERIFIED IMPLEMENTATION - Atomic next-state logic
always_ff @(posedge clk or negedge rst_n) begin
  if (!rst_n) begin
    count <= '0;
  end else begin
    unique case ({push_accept, pop_accept})
      2'b10:   count <= count + 1'b1; // Push only
      2'b01:   count <= count - 1'b1; // Pop only
      default: count <= count;        // Idle or simultaneous (hold occupancy)
    endcase
  end
end`,
        codeLang: 'systemverilog',
        codeNotes: 'Atomic case selection guarantees only one assignment is scheduled per clock cycle.',
        callout: {
          type: 'nvidia-tip',
          title: 'NVIDIA Hardware Verification Standard',
          body: 'NVIDIA silicon teams mandate single-assignment coding styles for state variables. Multiple nonblocking assignments to the same register in one procedural block trigger lint errors in SpyGlass and formal compilation flags.',
        },
      },
      {
        id: 'acceptance-contracts',
        title: '2. Contract Definition: Requests vs Accepted Operations',
        content: `A common junior mistake in design verification is assuming that interface inputs directly translate into internal state transitions. In production microarchitectures (such as GPU warp queues or memory controller command buffers), interface signals are **requests**.

The protocol contract must explicitly govern:
- **Conservation of Occupancy**: When both push and pop occur simultaneously, occupancy remains identical (\`count\` holds), but read and write pointers both increment!
- **Boundary Condition (Full)**: At full (\`count == DEPTH\`), does the queue support *simultaneous replacement* (popping the oldest item while writing a new item into the freed slot)?
  - If yes: \`push_accept = push_req && (!full || pop_accept)\`.
  - If no: \`push_accept = push_req && !full\`.
- **Boundary Condition (Empty)**: At empty (\`count == 0\`), does the queue support zero-cycle *bypass*? Standard non-bypass FIFOs require \`pop_accept = pop_req && !empty\`.`,
        code: `// Verification Assertion Checker for Simultaneous Handshakes
property p_simultaneous_transfer_occupancy;
  @(posedge clk) disable iff (!rst_n)
  (push_accept && pop_accept) |=> (count == $past(count));
endproperty
assert property (p_simultaneous_transfer_occupancy)
  else $error("Violation: Simultaneous transfer altered queue occupancy!");

// Cover property ensuring stimulus reaches simultaneous corner case
cover property (@(posedge clk) disable iff (!rst_n) (push_accept && pop_accept && (count == DEPTH - 1)));`,
        codeLang: 'systemverilog',
        callout: {
          type: 'silicon-bug',
          title: 'Real Silicon Bug Postmortem',
          body: 'In an interconnect credit return queue, simultaneous enqueue and dequeue during high packet saturation caused counter drift. Over 10 million cycles, the counter underflowed to 4\'hF, causing the queue to drop packet backpressure and leading to packet collision in the fabric.',
        },
      },
    ],
    nvidiaRelevance: {
      interviewContext:
        'This is one of NVIDIA’s classic screening problems for ASIC / DV engineers. Candidates are asked to write or debug a queue counter with simultaneous push and pop, and explain delta cycles and simulation semantics.',
      keyQuestionsAsked: [
        'What is the settled value if count=3, push=1, pop=1 in two separate if statements?',
        'How does the IEEE 1800 event scheduler order Active, Inactive, and NBA regions?',
        'How do you write an SVA property to prove occupancy bounds under all traffic patterns?',
      ],
      whatInterviewersLookFor:
        'Depth of understanding of simulation regions (Active vs NBA), ability to spot priority encoding bugs, and clean separation between interface requests and accepted transactions.',
    },
    references: [
      {
        title: 'IEEE 1800-2017 SystemVerilog LRM (Section 4: Event Scheduling)',
        url: 'https://standards.ieee.org/ieee/1800/6705/',
        note: 'Official specification of event queues and regions',
      },
      {
        title: 'lowRISC SystemVerilog Coding Style Guide',
        url: 'https://github.com/lowRISC/style-guides/blob/master/VerilogCodingStyle.md',
        note: 'Industry practices for clean single-assignment sequential RTL',
      },
    ],
  },
  {
    id: 'mod-sv-concurrency',
    topic: 'sv',
    topicName: 'SystemVerilog & RTL',
    level: 'Senior DV',
    title: 'OOP Transaction Handles, Concurrency & Memory Ownership',
    subtitle: 'Dynamic class allocation, fork..join_none variable capture, and shallow vs deep copy in UVM testbenches',
    estimatedMinutes: 20,
    summary:
      'Unravel the subtleties of SystemVerilog OOP object handles versus object data. Learn how loop variables in fork..join_none trigger subtle testbench races, and how improper object cloning causes transaction corruption across verification subscribers.',
    architectureDiagramTitle: 'UVM Testbench Thread Topology: Producers, Mailboxes & Monitors',
    interactiveType: 'concurrency-mailbox',
    interactiveTitle: 'Fork-Join & Transaction Handle Memory Inspector',
    interactiveSubtitle: 'Step through thread spawning to visualize stack handles versus heap allocated memory',
    interactiveInstructions:
      'Compare what happens when 3 concurrent threads share a single class handle reference versus allocating independent objects. Notice how mutating fields on a shared handle corrupts previous transactions already enqueued in the analysis FIFO or mailbox.',
    keyConcepts: [
      {
        title: 'Class Handle vs Object Instance',
        description: 'Variables of class type are pointer handles, not objects. Assigning or passing handles copies the reference, not the payload.',
        tag: 'OOP',
      },
      {
        title: 'fork..join_none Variable Capture',
        description: 'Loop counters must be captured into automatic local variables; otherwise all spawned threads read the final post-loop counter value.',
        tag: 'Threads',
      },
      {
        title: 'Analysis Port Ownership Contract',
        description: 'Components publishing through uvm_analysis_port must either treat transactions as immutable or provide deep copies to subscribers.',
        tag: 'UVM Guidelines',
      },
    ],
    sections: [
      {
        id: 'handle-aliasing',
        title: '1. The Handle Aliasing Trap in UVM Testbenches',
        content: `In SystemVerilog, declaring \`txn t;\` creates a class variable that holds a **handle** (a reference), initialized to \`null\`. Calling \`t = new()\` allocates storage on the heap.

When a driver or monitor loops:
\`\`\`systemverilog
mailbox #(txn) mb = new();
txn t = new(); // ONLY ONE OBJECT ALLOCATED!
initial begin
  for (int i = 0; i < 3; i++) begin
    automatic int k = i;
    fork
      begin
        t.data = k; // Overwrites the same heap memory!
        mb.put(t);  // Puts the SAME handle into the mailbox!
      end
    join_none
  end
  wait fork;
end
\`\`\`
What happens when the receiver calls \`mb.get(rx_t)\` three times after \`wait fork\`?
- All three mailbox slots contain the **exact same pointer address**.
- The \`data\` field in that single object will be whichever worker wrote last (0, 1, or 2).
- The receiver inspects 3 transactions and sees identical data in all of them!
- Even worse: \`mb.get()\` does NOT clone objects; it merely copies the handle from the mailbox into the local variable!`,
        code: `// CORRECT PATTERN: Fresh instance per concurrent transaction
for (int i = 0; i < 3; i++) begin
  automatic int k = i;
  fork
    begin
      txn local_t = new(); // Unique allocation on heap
      local_t.data = k;
      mb.put(local_t);     // Unique handle published
    end
  join_none
end
wait fork;`,
        codeLang: 'systemverilog',
        codeNotes: 'Each worker owns its allocated memory and safely publishes immutable data.',
        callout: {
          type: 'gotcha',
          title: 'Shallow Copy vs Deep Copy Gotcha',
          body: 'Using the shallow copy operator `t2 = new t1;` only copies primitive members. Any nested class handle (such as a payload object or header sub-packet) is shared between t1 and t2! In UVM, always implement and call `do_copy()` for recursive deep copies.',
        },
      },
      {
        id: 'uvm-transaction-flow',
        title: '2. UVM Driver/Monitor Ownership Conventions',
        content: `In production NVIDIA verification environments, multiple analysis subscribers (scoreboards, functional coverage collectors, transaction loggers) subscribe to the monitor's analysis port.

To avoid race conditions:
1. **Producer-allocates rule**: The monitor allocates a new transaction object for every observed bus transfer before calling \`analysis_port.write(item)\`.
2. **Subscriber-clones rule**: If a subscriber stores transactions in a persistent queue to compare later, it must call \`$cast(stored_item, item.clone())\` to safeguard against buggy monitors that reuse memory.`,
        code: `// Production UVM Monitor Write Pattern
virtual task monitor_bus();
  forever begin
    bus_txn item;
    @(posedge vif.clk iff (vif.valid && vif.ready));
    item = bus_txn::type_id::create("item");
    item.addr = vif.addr;
    item.data = vif.data;
    item.timestamp = $time;
    ap.write(item); // Broadcast to all scoreboards
  end
endtask`,
        codeLang: 'systemverilog',
        callout: {
          type: 'nvidia-tip',
          title: 'NVIDIA Coding Guidelines',
          body: 'Never reuse transaction objects across clock cycles in monitors. The micro-overhead of UVM factory allocation is dwarfed by the engineering time wasted debugging aliased memory corruption in large regressions.',
        },
      },
    ],
    nvidiaRelevance: {
      interviewContext:
        'NVIDIA testbench architects frequently probe OOP concurrency bugs. Interviewers present code snippets with fork..join_none and ask candidates to predict object values and memory layouts.',
      keyQuestionsAsked: [
        'What is the difference between shallow copy (new) and deep copy (clone)?',
        'Why does a mailbox get() not protect against race conditions when a producer modifies fields?',
        'Explain what happens if automatic is omitted from a loop variable inside fork..join_none.',
      ],
      whatInterviewersLookFor:
        'Clarity on heap vs stack, garbage collection rules, thread lifetime in fork..join_none, and defensive copying in UVM analysis components.',
    },
    references: [
      {
        title: 'Accellera UVM 1.2 User Guide (Transaction Recording & Copying)',
        url: 'https://accellera.org/downloads/standards/uvm',
        note: 'Guidelines for transaction lifecycle and memory management',
      },
    ],
  },
  {
    id: 'mod-sva-fifo',
    topic: 'sva',
    topicName: 'Assertions & Formal',
    level: 'Advanced',
    title: 'Formal & Dynamic SVA Assertions for High-Throughput FIFOs',
    subtitle: 'Pre-edge sampling, implication vacuity, symbolic data integrity, and latency-aware order checking',
    estimatedMinutes: 20,
    summary:
      'Learn how to write exhaustive concurrent assertions for FIFO data paths. Master the distinction between overlapping (|->) and non-overlapping (|=>) implication, eliminate vacuous passes, and prove data ordering independently of occupancy.',
    architectureDiagramTitle: 'Synchronous FIFO Assertion Hierarchy & Sampling Points',
    interactiveType: 'fifo-assertion',
    interactiveTitle: 'Interactive SVA Pre-Edge Sampler & Vacuity Monitor',
    interactiveSubtitle: 'Inspect how concurrent assertions evaluate in the Preponed region before register updates occur',
    interactiveInstructions:
      'Drive write requests, read requests, and reset. Watch the live assertion evaluator test occupancy bounds, flag equivalence, and one-cycle transition checks. Observe the vacuity indicator showing when implications pass vacuously.',
    keyConcepts: [
      {
        title: 'Preponed Region Sampling',
        description: 'Concurrent assertions sample values in the Preponed region immediately prior to the clock edge, completely isolating them from active nonblocking updates.',
        tag: 'Sampling',
      },
      {
        title: 'Non-Overlapped Implication (|=>)',
        description: 'Antecedent evaluates on clock cycle n; consequent evaluation begins on cycle n+1. Essential for registered state transitions.',
        tag: 'SVA Semantics',
      },
      {
        title: 'Vacuous Success Prevention',
        description: 'Implication p |-> q evaluates to true if p is false. Always accompany every critical assert property with a cover property on the antecedent.',
        tag: 'Verification Rigor',
      },
    ],
    sections: [
      {
        id: 'sva-temporal-logic',
        title: '1. SVA Sampling Semantics & Implication Mechanics',
        content: `Concurrent assertions evaluate expressions in the **Observed region**, but their values are sampled in the **Preponed region** (before any events execute on that time step).

When asserting state transitions:
\`\`\`systemverilog
// If write accepted without read, next count MUST increment
assert property (@(posedge clk) disable iff (!rst_n)
  (w_accept && !r_accept) |=> (count == $past(count) + 1'b1));
\`\`\`
Why do we use \`|=>\` rather than \`|->\`?
- \`|->\` (overlapped): The consequent is checked at the **same clock edge**. But in hardware, \`count\` is registered; the new value is only clocked into registers on the next cycle!
- \`|=>\` (non-overlapped): The antecedent matches at cycle \`n\`, and the consequent obligation is checked at cycle \`n+1\`.
- \`$past(count)\`: Evaluated at cycle \`n+1\`, returning the sampled value of \`count\` at cycle \`n\`.`,
        code: `// Exhaustive Synchronous FIFO SVA Suite
module fifo_sva_checker #(parameter DEPTH = 8) (
  input logic clk,
  input logic rst_n,
  input logic w_req,
  input logic w_accept,
  input logic r_req,
  input logic r_accept,
  input logic full,
  input logic empty,
  input logic [$clog2(DEPTH+1)-1:0] count
);

  default clocking cb @(posedge clk); endclocking
  default disable iff (!rst_n);

  // 1. Invariant Range & Flag Equivalence
  assert property (count <= DEPTH)
    else $error("FIFO overflow: count exceeded depth!");
  assert property (full  == (count == DEPTH));
  assert property (empty == (count == 0));

  // 2. State Transitions
  assert property (w_accept && !r_accept |=> count == $past(count) + 1'b1);
  assert property (!w_accept && r_accept |=> count == $past(count) - 1'b1);
  assert property (w_accept == r_accept  |=> count == $past(count));

  // 3. Vacuity Prevention (Cover properties for triggers)
  cover property (w_accept && !r_accept);
  cover property (!w_accept && r_accept);
  cover property (w_accept && r_accept && count == DEPTH - 1);
endmodule`,
        codeLang: 'systemverilog',
        callout: {
          type: 'silicon-bug',
          title: 'The "Vacuous Pass" Silicon Bug',
          body: 'A verification team rejoiced when 200 FIFO assertions passed 100% in regression. Post-silicon testing suffered catastrophic FIFO overflow. Investigation revealed that the reset signal was accidentally inverted in the testbench harness, causing `disable iff (!rst_n)` to disable all checks during every cycle!',
        },
      },
      {
        id: 'formal-data-integrity',
        title: '2. Proving Data Integrity & Order (Beyond Occupancy)',
        content: `A FIFO with a perfectly functioning counter can still corrupt, drop, duplicate, or reorder data! Occupancy alone does not prove data integrity.

In formal verification (JasperGold / VC Formal), we verify data integrity using **symbolic data tagging**:
1. Introduce a free symbolic constant \`TAG_DATA\`.
2. Nondeterministically choose one write cycle when \`w_data == TAG_DATA\`.
3. Assert that:
   - Exactly one read cycle delivers \`TAG_DATA\`.
   - The number of reads before this item matches the number of unread items already in the FIFO when the tagged item was pushed (proving strict FIFO ordering).`,
        code: `// Formal Verification Auxiliary Queue for Dynamic Checking
// In dynamic simulation, maintain an auxiliary queue in the checker
logic [DATA_WIDTH-1:0] ref_queue[$];

always_ff @(posedge clk or negedge rst_n) begin
  if (!rst_n) begin
    ref_queue.delete();
  end else begin
    if (w_accept) ref_queue.push_back(w_data);
    if (r_accept) begin
      assert(ref_queue.size() > 0) else $error("Underflow on ref queue");
      assert(r_data == ref_queue.pop_front())
        else $error("Data mismatch! Expected %0h, got %0h", ref_queue[0], r_data);
    end
  end
end`,
        codeLang: 'systemverilog',
        callout: {
          type: 'nvidia-tip',
          title: 'NVIDIA Interview Follow-up',
          body: 'When asked how to verify a FIFO, never stop at checking full/empty flags and counters. Always explain how you prove data integrity, latency matching, and out-of-reset recovery.',
        },
      },
    ],
    nvidiaRelevance: {
      interviewContext:
        'FIFO verification is NVIDIA’s #1 design verification technical topic. Almost every candidate for ASIC DV / Formal Verification is asked to write properties for a FIFO.',
      keyQuestionsAsked: [
        'Write SVA properties for occupancy transition when push and pop both occur.',
        'Why does assert property (req |-> ##[1:5] ack) passing not guarantee the handshake was tested?',
        'How do you prove in formal verification that a FIFO never drops or swaps words?',
      ],
      whatInterviewersLookFor:
        'Mastery of temporal operators ($past, |->, |=>), disable iff caveats, antecedent coverage, and reference queues for payload integrity.',
    },
    references: [
      {
        title: 'Accellera SystemVerilog Assertions (SVA) Tutorial',
        url: 'https://www.accellera.org/resources/videos/systemverilog-assertions-tutorial-2016',
        note: 'Best practices for writing synthesizable and formal SVA',
      },
    ],
  },
  {
    id: 'mod-sva-handshake',
    topic: 'sva',
    topicName: 'Assertions & Formal',
    level: 'Staff DV',
    title: 'Valid/Ready Handshake & Backpressure Protocol Stability',
    subtitle: 'AXI/Streaming channel invariants, forward/backward dependency hazards, and temporal stall assertions',
    estimatedMinutes: 20,
    summary:
      'Master the verification of AMBA AXI and streaming valid/ready handshake channels. Learn the exact stability rules required when backpressure stalls occur, identify legal versus illegal combinational loops, and write robust checkers.',
    architectureDiagramTitle: 'AXI / Streaming Handshake Channel & Backpressure Stall State Machine',
    interactiveType: 'handshake-stall',
    interactiveTitle: 'Valid/Ready Waveform Simulator & Backpressure Checker',
    interactiveSubtitle: 'Toggle valid and ready signals to visualize cycle-by-cycle stall obligations and stability assertions',
    interactiveInstructions:
      'Control valid and ready states. Observe how an asserted valid with low ready creates an unbroken temporal contract: neither valid nor payload data may mutate until the cycle when ready is sampled high.',
    keyConcepts: [
      {
        title: 'Handshake Acceptance Rule',
        description: 'A transaction transfers if and only if valid AND ready are sampled high at the active clock edge.',
        tag: 'AMBA AXI',
      },
      {
        title: 'Stall Stability Invariant',
        description: 'Once valid is asserted, the source CANNOT deassert valid or change data until the cycle after a successful handshake.',
        tag: 'Protocol Rule',
      },
      {
        title: 'No Ready-Depends-On-Valid Combinational Paths',
        description: 'To avoid deadlocks across interconnected IP cores, ready must never combinatorially wait for valid.',
        tag: 'Microarchitecture',
      },
    ],
    sections: [
      {
        id: 'stall-stability-mechanics',
        title: '1. The Handshake Stability Obligation',
        content: `On high-speed on-chip interconnects (AXI4, PCIe TLP streaming, NVLink flit interfaces), data transfers occur through a two-way handshake:
- **valid**: Driven by the producer indicating data and control fields are valid.
- **ready**: Driven by the consumer indicating readiness to accept.

The golden protocol rule:
> **Once \`valid\` is asserted and \`ready\` is low (stall cycle), the producer MUST maintain \`valid == 1\` and keep all payload signals (\`data\`, \`keep\`, \`last\`, \`id\`) completely unchanged until acceptance occurs.**

Why? Because the consumer may register the presence of \`valid\` to start arbitrating for internal buffers. If the producer revokes \`valid\` or alters \`data\`, the receiver captures corrupted or duplicate information.`,
        code: `// Golden SVA Checker for Handshake Stability
property p_valid_ready_stability;
  @(posedge clk) disable iff (!rst_n)
  (valid && !ready) |=> (valid && $stable(data) && $stable(last));
endproperty
assert property (p_valid_ready_stability)
  else $error("Protocol Violation: Valid or payload changed during stall!");

// Cover sequence: Back-to-back stall followed by handshake
cover property (@(posedge clk) disable iff (!rst_n)
  (valid && !ready)[*3] ##1 (valid && ready));`,
        codeLang: 'systemverilog',
        codeNotes: '[$stable] checks that the sampled value at the current edge equals its value at the previous edge.',
        callout: {
          type: 'gotcha',
          title: 'The Common Assertion Hole',
          body: 'A naive property `(valid && !ready) |=> !ready -> $stable(data)` only checks stability if the next cycle is ALSO stalled! If ready rises on the next cycle, the check is skipped, allowing buggy RTL to mutate data on the very cycle the consumer accepts it!',
        },
      },
      {
        id: 'deadlock-free-handshakes',
        title: '2. Combinational Dependencies and Deadlock Prevention',
        content: `Can \`valid\` depend on \`ready\`? Can \`ready\` depend on \`valid\`?
- In AXI: **\`valid\` must NOT depend on \`ready\`**. A master cannot wait for the slave to assert \`ready\` before asserting \`valid\`.
- Conversely, **\`ready\` CAN depend on \`valid\`**, but doing so creates combinational feedthrough paths that can form deadlocks if circular loops exist in the interconnect.
- Best practice in high-performance pipelines is **registered ready** using a skid buffer (ping-pong registers), eliminating combinational paths entirely and achieving $F_{max}$ closure.`,
        code: `// Skid Buffer Interface Contract
module skid_buffer #(parameter WIDTH = 64) (
  input  logic             clk, rst_n,
  input  logic             s_valid,
  output logic             s_ready, // Registered or decoupled
  input  logic [WIDTH-1:0] s_data,
  output logic             m_valid,
  input  logic             m_ready,
  output logic [WIDTH-1:0] m_data
);
  // Internal double-buffer registers guarantee zero bubble cycles
  // while fully breaking timing paths between s_ready and m_ready.
endmodule`,
        codeLang: 'systemverilog',
        callout: {
          type: 'nvidia-tip',
          title: 'NVIDIA Hardware Architecture Principle',
          body: 'In GPU streaming multiprocessor (SM) interconnects, long combinational paths on ready signals cause routing congestion and timing violations. Verification engineers must write SVA checks to prove that `s_ready` is never combinationally derived from downstream `m_valid`.',
        },
      },
    ],
    nvidiaRelevance: {
      interviewContext:
        'AXI protocol handshakes and credit/valid-ready interfaces are standard interview topics at NVIDIA, Apple, and AMD.',
      keyQuestionsAsked: [
        'Write an SVA assertion checking that payload data is stable during backpressure.',
        'Can ready be deasserted after being asserted if valid has not arrived?',
        'How does a skid buffer eliminate backpressure timing paths while preserving full throughput?',
      ],
      whatInterviewersLookFor:
        'Precise understanding of handshake edge conditions, correct use of $stable, and awareness of combinational dependency loops.',
    },
    references: [
      {
        title: 'Arm AMBA AXI and ACE Protocol Specification (Chapter A3)',
        url: 'https://developer.arm.com/-/media/Arm%20Developer%20Community/PDF/IHI0022H_amba_axi_protocol_spec.pdf',
        note: 'Section A3.2: Handshake process and signal dependencies',
      },
    ],
  },
  {
    id: 'mod-cdc-gray',
    topic: 'cdc',
    topicName: 'CDC & Reset',
    level: 'Staff DV',
    title: 'Gray-Coded Asynchronous CDC FIFO & Bus Skew Verification',
    subtitle: 'Dual-flop synchronizers, MTBF calculations, multi-bit Gray transition safety, and physical bus skew constraints',
    estimatedMinutes: 25,
    summary:
      'Demystify asynchronous clock domain crossings. Understand why binary counters fail across clock domains, how Gray coding ensures single-bit transitions, and why static timing constraints (set_bus_skew) are mandatory for silicon survival.',
    architectureDiagramTitle: 'Asynchronous FIFO Dual-Clock Architecture & Gray Synchronizer Paths',
    interactiveType: 'cdc-gray-sync',
    interactiveTitle: 'Asynchronous CDC Dual-Flop Gray Pointer Simulator',
    interactiveSubtitle: 'Simulate clock crossings between asynchronous domains and inspect Gray code single-bit transitions',
    interactiveInstructions:
      'Increment the write pointer, observe its conversion to Gray code, and step through the two-stage flip-flop synchronizer in the read clock domain. Inject simulated bus skew to observe how multi-bit binary pointers glitch into illegal states while Gray pointers transition safely.',
    keyConcepts: [
      {
        title: 'Metastability & Dual-Flop Synchronizers',
        description: 'When setup/hold times are violated, flip-flops enter a metastable state. A 2-flop chain provides settling time, exponentially increasing MTBF.',
        tag: 'Physics',
      },
      {
        title: 'Gray Code Single-Bit Transitions',
        description: 'Gray codes guarantee that between any adjacent increments, exactly ONE bit flips. This prevents multi-bit convergence hazards.',
        tag: 'Encoding',
      },
      {
        title: 'set_bus_skew Static Timing Requirement',
        description: 'Gray coding only protects CDC if all bits in the bus arrive within one destination clock period. Physical skew must be constrained.',
        tag: 'STA & Constraints',
      },
    ],
    sections: [
      {
        id: 'cdc-metastability-physics',
        title: '1. Why Multi-Bit Binary Pointers Cause Silicon Failures',
        content: `When transferring signals between asynchronous clocks (\`clk_wr\` and \`clk_rd\`), clock edges arrive at arbitrary phase offsets.
If a binary counter transitions from \`3 (0011)\` to \`4 (0100)\`, **three bits change simultaneously**.

Because wire lengths, buffer delays, and gate thresholds vary on silicon:
- Bit 0 may arrive first.
- Bit 1 may arrive second.
- Bit 2 may arrive third.
If the receiving clock samples during this transition window, it could sample **0111 (7)**, **0000 (0)**, or **0001 (1)**! The receiver sees a wild, phantom pointer value, corrupting the FIFO empty/full calculations and causing catastrophic data overwrite or underflow.

### The Gray Code Solution
In a Gray code, incrementing from $n$ to $n+1$ changes **exactly one bit**:
- \`0000 -> 0001 -> 0011 -> 0010 -> 0110 -> 0111 -> 0101 -> 0100\`
Because only one bit changes:
- If the receiver samples early: it sees the old valid value ($n$).
- If the receiver samples late: it sees the new valid value ($n+1$).
- If the changing bit goes metastable: it resolves to either 0 or 1, which corresponds to either $n$ or $n+1$! **Never a random corrupt value!**`,
        code: `// Synthesizable Binary-to-Gray and Gray-to-Binary Conversions
function automatic logic [ADDR_WIDTH:0] bin2gray(input logic [ADDR_WIDTH:0] bin);
  return bin ^ (bin >> 1);
endfunction

function automatic logic [ADDR_WIDTH:0] gray2bin(input logic [ADDR_WIDTH:0] gray);
  logic [ADDR_WIDTH:0] bin;
  bin[ADDR_WIDTH] = gray[ADDR_WIDTH];
  for (int i = ADDR_WIDTH - 1; i >= 0; i--) begin
    bin[i] = bin[i+1] ^ gray[i];
  end
  return bin;
endfunction`,
        codeLang: 'systemverilog',
        callout: {
          type: 'nvidia-tip',
          title: 'Cummings SNUG Paper Rule',
          body: 'Asynchronous FIFO pointers must be registered BEFORE crossing domains. Never pass combinational Gray-code outputs into a synchronizer; glitches on combinational logic violate single-bit transition guarantees.',
        },
      },
      {
        id: 'skew-and-mtbf',
        title: '2. The Bus Skew Trap & Verification Verification Plan',
        content: `A widespread misconception among junior engineers is that "Gray code makes CDC completely safe without timing constraints."
**This is dangerous and false!**

If physical routing introduces large skew between bits, the bit transition for step $n+2$ could arrive before the bit transition for step $n+1$!
To ensure correctness, the physical implementation team must apply SDC constraints:
\`\`\`tcl
# Static Timing Constraint in Vivado / Synopsys PrimeTime
set_max_delay -from [get_cells wr_ptr_gray_reg*] -to [get_cells sync_rd_ptr_reg1*] [expr min($t_wr, $t_rd)]
set_bus_skew  -from [get_cells wr_ptr_gray_reg*] -to [get_cells sync_rd_ptr_reg1*] [expr 0.5 * $t_rd]
\`\`\`

### Verification Verification Strategy
1. **Structural CDC Analysis**: Run SpyGlass CDC / Questa CDC to verify all crossings use sanctioned synchronizer cells and no combinational logic exists on crossing paths.
2. **Reconvergence Verification**: Ensure no Gray bits diverge and reconverge in destination logic.
3. **Simulation Random Jitter**: In Questa/VCS, enable random CDC jitter injection on synchronizer inputs to verify that the design never hangs regardless of multi-cycle synchronization delay.`,
        code: `// Asynchronous FIFO Full Condition in Gray Domain
// Full occurs when MSB and 2nd MSB are inverted, and lower bits match
assign wfull = (wr_ptr_gray == {~rd_ptr_gray_sync[ADDR_WIDTH:ADDR_WIDTH-1], 
                               rd_ptr_gray_sync[ADDR_WIDTH-2:0]});

// Empty occurs when write and read Gray pointers are completely identical
assign rempty = (rd_ptr_gray == wr_ptr_gray_sync);`,
        codeLang: 'systemverilog',
        callout: {
          type: 'silicon-bug',
          title: 'Conservative Delay is Safe',
          body: 'In an async FIFO, write-domain full logic sees a delayed read pointer. This means the write domain may think the FIFO is full for a few extra cycles even after a read has occurred. This latency is 100% safe: it temporarily reduces throughput, but NEVER violates data integrity.',
        },
      },
    ],
    nvidiaRelevance: {
      interviewContext:
        'Cliff Cummings’ asynchronous FIFO paper is the holy grail of hardware interview prep. NVIDIA GPU architectures have hundreds of independent clock domains, making CDC mastery non-negotiable.',
      keyQuestionsAsked: [
        'Derive the formula to detect Full using Gray-coded pointers.',
        'Why does Gray coding fail if bus skew exceeds one destination clock period?',
        'What is MTBF (Mean Time Between Failures) and how does adding a 3rd flip-flop stage affect it?',
      ],
      whatInterviewersLookFor:
        'Clear mathematical understanding of bin2gray, recognition that synchronizers delay information conservatively, and knowledge of physical bus skew constraints.',
    },
    references: [
      {
        title: 'Cliff Cummings: Simulation and Synthesis Techniques for Asynchronous FIFO Design (SNUG 2002)',
        url: 'https://www.paradigm-works.com/hubfs/49408364/technical-library/Sunburst/CummingsSNUG2002SJ_FIFO1_rev1_3.pdf',
        note: 'The foundational industry paper on Gray-coded async FIFOs',
      },
      {
        title: 'AMD Xilinx UG903: Bus Skew Constraints for CDC Paths',
        url: 'https://docs.amd.com/r/en-US/ug903-vivado-using-constraints/About-Bus-Skew-Constraints',
        note: 'Practical timing closure requirements for multi-bit Gray buses',
      },
    ],
  },
  {
    id: 'mod-cdc-reset',
    topic: 'cdc',
    topicName: 'CDC & Reset',
    level: 'Advanced',
    title: 'Reset Domain Crossing (RDC), Synchronizers & Glitch Immunity',
    subtitle: 'Asynchronous assertion, synchronous de-assertion, reset recovery/removal timing, and glitch protection',
    estimatedMinutes: 20,
    summary:
      'Learn how silicon resets are designed and verified. Discover why raw asynchronous resets cause metastability on release, how reset synchronizer bridges work, and how to verify multi-domain reset sequencing.',
    architectureDiagramTitle: 'Reset Synchronizer Bridge & Recovery/Removal Timing Window',
    interactiveType: 'reset-recovery',
    interactiveTitle: 'Interactive Reset Recovery & Removal Timing Simulator',
    interactiveSubtitle: 'Adjust reset release timing relative to clock edges to observe the forbidden metastability window',
    interactiveInstructions:
      'Slide the reset deassertion timing relative to the clock rising edge. Observe what happens when reset releases within the recovery/removal window: flip-flops fail to cleanly exit reset, producing indeterminate outputs and illegal state transitions.',
    keyConcepts: [
      {
        title: 'Recovery and Removal Time',
        description: 'Recovery time is the minimum time reset must be inactive before the clock edge; removal time is the minimum time reset must remain active after the clock edge.',
        tag: 'Timing Closure',
      },
      {
        title: 'Asynchronous Assert, Synchronous Deassert',
        description: 'Asserting reset asynchronously ensures immediate shutdown even if clocks are stopped; releasing synchronously prevents metastability.',
        tag: 'RTL Architecture',
      },
      {
        title: 'Reset Glitch Filters',
        description: 'External reset pins must be debounced and glitch-filtered before driving internal chip distribution networks.',
        tag: 'Silicon Robustness',
      },
    ],
    sections: [
      {
        id: 'reset-synchronizer-circuit',
        title: '1. The Reset Synchronizer Architecture',
        content: `Why can't we use purely synchronous resets or purely asynchronous resets?
- **Pure Synchronous Reset**: If a clock is unpowered, gating, or PLL has not locked, a synchronous reset CANNOT reset the flip-flops!
- **Pure Asynchronous Reset**: If the reset signal deasserts asynchronously right at a clock rising edge, some flops in a pipeline see reset deasserted while others see it asserted! The circuit wakes up into an illegal, corrupt state.

The industry gold standard: **Asynchronous Assertion, Synchronous Deassertion (Reset Synchronizer)**:
1. When \`rst_in_n\` falls to 0: Both flip-flops asynchronously clear immediately (\`rst_out_n <= 0\`).
2. When \`rst_in_n\` rises to 1: The input flop samples \`1'b1\` on the next clock edge. The second flop samples \`1'b1\` one cycle later, cleanly releasing reset synchronous to \`clk\`.`,
        code: `// Industry-Standard Reset Synchronizer Bridge
module reset_sync (
  input  logic clk,
  input  logic rst_in_n, // Asynchronous active-low reset
  output logic rst_out_n // Synchronized active-low reset
);
  (* ASYNC_REG = "TRUE" *) logic sync_stage1;
  (* ASYNC_REG = "TRUE" *) logic sync_stage2;

  always_ff @(posedge clk or negedge rst_in_n) begin
    if (!rst_in_n) begin
      sync_stage1 <= 1'b0;
      sync_stage2 <= 1'b0;
    end else begin
      sync_stage1 <= 1'b1;
      sync_stage2 <= sync_stage1;
    end
  end

  assign rst_out_n = sync_stage2;
endmodule`,
        codeLang: 'systemverilog',
        callout: {
          type: 'nvidia-tip',
          title: 'NVIDIA Synthesizer Directive',
          body: 'The `(* ASYNC_REG = "TRUE" *)` attribute instructs Vivado and Synopsys synthesis tools to place these two flip-flops in the same slice/CLB close together to minimize wire delay and maximize MTBF.',
        },
      },
      {
        id: 'rdc-verification',
        title: '2. Verifying Reset Domain Crossings (RDC)',
        content: `In a modern GPU SoC with dozens of power domains, blocks enter and exit reset independently.
When Block A enters reset while communicating with Block B:
- Output signals of Block A must be safely clamped or isolated (isolation cells) to prevent driving random values or floating inputs into Block B.
- Protocol checkers must verify that Block B discards in-flight requests and realigns its state without locking up.`,
        code: `// SVA Property Verifying Reset Assertion Propagation Latency
property p_reset_immediate_assertion;
  @(negedge rst_in_n) 1'b1 |=> (!rst_out_n);
endproperty

// Verifying synchronous deassertion occurs strictly on clock edge
property p_reset_sync_deassertion;
  @(posedge clk) $rose(rst_out_n) |-> (rst_in_n == 1'b1);
endproperty`,
        codeLang: 'systemverilog',
      },
    ],
    nvidiaRelevance: {
      interviewContext:
        'Reset architecture is a core question in chip-level and IP verification interviews. Interviewers test whether candidates understand why reset deassertion requires timing closure.',
      keyQuestionsAsked: [
        'Explain recovery time and removal time with a timing diagram.',
        'Draw the schematic for an asynchronous assert, synchronous de-assert reset synchronizer.',
        'What happens if two clock domains share an asynchronous reset tree with different frequencies?',
      ],
      whatInterviewersLookFor:
        'Ability to sketch the reset bridge circuit, explain metastability on the deassert edge, and write assertions for reset sequencing.',
    },
    references: [
      {
        title: 'Cliff Cummings: Asynchronous & Synchronous Reset Design Techniques (SNUG 2003)',
        url: 'https://www.paradigm-works.com/hubfs/49408364/technical-library/Sunburst/CummingsSNUG2003Boston_Resets.pdf',
        note: 'Classic guide to reset synchronizers and recovery/removal timing',
      },
    ],
  },
  {
    id: 'mod-arch-arbiter',
    topic: 'arch',
    topicName: 'Microarchitecture',
    level: 'Senior DV',
    title: 'High-Performance Round-Robin Arbiter & Starvation Prevention',
    subtitle: 'Priority encoder trees, rotating priority masks, request-to-grant latency bounds, and formal fairness proofs',
    estimatedMinutes: 20,
    summary:
      'Explore how hardware arbiters fairly allocate shared resources among competing clients. Learn how rotating priority masks prevent starvation, how to implement single-cycle round-robin arbitration, and how to verify mutual exclusion and fairness.',
    architectureDiagramTitle: 'Round-Robin Arbiter Dual-Priority Encoder Architecture',
    interactiveType: 'arbiter-round-robin',
    interactiveTitle: 'Interactive Round-Robin Arbiter Token Ring Simulator',
    interactiveSubtitle: 'Toggle request lines, step clock cycles, and observe the rotating priority pointer and grant generation',
    interactiveInstructions:
      'Activate requests from Clients 0 through 3. Step cycles and watch the arbiter grant access to the highest-priority active client and advance the priority pointer to the next client, ensuring strict fairness and zero starvation.',
    keyConcepts: [
      {
        title: 'Mutual Exclusion (Safety)',
        description: 'At most one client may be granted access in any clock cycle ($onehot0(grant)).',
        tag: 'Safety Invariant',
      },
      {
        title: 'Starvation Freedom (Liveness)',
        description: 'Any client maintaining an active request must eventually be granted access within a bounded number of cycles.',
        tag: 'Fairness Proof',
      },
      {
        title: 'Dual Priority Encoder Architecture',
        description: 'Efficient single-cycle round-robin arbitration uses two concatenated priority encoders to wrap around the request vector without multi-cycle latency.',
        tag: 'RTL Architecture',
      },
    ],
    sections: [
      {
        id: 'arbiter-architecture',
        title: '1. The Dual Priority Encoder Hardware Architecture',
        content: `A fixed-priority arbiter always favors Client 0 over Client 3. If Client 0 generates continuous requests, Clients 1, 2, and 3 starve!

A **Round-Robin Arbiter** provides fairness by rotating the priority order. After Client $i$ receives a grant, Client $(i+1) \\pmod N$ receives highest priority for the next cycle.

### How to Build a Single-Cycle Round-Robin Arbiter:
Rather than using a barrel shifter or multi-cycle state machine, high-speed RTL duplicates the priority encoder:
1. Mask the request vector with the current priority mask: \`req_masked = req & ~priority_mask\`.
2. Compute grants on the masked vector: \`grant_masked = req_masked & (-req_masked)\`.
3. Compute grants on the unmasked vector (for wrap-around): \`grant_unmasked = req & (-req)\`.
4. If \`grant_masked\` is non-zero, use it; otherwise use \`grant_unmasked\`.
This computes fair arbitration in pure combinational logic in a single cycle!`,
        code: `// High-Speed Synthesizable Round-Robin Arbiter (4-client)
module round_robin_arbiter #(parameter N = 4) (
  input  logic         clk, rst_n,
  input  logic [N-1:0] req,
  output logic [N-1:0] grant
);
  logic [N-1:0] base_ptr;
  logic [2*N-1:0] double_req;
  logic [2*N-1:0] double_grant;

  // Concatenate request vector to handle wrap-around seamlessly
  assign double_req = {req, req};

  // Find lowest set bit starting from base_ptr
  always_comb begin
    double_grant = double_req & ~(double_req - base_ptr);
  end

  assign grant = double_grant[N-1:0] | double_grant[2*N-1:N];

  // Rotate base_ptr to next client after a grant is issued
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      base_ptr <= 1'b1;
    end else if (|grant) begin
      base_ptr <= {grant[N-2:0], grant[N-1]}; // Rotate left
    end
  end
endmodule`,
        codeLang: 'systemverilog',
        callout: {
          type: 'nvidia-tip',
          title: 'GPU Warp Scheduler Context',
          body: 'NVIDIA GPU streaming multiprocessors use complex variations of round-robin and greedy-then-oldest (GTO) schedulers to pick which warps issue instructions each cycle to hide memory latency.',
        },
      },
      {
        id: 'arbiter-verification',
        title: '2. Verifying Fairness & Absence of Starvation',
        content: `To verify an arbiter:
1. **Safety**: \`assert property ($onehot0(grant))\` proves no two clients are ever granted simultaneously.
2. **Work-Conserving**: If \`|req\` is true, then \`|grant\` must be true (no idle cycles when requests exist).
3. **Liveness / Fairness**: Every persistent request must receive a grant within $N$ grants.`,
        code: `// Complete SVA Verification Suite for Arbiter
module arbiter_sva (input logic clk, rst_n, input logic [3:0] req, grant);
  default clocking cb @(posedge clk); endclocking
  default disable iff (!rst_n);

  // Invariant 1: Mutual exclusion
  assert property ($onehot0(grant))
    else $error("Safety failure: Multiple grants issued simultaneously!");

  // Invariant 2: Work-conserving
  assert property (|req |-> |grant)
    else $error("Liveness failure: Arbiter is idle while requests are pending!");

  // Invariant 3: Grant only when requested
  assert property ((grant & req) == grant)
    else $error("Illegal grant issued to client without request!");

  // Liveness check: Client 0 persistent request granted within 4 cycles
  assert property (req[0] throughout (##[0:3] grant[0]))
    else $error("Starvation: Client 0 starved!");
endmodule`,
        codeLang: 'systemverilog',
      },
    ],
    nvidiaRelevance: {
      interviewContext:
        'Round-robin arbiters are ubiquitous across NVIDIA microarchitecture interviews for switch fabrics, memory crossbars, and cache controllers.',
      keyQuestionsAsked: [
        'How do you write synthesizable logic to grant requests in round-robin fashion without multi-cycle state machines?',
        'Prove that the arbiter never starves any requester.',
        'What is the difference between $onehot and $onehot0 in SystemVerilog?',
      ],
      whatInterviewersLookFor:
        'Knowledge of bitwise two’s complement tricks (`req & (-req)`), clear understanding of liveness vs safety properties, and SVA checkers.',
    },
    references: [
      {
        title: 'Arbitration and Routing in On-Chip Networks (Dally & Towles)',
        url: 'https://www.cambridge.org/core/books/principles-and-practices-of-interconnection-networks/9CD563914FA791F6FFFD84E59C757BE4',
        note: 'Comprehensive text on network-on-chip arbitration mechanisms',
      },
    ],
  },
  {
    id: 'mod-arch-credit',
    topic: 'arch',
    topicName: 'Microarchitecture',
    level: 'Staff DV',
    title: 'Credit-Based Flow Control in GPU & NoC Interconnects (NVLink/PCIe)',
    subtitle: 'Credit counter tracking, round-trip latency credit loops, credit leak/overflow detection, and deadlock prevention',
    estimatedMinutes: 25,
    summary:
      'Master credit-based flow control used in ultra-high-bandwidth interconnects like NVLink, PCIe, and on-chip networks. Learn how transmitters track receiver buffer occupancy across multi-cycle round-trip flight times with zero throughput bubbles.',
    architectureDiagramTitle: 'Credit-Based Flow Control Loop: Transmitter, Forward Pipeline, Receiver & Credit Return Loop',
    interactiveType: 'credit-flow',
    interactiveTitle: 'Interactive NVLink / PCIe Credit Flow Simulator',
    interactiveSubtitle: 'Send packets across flight pipelines, return credit tokens, and simulate buffer management',
    interactiveInstructions:
      'Click "Send Packet" to transmit flits across the forward pipeline, decrementing transmitter credits. When packets reach the receiver, click "Process & Return Credit" to send credits back across the reverse pipeline. Observe what happens if credit counters leak or overflow.',
    keyConcepts: [
      {
        title: 'Credit Conservation Law',
        description: 'Total Credits = TX Available Credits + Flits in Flight (Forward) + RX Buffer Occupancy + Credits in Flight (Reverse). Must equal initial buffer capacity at all times.',
        tag: 'Conservation Invariant',
      },
      {
        title: 'Zero-Bubble Pipelined Throughput',
        description: 'To sustain 100% bandwidth, Initial Credits must equal at least Round-Trip Latency (RTL) cycles times flit consumption rate.',
        tag: 'Bandwidth Sizing',
      },
      {
        title: 'Credit Leak & Corruption Failures',
        description: 'If a credit pulse is corrupted or dropped on physical links, credits leak permanently, eventually starving the channel into a permanent freeze.',
        tag: 'Silicon Faults',
      },
    ],
    sections: [
      {
        id: 'credit-mechanics',
        title: '1. Why Credit-Based Flow Control Dominates High-Speed Fabrics',
        content: `In simple interfaces, valid/ready handshakes work when producer and consumer are adjacent.
However, when wires span centimeters across a large GPU die or across an NVLink cable:
- Forward wire delay = 6 cycles.
- Reverse wire delay = 6 cycles.
- **Round-Trip Latency (RTL) = 12 cycles!**

If you used a valid/ready handshake, by the time the receiver deasserted \`ready\`, 12 packets would already be in flight on the wire! The receiver buffer would overflow catastrophically.

### The Credit Mechanism:
1. The Receiver has a buffer of size $C$ (e.g., 16 flits).
2. The Transmitter initializes an internal credit counter to $C$.
3. When transmitting a flit, the Transmitter decrements \`credit_count <= credit_count - 1\`.
4. If \`credit_count == 0\`, the Transmitter stops sending flits (guaranteeing the receiver buffer will never overflow).
5. As the Receiver processes and frees buffer slots, it sends **credit return pulses** back to the Transmitter.
6. When the Transmitter receives a credit pulse, it increments \`credit_count <= credit_count + 1\`.`,
        code: `// Synthesizable Credit Counter in Transmitter
always_ff @(posedge clk or negedge rst_n) begin
  if (!rst_n) begin
    credits <= INITIAL_CREDITS;
  end else begin
    unique case ({send_flit, credit_return})
      2'b10: credits <= credits - 1'b1; // Sent flit, no credit returned
      2'b01: credits <= credits + 1'b1; // Credit returned, no flit sent
      default: credits <= credits;      // Neither or simultaneous
    endcase
  end
end`,
        codeLang: 'systemverilog',
        callout: {
          type: 'nvidia-tip',
          title: 'NVLink Architecture Metric',
          body: 'NVIDIA NVLink utilizes multi-virtual-channel credit flow control. Verification engineers must write credit conservation assertions across all virtual networks (request, response, probe) simultaneously.',
        },
      },
      {
        id: 'credit-verification',
        title: '2. Writing the Credit Conservation Checker',
        content: `How do you verify a credit system in a UVM scoreboard or formal tool?
We formulate the **Fundamental Credit Conservation Invariant**:
At every clock cycle $t$:
$$\\text{Credits}_{\\text{TX}} + \\text{Flits}_{\\text{forward\\_pipe}} + \\text{Flits}_{\\text{RX\\_buffer}} + \\text{Credits}_{\\text{return\\_pipe}} = \\text{CAPACITY}$$

If this sum ever drops below \`CAPACITY\`, a **credit leak** occurred.
If this sum ever exceeds \`CAPACITY\`, **phantom credits** were injected.`,
        code: `// Verification Scoreboard Invariant Check
function void verify_credit_conservation();
  int total_credits = tx_credits + 
                      forward_flits_in_flight.size() + 
                      rx_buffer.size() + 
                      return_credits_in_flight.size();
  if (total_credits != BUFFER_CAPACITY) begin
    \`uvm_error("CREDIT_LEAK", 
      $sformatf("Credit violation! Expected %0d, found %0d", 
                BUFFER_CAPACITY, total_credits))
  end
endfunction`,
        codeLang: 'systemverilog',
      },
    ],
    nvidiaRelevance: {
      interviewContext:
        'Credit-based flow control is arguably the most common topic in NVIDIA interconnect, GPU fabric, and high-performance network design verification interviews.',
      keyQuestionsAsked: [
        'How many credits must you provide to achieve 100% link utilization with 20 cycles of round-trip latency?',
        'How do you verify credit conservation across reset and link retraining?',
        'What is a credit leak, and how does your scoreboard detect it?',
      ],
      whatInterviewersLookFor:
        'Ability to calculate the Bandwidth-Delay Product for credit buffers, state the credit conservation equation, and design checkers for credit replay.',
    },
    references: [
      {
        title: 'PCI Express Base Specification 5.0 (Data Link Layer Flow Control)',
        url: 'https://pcisig.com/specifications/pciexpress',
        note: 'Standardized specification of credit-based flow control packets (Flow Control Update DLLPs)',
      },
    ],
  },
  {
    id: 'mod-uvm-phase',
    topic: 'uvm',
    topicName: 'Verification Strategy',
    level: 'Senior DV',
    title: 'UVM Driver/Sequencer Handshakes, Objections & Phase Progression',
    subtitle: 'TLM get_next_item vs item_done, objection drain times, scoreboard end-of-test flushing, and deadlock prevention',
    estimatedMinutes: 20,
    summary:
      'Master the orchestration of UVM testbenches. Understand the strict TLM handshake protocol between driver and sequencer, avoid premature test termination with phase objections, and guarantee clean scoreboard closure.',
    architectureDiagramTitle: 'UVM Testbench Phase Lifecycle & Sequencer-Driver TLM Handshake',
    interactiveType: 'uvm-phase-objection',
    interactiveTitle: 'Interactive UVM Phase & Objection Lifecycle Inspector',
    interactiveSubtitle: 'Raise and drop objections, configure drain times, and observe phase transitions',
    interactiveInstructions:
      'Control objection counts across the sequencer, driver, and scoreboard. See how premature objection drops truncate in-flight transactions, and how configuring objection drain times ensures scoreboards fully compare trailing responses before tests finish.',
    keyConcepts: [
      {
        title: 'Driver-Sequencer Handshake Protocol',
        description: 'seq_item_port.get_next_item(req) blocks until a sequence yields an item; seq_item_port.item_done() unblocks the sequence to proceed.',
        tag: 'TLM Handshake',
      },
      {
        title: 'Phase Objections & Drain Time',
        description: 'A phase does not end until all raised objections reach zero. Drain times allow trailing pipeline responses to settle before test shutdown.',
        tag: 'Testbench Control',
      },
      {
        title: 'Scoreboard Check Phase Integrity',
        description: 'In check_phase(), verify that all expected transaction queues are completely empty. Any remaining items indicate dropped packets or hung pipelines.',
        tag: 'Test Closure',
      },
    ],
    sections: [
      {
        id: 'driver-sequencer-handshake',
        title: '1. The TLM Handshake: get_next_item vs try_next_item',
        content: `In a UVM verification component (UVC), the driver communicates with the sequencer across a TLM port:
\`\`\`systemverilog
virtual task run_phase(uvm_phase phase);
  forever begin
    seq_item_port.get_next_item(req); // Blocks until sequence generates item
    drive_item(req);                  // Drives pin-level bus protocol
    seq_item_port.item_done();        // Informs sequencer that transfer completed
  end
endtask
\`\`\`
### Crucial Best Practices:
1. Never call \`get_next_item()\` twice in a row without calling \`item_done()\`. Doing so creates a fatal UVM run-time error.
2. If responses are required by the sequence: pass the response back using \`seq_item_port.item_done(rsp)\` or \`seq_item_port.put_response(rsp)\`.
3. If the driver needs to drive idle cycles when no transactions are ready: use \`seq_item_port.try_next_item(req)\` which returns immediately if the sequence queue is empty.`,
        code: `// Production Non-Blocking UVM Driver Loop
virtual task run_phase(uvm_phase phase);
  forever begin
    seq_item_port.try_next_item(req);
    if (req != null) begin
      drive_transfer(req);
      seq_item_port.item_done();
    end else begin
      drive_idle_cycle();
    end
  end
endtask`,
        codeLang: 'systemverilog',
        callout: {
          type: 'gotcha',
          title: 'The Premature Test Termination Trap',
          body: 'If only the test sequence raises and drops objections, the test will end the very moment the sequence sends its last item! But that item is still in the driver, DUT pipeline, or scoreboard! The test finishes with "TEST PASSED" while completely skipping checks on the final transactions.',
        },
      },
      {
        id: 'objection-drain-and-check',
        title: '2. Managing Objections and Scoreboard Verification in check_phase',
        content: `To ensure 100% verification integrity:
1. **Drain Time**: Configure a phase drain time: \`phase.phase_done.set_drain_time(this, 100ns);\`.
2. **Scoreboard Objections**: Alternatively, have the scoreboard raise an objection when a new transaction is expected, and drop it only after the DUT response is verified and dequeued.
3. **check_phase()**: Systematically inspect that all internal queues, associative arrays, and reorder buffers are empty:`,
        code: `// UVM Scoreboard Check Phase Verification
virtual function void check_phase(uvm_phase phase);
  super.check_phase(phase);
  if (expected_queue.size() != 0) begin
    \`uvm_error("SCOREBOARD_LEAK", 
      $sformatf("Unfinished transactions! %0d items left unverified at end of test!", 
                expected_queue.size()))
  end
  if (active_transaction_count != 0) begin
    \`uvm_error("INCOMPLETE_WORK", 
      $sformatf("%0d transactions hung in DUT pipeline!", active_transaction_count))
  end
endfunction`,
        codeLang: 'systemverilog',
      },
    ],
    nvidiaRelevance: {
      interviewContext:
        'UVM methodology and debug questions are asked in all NVIDIA DV interviews. Candidates must explain phase mechanics, factory overrides, and TLM ports clearly.',
      keyQuestionsAsked: [
        'What is the difference between get_next_item() and get()?',
        'How do you prevent a test from completing before in-flight DUT responses are checked?',
        'Explain what happens in build_phase vs connect_phase vs run_phase.',
      ],
      whatInterviewersLookFor:
        'Fluency in UVM phasing, objection management strategies, and end-of-test scoreboard checks.',
    },
    references: [
      {
        title: 'Accellera UVM Reference Manual (Phasing and Synchronization)',
        url: 'https://accellera.org/downloads/standards/uvm',
        note: 'Complete specification of UVM phases and objections',
      },
    ],
  },
  {
    id: 'mod-debug-coherence',
    topic: 'debug',
    topicName: 'Protocols & Debug',
    level: 'Staff DV',
    title: 'Cache Coherence Protocols (MESI/MOESI) & Memory Subsystem Races',
    subtitle: 'Snoop filters, store buffers, invalidation queues, out-of-order memory transactions, and race condition debugging',
    estimatedMinutes: 25,
    summary:
      'Dive into memory subsystem verification and cache coherence. Learn the MESI/MOESI state transitions, analyze race conditions when two GPU cores simultaneously write to the same cacheline, and discover how to write checkers for snoop-based interconnects.',
    architectureDiagramTitle: 'Multi-Core GPU Cache Subsystem: L1 Caches, Snoop Crossbar & Shared L2 Cache',
    interactiveType: 'cache-coherence',
    interactiveTitle: 'Interactive MESI Cache Coherence Protocol Simulator',
    interactiveSubtitle: 'Simulate Core 0 and Core 1 reads and writes across a shared bus with real-time snoop invalidations',
    interactiveInstructions:
      'Issue read and write operations from Core 0 and Core 1 to memory address 0x1000. Observe how cachelines transition between Modified (M), Exclusive (E), Shared (S), and Invalid (I), and watch snoop broadcast invalidations maintain global memory consistency.',
    keyConcepts: [
      {
        title: 'MESI State Invariants',
        description: 'Modified (dirty, exclusive), Exclusive (clean, exclusive), Shared (clean, shared with other cores), Invalid (no valid data).',
        tag: 'Coherence Protocol',
      },
      {
        title: 'Single-Writer / Multiple-Reader (SWMR)',
        description: 'For any memory location at any instant, either a single core may write to it (M state) or multiple cores may read from it (S state), but never both.',
        tag: 'Memory Consistency',
      },
      {
        title: 'Simultaneous Upgrade Races',
        description: 'When two cores in Shared state simultaneously request upgrade to Modified, the interconnect arbiter must serialize the requests and invalidate one core.',
        tag: 'Hardware Race Conditions',
      },
    ],
    sections: [
      {
        id: 'mesi-state-machine',
        title: '1. The MESI Cache Coherence State Transitions',
        content: `In multi-core GPUs and CPUs, each core has a private L1 cache, while sharing a common L2 cache and DRAM.
If Core 0 modifies address \`0x1000\`, Core 1’s cached copy of \`0x1000\` immediately becomes stale. Without hardware cache coherence, software will read corrupt, stale data!

### MESI Protocol States:
- **Modified (M)**: Cacheline is present ONLY in this cache, and is DIRTY (more up-to-date than main memory).
- **Exclusive (E)**: Cacheline is present ONLY in this cache, and is CLEAN (matches memory).
- **Shared (S)**: Cacheline may be present in multiple caches, and is CLEAN.
- **Invalid (I)**: Cacheline contains no valid data.

### The Critical Simultaneous Write Race:
Suppose both Core 0 and Core 1 have address \`0x1000\` in **Shared (S)** state.
Both cores simultaneously issue a Write to address \`0x1000\`:
1. Both cores send an \`Upgrade (Invalidate)\` request to the interconnect snoop bus.
2. The interconnect arbiter must break the tie and pick one winner (e.g., Core 0).
3. Core 0’s upgrade is broadcast: Core 1’s cache line transitions **S -> I (Invalid)**!
4. When Core 1’s pending write is finally serviced, it discovers its line is now **Invalid**; it must fetch the updated line from Core 0 before it can write!`,
        code: `// Verification Assertion: Single-Writer / Multiple-Reader Invariant
property p_single_writer_multiple_reader (address_t addr);
  @(posedge clk) disable iff (!rst_n)
  // If any core is in Modified state, no other core may have valid data
  (core0_state[addr] == MODIFIED) |-> (core1_state[addr] == INVALID) &&
  (core1_state[addr] == MODIFIED) |-> (core0_state[addr] == INVALID);
endproperty

assert property (p_single_writer_multiple_reader(CHECK_ADDR))
  else $error("Coherence Failure: Multi-writer hazard detected!");`,
        codeLang: 'systemverilog',
        callout: {
          type: 'silicon-bug',
          title: 'Real Silicon Bug Postmortem',
          body: 'A cache controller failed to stall incoming read snoops while an eviction writeback was in flight. A snoop hit an evicted line in the write buffer, returning stale data to another processor core. This escaped 500 million test cycles and caused intermittent operating system kernel panics.',
        },
      },
      {
        id: 'coherence-verification-strategy',
        title: '2. Scoreboarding Coherent Memory Subsystems',
        content: `Verifying cache coherence requires an **End-to-End Coherence Scoreboard**:
1. Track global memory state at the cacheline level (byte granularity).
2. Model a shadow coherence directory tracking the expected MESI state of every core.
3. Inject aggressive directed-random traffic targeting identical cachelines, false sharing (different bytes in same 64-byte line), and evictions under high bus load.`,
        code: `// Invalidation Queue Latency Assertion
// When Invalidation Acknowledgment is sent, local cacheline MUST be Invalid
property p_invalidation_ack_contract;
  @(posedge clk) disable iff (!rst_n)
  snoop_inv_ack |-> (cache_state[snoop_addr] == INVALID);
endproperty
assert property (p_invalidation_ack_contract)
  else $error("Violation: Sent invalidation ack before invalidating line!");`,
        codeLang: 'systemverilog',
      },
    ],
    nvidiaRelevance: {
      interviewContext:
        'Memory consistency models, cache coherence, and false sharing are top-tier questions for senior GPU verification roles at NVIDIA.',
      keyQuestionsAsked: [
        'Explain how the MESI protocol handles simultaneous write misses from two cores.',
        'What is the difference between Exclusive and Modified state?',
        'What is false sharing, and how does it affect memory interconnect traffic?',
      ],
      whatInterviewersLookFor:
        'Precision in describing bus snoop signals (BusRd, BusRdX, BusUpgr), understanding memory ordering semantics, and designing scoreboards for memory systems.',
    },
    references: [
      {
        title: 'Computer Architecture: A Quantitative Approach (Hennessy & Patterson, Chapter 5)',
        url: 'https://www.elsevier.com/books/computer-architecture/hennessy/978-0-12-811905-1',
        note: 'The authoritative reference on snooping vs directory-based cache coherence',
      },
    ],
  },
];

