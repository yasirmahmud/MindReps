import { interviewQuestions, type InterviewChallenge } from './interviewContent';
export type TopicId = 'sv' | 'sva' | 'uvm' | 'cdc' | 'arch' | 'debug';
export type Question = {
  id: string; topic: TopicId; level: 'Intermediate' | 'Advanced'; title: string;
  prompt: string; code?: string; options: { text: string; why: string }[];
  correct: number[]; lesson: string;
  interview?: InterviewChallenge;
};
export const topics: { id: TopicId; name: string; short: string; description: string; color: string }[] = [
  { id: 'sv', name: 'SystemVerilog & RTL', short: 'SystemVerilog', description: 'Scheduling, sizing, and the hardware behind the code.', color: 'sage' },
  { id: 'sva', name: 'Assertions & formal', short: 'Assertions', description: 'Turn intent into precise, checkable properties.', color: 'lavender' },
  { id: 'uvm', name: 'Verification strategy', short: 'Verification', description: 'Scoreboards, UVM, stimulus, and meaningful coverage.', color: 'sand' },
  { id: 'cdc', name: 'CDC & reset', short: 'CDC & reset', description: 'Reason across clocks, resets, and uncertainty.', color: 'blue' },
  { id: 'arch', name: 'Microarchitecture', short: 'Architecture', description: 'Pipelines, queues, arbitration, and tradeoffs.', color: 'rose' },
  { id: 'debug', name: 'Protocols & debug', short: 'Protocols', description: 'Handshakes, ordering, and finding the first failure.', color: 'mint' },
];
const q = (id: string, topic: TopicId, level: Question['level'], title: string, prompt: string, options: [string, string][], correct: number[], lesson: string, code?: string): Question => ({ id, topic, level, title, prompt, options: options.map(([text, why]) => ({ text, why })), correct, lesson, code });
// Original educational questions. Stable IDs are part of the saved-progress contract.
export const questions: Question[] = [
  q('sv-01','sv','Intermediate','Follow the nonblocking assignments','Immediately before the rising edge, a = 1 and b = 0. After all nonblocking updates from this edge settle, what are a and b?',[
    ['a = 1, b = 1','a reads the old b, which is 0, so a cannot remain 1.'],
    ['a = 0, b = 1','a receives the old b; b receives the old a. This is a swap.'],
    ['a = 0, b = 0','b reads the old a, which is 1, rather than the newly scheduled value of a.'],
    ['The result is nondeterministic','These assignments are in a single process, with no competing writers.']
  ],[1],'A nonblocking assignment evaluates its right-hand side when executed, then schedules its left-hand update. Trace old and next state separately.','always_ff @(posedge clk) begin\n  a <= b;\n  b <= a;\nend'),
  q('sv-02','sv','Advanced','The last scheduled update','Before the edge, count = 7. inc and clear are both 1. There are no other writers. What is count after this edge settles?',[
    ['8','The later clear assignment supersedes the earlier assignment to the same variable.'],
    ['0','Within this process, the last executed nonblocking assignment to count determines the final update.'],
    ['7','At least one assignment executes, so count does not hold.'],
    ['An unpredictable choice of 0 or 8','Source order within this single process determines the result.']
  ],[1],'Independent if statements create priority through execution order. Make intended priority explicit to avoid accidental overrides.','always_ff @(posedge clk) begin\n  if (inc)   count <= count + 1;\n  if (clear) count <= 0;\nend'),
  q('sv-03','sv','Intermediate','An incomplete combinational path','What is the main problem with this intended combinational mux?',[
    ['A flip-flop is required by always_comb','always_comb does not add a clocked storage element.'],
    ['y must retain its previous value when sel is 0','The missing assignment creates storage behavior rather than a fully specified mux.'],
    ['Blocking assignment prevents synthesis','Blocking assignments are appropriate for combinational logic.'],
    ['a must be a wire','The issue is missing behavior, not this signal type.']
  ],[1],'Assign every combinational output on every path, often with defaults followed by overrides. Tools may reject or warn on latch behavior in always_comb.','always_comb begin\n  if (sel) y = a;\nend'),
  q('sv-04','sv','Advanced','Signedness changes the comparison','What is the value of less for this comparison?',[
    ['1, because -1 is less than 1','The mixed signed/unsigned comparison does not perform the intended signed comparison.'],
    ['0, because the comparison is unsigned','At the same width, the unsigned operand makes this comparison unsigned: 8\'hff is greater than 8\'h01.'],
    ['X, because negative values cannot be stored','A signed 8-bit value can represent -1.'],
    ['A compile error','This is legal but can be misleading.']
  ],[1],'Keep arithmetic operand widths and signedness explicit. Legal expressions can still encode the wrong numerical interpretation.','logic signed [7:0] a = -1;\nlogic        [7:0] b =  1;\nassign less = (a < b);'),
  q('sv-05','sv','Intermediate','Truncation at the destination','What is stored in sum?',[
    ['8\'h00','The destination has only 8 bits; the carry beyond bit 7 is lost.'],
    ['9\'h100','A wider mathematical result cannot fit in this destination.'],
    ['8\'hff','The operation is addition, not saturation.'],
    ['X','Overflow does not automatically produce X in this unsigned operation.']
  ],[0],'Widen the destination and operands deliberately when the carry is part of the specification. Ordinary RTL addition does not saturate.','logic [7:0] a = 8\'hff;\nlogic [7:0] b = 8\'h01;\nlogic [7:0] sum;\nassign sum = a + b;'),
  q('sv-06','sv','Advanced','Unknowns hidden by control flow','In four-state simulation, sel = X, a = 1, and b = 0. Which statements are true?',[
    ['The if/else assigns y_if = 0','An X condition is not true, so the else branch executes.'],
    ['The conditional operator assigns y_mux = X','For an unknown condition, differing corresponding bits of the branches merge to X.'],
    ['Both outputs must be 1','Neither construct treats an unknown condition as a definite 1.'],
    ['This proves the physical circuit outputs 0','Simulation control-flow behavior is not proof of the physical outcome for an unknown select.']
  ],[0,1],'X optimism can hide reset or initialization bugs. Compare simulation semantics with the actual mux behavior you intend to verify.','always_comb begin\n  if (sel) y_if = a;\n  else     y_if = b;\n  y_mux = sel ? a : b;\nend'),
  q('sv-07','sv','Intermediate','Logical equality versus case equality','With a = 4\'b10x1 and b = 4\'b1001, what do (a == b) and (a === b) produce?',[
    ['X and 0','Logical equality cannot resolve this unknown bit; case equality compares X as a distinct symbol.'],
    ['0 and 0','Logical equality does not treat the X as a definite mismatch here.'],
    ['1 and 1','The X is not a wildcard in either of these operators.'],
    ['X and X','Case equality always returns a definite 0 or 1.']
  ],[0],'Use case equality deliberately in testbench checks when unknown symbols must be compared explicitly. Do not confuse it with wildcard matching.'),
  q('sv-08','sv','Advanced','A testbench race','A testbench and DUT each use @(posedge clk). The testbench drives req with a blocking assignment; the DUT samples req in another process. Which fixes address the scheduling race?',[
    ['Drive through an interface clocking block with an appropriate skew','A defined drive/sample contract separates the testbench action from the DUT sampling point.'],
    ['Drive on the falling edge if the interface timing contract allows it','This gives a stable value before the next rising-edge sample.'],
    ['Move the testbench source file earlier in the compile list','Compile order is not a portable ordering guarantee for active-region processes.'],
    ['Repeat the seed until the result is stable','Repetition does not eliminate a scheduling race.']
  ],[0,1],'Solve races by defining drive and sampling times, rather than relying on simulator process ordering.'),
  q('sv-09','sv','Advanced','Expression width before assignment','What is the value of out? a is unsigned.',[
    ['16\'h0080','The expression inside a concatenation is self-determined. The 8-bit shift loses the high bit before zero extension.'],
    ['16\'h0180','This would require widening a before the shift; the concatenation does not restore lost bits.'],
    ['16\'h00c0','The code shifts a one position left.'],
    ['16\'hff80','Unsigned a does not cause sign extension.']
  ],[0],'Widen before an operation that can discard significant bits. Concatenation creates a sizing boundary.','logic [7:0] a = 8\'hc0;\nlogic [15:0] out;\nassign out = {8\'h00, (a << 1)};'),
  q('sv-10','sv','Intermediate','Parameterizing a queue','A queue has DEPTH = 1. Why can logic [$clog2(DEPTH)-1:0] index be troublesome?',[
    ['$clog2(1) is zero, producing a [-1:0] range','This is not the intended zero-bit vector and may cause width mismatches or tool issues.'],
    ['$clog2 is unsupported in synthesizable RTL','It is commonly supported for constant parameter calculations.'],
    ['A depth-one queue requires two address bits','The width should reflect the architecture, often with a minimum declared width of one.'],
    ['The index must always be signed','Signedness does not solve the width problem.']
  ],[0],'Check minimum and non-power-of-two parameter values. A common declaration uses max(1, $clog2(DEPTH)) and separately constrains legal indices.'),

  q('sva-01','sva','Intermediate','Overlapped or non-overlapped?','A sampled request at edge n requires ack at edge n+1. Which property expresses this? Assume one common clock and no reset.',[
    ['req |-> ack','This checks ack at the same sampled edge as the single-cycle req antecedent.'],
    ['req |=> ack','Non-overlapped implication starts this consequent on the next sampled edge.'],
    ['ack |=> req','This reverses the requirement.'],
    ['req && ack','This only checks a same-edge Boolean expression.']
  ],[1],'Choose the temporal relationship first, then the implication operator. For a single-cycle antecedent, |=> shifts the consequent one clock later.'),
  q('sva-02','sva','Advanced','A passing assertion with no traffic','req |-> ##[1:3] ack never fails, but req was never sampled high. What should you conclude?',[
    ['Every request was meaningfully exercised','There were no antecedent matches to exercise the response obligation.'],
    ['The property passed vacuously; add stimulus and antecedent coverage','A pass with no triggering events gives no evidence about request handling.'],
    ['The property must be syntactically invalid','Vacuous success is a valid implication outcome.'],
    ['ack must have pulsed every three cycles','The consequent is not required without an antecedent match.']
  ],[1],'Pair implication assertions with coverage of their triggering scenarios. A clean log alone does not establish that the intended behavior was tested.'),
  q('sva-03','sva','Intermediate','The bounded response window','If req is sampled high at n, which ack timings satisfy this property attempt?',[
    ['At n only','The window begins one sampled edge after the antecedent.'],
    ['At n+1, n+2, or n+3','At least one ack in this inclusive window satisfies the consequent.'],
    ['At every edge n+1 through n+3','The delay range allows a matching endpoint; it does not demand ack on every edge.'],
    ['At any future time, without a bound','The upper bound is explicitly three cycles.']
  ],[1],'A ranged delay specifies allowed temporal match points. It is not the same as continuous repetition.','assert property (@(posedge clk) req |-> ##[1:3] ack);'),
  q('sva-04','sva','Advanced','Reset cancels a pending obligation','What does disable iff (!rst_n) normally do to an in-flight concurrent property attempt when rst_n goes low?',[
    ['It waits for the next clock before it can disable the attempt','disable iff is an asynchronous disabling condition in this ordinary usage.'],
    ['It aborts the attempt without recording that attempt as a normal failure','Reset disables the obligation rather than proving the consequent.'],
    ['It proves the DUT completed its pending work','Aborting a check is not proof of functional completion.'],
    ['It automatically checks correct reset values','Reset behavior needs its own checks.']
  ],[1],'Define which obligations reset cancels and separately verify reset values, flushing, and restart behavior.'),
  q('sva-05','sva','Advanced','History must be meaningful','You want to check q == $past(d) only when a real prior sample exists after reset. What is the best approach?',[
    ['Track a sampled-history-valid flag and guard the check','This makes the first meaningful comparison explicit and avoids relying on prehistory defaults.'],
    ['Assume $past always contains a valid transaction','The first samples may not represent valid protocol history.'],
    ['Replace $past(d) with d','That changes the temporal specification.'],
    ['Ignore every assertion failure near reset','This hides real restart bugs.']
  ],[0],'Temporal checks need a validity model for their history, especially at startup and around reset.'),
  q('sva-06','sva','Intermediate','At most one grant','For a known, two-state grant vector, which check allows zero grants but rejects two or more grants?',[
    ['$onehot(grant)','$onehot requires exactly one asserted bit and rejects the idle all-zero case.'],
    ['$onehot0(grant)','$onehot0 permits either zero or one asserted bit.'],
    ['|grant','Reduction OR only checks that at least one bit is asserted.'],
    ['&grant','Reduction AND checks all bits, not mutual exclusion.']
  ],[1],'Separate mutual exclusion from activity requirements. Add explicit unknown-value checks when working with four-state signals.'),
  q('sva-07','sva','Advanced','Stability through a stall','In a synchronous valid/ready interface, once valid is sampled high with ready low, valid and payload must remain until acceptance. Which property checks each stalled step? Assume reset is handled separately.',[
    ['valid && !ready |=> valid && $stable(data)','The next sample must still present valid and the same data, including the sample where acceptance occurs.'],
    ['valid |-> ready','This incorrectly forbids backpressure.'],
    ['!ready |=> !valid','This asks the source to withdraw valid during a stall.'],
    ['valid && ready |=> $stable(data)','After acceptance, the source is allowed to present different data.']
  ],[0],'Check obligations at the transfer boundary. A stalled item cannot change just because ready rises at the next sample.'),
  q('sva-08','sva','Advanced','What does the assertion see?','A register is updated by an NBA at posedge clk. A normal concurrent assertion clocked at that edge reads the register in its property expression. Which value does it ordinarily use?',[
    ['The newly updated register value','The assertion expression uses its sampled value, not the later NBA update.'],
    ['The pre-edge sampled register value','Ordinary concurrent assertion expressions sample in the Preponed region and evaluate later.'],
    ['An arbitrary value based on compile order','Defined assertion sampling avoids that active-region ordering assumption.'],
    ['Both old and new values simultaneously','There is one sampled value for this edge.']
  ],[1],'Write sequential properties in terms of sampled states. An action-block diagnostic may need $sampled(signal) to print the same value the property checked.'),
  q('sva-09','sva','Advanced','The danger of an easy proof','A formal proof passes after the environment assumes ready is always high, but the real interface allows stalls. What is the main concern?',[
    ['The assumption may hide bugs in legal backpressure behavior','The proof only covers the constrained environment, which is narrower than the real contract.'],
    ['Formal proofs are never useful for interfaces','They are useful when assumptions accurately describe legal behavior.'],
    ['A passing proof overrides the interface specification','The specification defines the legal environment, not the proof result.'],
    ['More random seeds will broaden this formal proof','Simulation seeds do not change formal assumptions.']
  ],[0],'Review assumptions as critically as assertions. Use covers and assumption audits to detect unreachable scenarios and overconstraint.'),
  q('sva-10','sva','Advanced','Safety versus liveness','Which claims express liveness rather than safety?',[
    ['A continuously eligible request is eventually granted','This demands eventual progress and needs an appropriate fairness model.'],
    ['The FIFO occupancy never exceeds its capacity','A violating finite trace demonstrates a safety failure.'],
    ['Every accepted operation eventually completes','This is an eventual-progress obligation; environment fairness may be necessary.'],
    ['At most one grant is asserted in a cycle','A single bad sampled grant vector is a safety violation.']
  ],[0,2],'Mutual exclusion does not establish fairness. State progress assumptions explicitly and distinguish unbounded eventuality from a bounded response requirement.'),

  q('uvm-01','uvm','Intermediate','One handle, many observations','A monitor broadcasts the same transaction handle repeatedly, mutating it between writes. A subscriber queues handles for later checking. What should change?',[
    ['Store independent snapshots using a proper copy or clone','Otherwise queued entries can all reflect later mutations of the same object.'],
    ['Add more simulation delay in the subscriber','A delay does not establish independent object ownership.'],
    ['Use a larger queue','Capacity does not fix aliasing.'],
    ['Disable checking until the end of the test','Deferred checking makes retained-handle aliasing more visible.']
  ],[0],'Define transaction ownership. Copies must include the fields and nested objects that your checker needs, not just duplicate a handle.'),
  q('uvm-02','uvm','Intermediate','Ending the test too early','The last sequence has finished sending, but responses are still in flight. What is the strongest end-of-test condition?',[
    ['The sequencer is idle','This does not prove the DUT and scoreboard have drained.'],
    ['Expected work is fully accounted for and the pipeline is drained, with a timeout','Completion should include outstanding responses and pending comparisons; a timeout detects lack of progress.'],
    ['A fixed delay that worked for yesterday\'s seed','Variable latency or stalls can invalidate the delay.'],
    ['The driver has printed its last message','Logs are not a completion protocol.']
  ],[1],'Tie phase objections and test completion to actual outstanding work. Keep a bounded watchdog for hangs.'),
  q('uvm-03','uvm','Advanced','Coverage is not correctness','A regression reaches 100% code coverage, yet a corrupted result escapes. What is the best explanation?',[
    ['Executed RTL is not necessarily checked against the specification','Code coverage measures exercised implementation structures, not whether all outcomes were validated.'],
    ['100% code coverage guarantees every specification requirement','Functional requirements can be missing from both stimulus and checkers.'],
    ['The coverage tool must be broken','The observed outcome is compatible with correct code-coverage measurement.'],
    ['More seeds are the only possible fix','A missing checker requires a checking change, not merely more stimulus.']
  ],[0],'Build a verification plan that connects requirements to stimulus, checkers, and functional coverage.'),
  q('uvm-04','uvm','Advanced','A scoreboard for reordering','Requests carry unique IDs, and the DUT may legally return responses out of order. Which scoreboard model is appropriate?',[
    ['Compare every response against the oldest request','That enforces an ordering the DUT does not promise.'],
    ['Match by ID and track each outstanding transaction','This follows legal identity and ordering constraints without requiring global FIFO order.'],
    ['Sort responses by payload value','Payload does not establish transaction identity.'],
    ['Only compare the total response count','Counts alone cannot detect per-transaction data corruption.']
  ],[1],'The reference model must match the ordering contract. Also detect duplicate responses, unknown IDs, and missing completions.'),
  q('uvm-05','uvm','Intermediate','A hole in the cross','Read and write operations both occur, and every burst length occurs, but long writes never occur. Which coverage addition exposes this?',[
    ['A cross of operation type and burst-length bins','Individual marginal coverage cannot prove combinations have occurred.'],
    ['A second copy of the operation coverpoint','Duplicating a marginal coverpoint does not measure combinations.'],
    ['Only toggle coverage on the data bus','Toggling bits does not identify this transaction combination.'],
    ['A larger random seed value','A seed number is not a coverage metric.']
  ],[0],'Use crosses for meaningful interactions, then classify illegal and unreachable combinations deliberately.'),
  q('uvm-06','uvm','Advanced','A randomization failure is information','A test calls randomize(), which returns 0 after new constraints are added. What should the test do?',[
    ['Treat it as an explicit test failure and investigate the constraints','Continuing can silently reuse old values and invalidate stimulus intent.'],
    ['Continue with the previous object contents','Those values may not represent the intended randomized scenario.'],
    ['Assume the solver selected all zeros','Failure is not successful selection of a default legal solution.'],
    ['Delete all constraints immediately','That can generate invalid transactions rather than fix the inconsistency.']
  ],[0],'Always check randomization success. Reduce conflicting constraints to a small reproducer before changing the legal stimulus model.'),
  q('uvm-07','uvm','Advanced','Mirroring the implementation bug','The reference model copies the DUT\'s exact address-decoding expression. Both mishandle a boundary address. What is the most useful improvement?',[
    ['Derive an independent model from the specification and add boundary examples','Independent reasoning reduces common-mode errors between DUT and checker.'],
    ['Rename the reference-model variables','Renaming does not change the shared logic error.'],
    ['Turn off comparisons for boundary addresses','That removes checks where the bug occurs.'],
    ['Use the DUT output as the expected result','This makes the comparison circular.']
  ],[0],'A model is valuable because of its specification independence, not because it resembles the implementation.'),
  q('uvm-08','uvm','Intermediate','Observe accepted transactions','For a valid/ready interface, when should a passive monitor emit an accepted transfer?',[
    ['On a sampled edge with valid && ready','This records the actual acceptance event.'],
    ['Whenever valid is high, even during stalls','A stalled transfer would be emitted repeatedly.'],
    ['Whenever ready is high','Ready alone does not indicate a presented item.'],
    ['Only when valid falls','Back-to-back transfers can occur without valid falling.']
  ],[0],'Monitor the interface contract, not a convenient signal transition. Distinguish presented work from accepted work.'),
  q('uvm-09','uvm','Advanced','Reset while work is in flight','The specification says reset cancels all outstanding operations and no pre-reset response may appear afterward. Which checks are useful?',[
    ['Flush expected pre-reset work and reject stale post-reset responses','The scoreboard must model cancellation and still detect forbidden old completions.'],
    ['Keep expecting every pre-reset response','That contradicts the specified cancellation behavior.'],
    ['Verify new post-reset traffic completes correctly','Restart correctness is a separate requirement after flushing.'],
    ['Disable the scoreboard permanently after reset','This prevents checking restart and stale-response bugs.']
  ],[0,2],'Reset is a protocol event. Define cancellation, monitor state, scoreboard epochs, and restart behavior together.'),
  q('uvm-10','uvm','Advanced','An uncovered legal corner','A legal corner remains unhit after many regressions. What is the most productive next step?',[
    ['Trace its preconditions, then add targeted stimulus and verify checker activation','A directed or biased test can exercise the interaction while preserving checking.'],
    ['Mark it ignored because it is rare','Rarity alone does not justify excluding a legal requirement.'],
    ['Report the coverage percentage without investigating','The uncovered requirement still lacks evidence.'],
    ['Increase simulation duration indefinitely','More runtime may not fix unreachable stimulus constraints or a sampling bug.']
  ],[0],'Coverage closure is an investigation: distinguish missing stimulus, incorrect sampling, overconstraint, and true unreachability.'),

  q('cdc-01','cdc','Intermediate','What a synchronizer actually promises','A two-flop synchronizer receives a slowly changing single-bit level. Which claim is accurate?',[
    ['It makes metastability physically impossible','Metastability cannot be eliminated absolutely by this circuit.'],
    ['It reduces the probability that metastability propagates into downstream logic','Extra settling time improves reliability; implementation and timing still matter.'],
    ['It guarantees capture of every source pulse','Narrow pulses can be missed by the destination clock.'],
    ['It transfers arbitrary multi-bit data coherently','Independent bit synchronization does not establish word coherence.']
  ],[1],'Treat synchronization as a reliability and protocol problem. A synchronizer does not provide event capture or multi-bit atomicity by itself.'),
  q('cdc-02','cdc','Advanced','A pulse disappears','A one-source-cycle pulse is shorter than a destination clock period. What can reliably transfer each event, assuming the source can wait for acknowledgment?',[
    ['A request/acknowledgment handshake','Holding the request until acknowledgment gives the destination time to observe each event.'],
    ['A plain two-flop level synchronizer','It may never sample a pulse that occurs between destination edges.'],
    ['A third flop after the same pulse synchronizer','Extra settling stages do not recover an event that was never sampled.'],
    ['Sampling every bus bit separately','That does not solve event persistence.']
  ],[0],'Choose a CDC protocol that preserves the information you need. Event rate, backpressure, and acknowledgment determine whether events can be lost.'),
  q('cdc-03','cdc','Advanced','A coherent control word','An 8-bit configuration word changes in one domain and must arrive atomically in another. Which strategy is appropriate when updates are infrequent?',[
    ['Synchronize each bit independently and immediately consume the result','Different bits can settle or be observed on different destination cycles.'],
    ['Hold the word stable while a synchronized handshake controls its capture','A suitable bundled-data protocol establishes coherence and a stable capture window.'],
    ['Use a combinational OR of all bits as a clock','Derived glitch-prone clocks create new hazards.'],
    ['Add only a bus-level false-path constraint','A timing exception does not create a functional CDC protocol.']
  ],[1],'Coherence requires a protocol, not just synchronizer instances. The stable-data timing requirements must also be implemented and constrained.'),
  q('cdc-04','cdc','Advanced','Why Gray-code a FIFO pointer?','In a conventional asynchronous FIFO, why send a registered Gray-coded pointer across domains?',[
    ['Adjacent pointer increments change only one encoded bit','This limits ambiguity for successive pointer values when the implementation meets the required crossing constraints.'],
    ['Gray coding removes the need for synchronizers','The crossing still needs metastability handling.'],
    ['Gray coding makes every bus bit change simultaneously','It is specifically designed to avoid multi-bit transitions between adjacent codes.'],
    ['It lets either clock read the other clock\'s RAM port without a protocol','Memory access and pointer synchronization are separate design concerns.']
  ],[0],'Gray coding, registered source signals, synchronizers, and physical skew/delay constraints work together. Encoding alone is not a complete CDC solution.'),
  q('cdc-05','cdc','Intermediate','Reset release near a clock edge','Why is asynchronous reset assertion often paired with synchronous deassertion separately in each clock domain?',[
    ['To coordinate release with each local clock and reduce recovery/removal hazards','Reset release is a timing-sensitive event for sequential logic in each domain.'],
    ['To make all unrelated domains release on exactly the same absolute instant','Local synchronization does not guarantee simultaneous release across unrelated clocks.'],
    ['To avoid ever checking reset behavior','The release protocol itself still needs verification.'],
    ['To allow combinational logic to become a clock','That is unrelated and unsafe.']
  ],[0],'Reset architecture must account for stopped clocks, domain sequencing, and traffic while another domain remains in reset.'),
  q('cdc-06','cdc','Advanced','The reconvergence trap','A source signal fans out to two independent synchronizer chains. Their outputs feed logic that expects identical values every cycle. What can go wrong?',[
    ['The chains can resolve on different cycles, creating a transient mismatch','Independent synchronization paths do not guarantee aligned latency.'],
    ['Nothing: equal source values force equal destination samples','The crossing uncertainty can differ between chains.'],
    ['The destination clock must stop','The hazard is reconvergence, not automatic clock stoppage.'],
    ['An RTL simulator must always produce X','Ordinary digital simulation may not model the physical uncertainty.']
  ],[0],'Synchronize once and distribute locally when the contract allows it. Review reconvergent crossings explicitly.'),
  q('cdc-07','cdc','Advanced','A stale pointer is sometimes safe','A conventional async FIFO\'s write domain sees a delayed synchronized read pointer. Assuming correct design, what is the usual consequence?',[
    ['Full may stay asserted conservatively after space becomes available','The writer can temporarily underestimate available space.'],
    ['The writer is allowed to overwrite unread entries','Safe flag logic must prevent this despite synchronization latency.'],
    ['The FIFO no longer needs a full check','Delayed information makes correct full logic more important.'],
    ['All reads become asynchronous combinational operations','Pointer latency does not define the RAM architecture.']
  ],[0],'CDC flag latency can reduce utilization without compromising correctness. Distinguish conservative blocking from unsafe acceptance.'),
  q('cdc-08','cdc','Advanced','A toggle has a rate limit','A destination detects events by comparing a synchronized source toggle with its previous value. What happens if the source toggles twice before the destination observes a change?',[
    ['The two changes can cancel observationally, losing events','The destination can see the same level before and after both events.'],
    ['The destination is guaranteed to reconstruct both events','A single bit contains no record of the two unseen transitions.'],
    ['The synchronizer turns the toggle into an event counter','Synchronization does not add information capacity.'],
    ['A toggle protocol has no throughput assumptions','Minimum spacing or acknowledgment is required to avoid loss.']
  ],[0],'A toggle extends pulse persistence, but it does not support unlimited event rate. Use acknowledgment or an asynchronous queue when needed.'),
  q('cdc-09','cdc','Intermediate','What simulation cannot establish','A CDC test passes a million digital simulation cycles. Which additional work remains useful?',[
    ['Structural CDC analysis and review of synchronization protocols','Digital simulation does not establish analog metastability reliability.'],
    ['Physical implementation checks and timing constraints for the crossings','Placement and timing assumptions affect whether the CDC design works as intended.'],
    ['Declare all crossings safe solely from the passing waveform','The waveform is incomplete evidence for CDC safety.'],
    ['Remove synchronizers to increase test speed','That changes the circuit and undermines crossing safety.']
  ],[0,1],'Use complementary evidence: structural analysis, protocol checks, clock/reset scenarios, and physical constraints.'),
  q('cdc-10','cdc','Advanced','Independent reset is part of the protocol','One side of a CDC request/acknowledge channel can reset independently while the other continues running. What must the architecture define?',[
    ['How pending transfers are canceled or recovered, and how both sides realign','Independent reset can otherwise create phantom, lost, or stuck transactions.'],
    ['Only the power-on initial value of the data bus','Control-state realignment and in-flight work also matter.'],
    ['That resetting either side automatically resets every remote flop','That is not guaranteed by independent reset wiring.'],
    ['Nothing, if the clocks have different frequencies','Different clocks are exactly why the protocol needs explicit coordination.']
  ],[0],'Verify reset at each handshake phase. A CDC circuit can be structurally synchronized yet fail its reset recovery contract.'),

  q('arch-01','arch','Intermediate','Latency is not throughput','A fully pipelined unit has latency 5 cycles and initiation interval 1. With continuous input and no stalls, what is its steady-state throughput?',[
    ['One result every five cycles','That confuses latency with initiation interval.'],
    ['One result per cycle after the pipeline fills','Multiple operations overlap in the pipeline.'],
    ['Five results per cycle','Pipeline depth alone does not create five output lanes.'],
    ['One result total','The unit can accept successive operations.']
  ],[1],'Measure startup latency, sustained throughput, and stall behavior separately. Pipeline depth does not directly determine result rate.'),
  q('arch-02','arch','Advanced','Simultaneous queue operations','A FIFO has occupancy 3. One enqueue and one dequeue are both accepted on the same edge. What should the next occupancy be?',[
    ['3','Accepted enqueue adds one and accepted dequeue subtracts one.'],
    ['4','That accounts for the enqueue but drops the dequeue.'],
    ['2','That accounts for the dequeue but drops the enqueue.'],
    ['0','Simultaneous operations do not imply a flush.']
  ],[0],'Base occupancy on accepted operations, not raw requests. Full/empty boundary behavior must be specified separately.'),
  q('arch-03','arch','Advanced','Full does not specify simultaneous behavior','A depth-4 FIFO is full. Push and pop are requested together. Which statement is universally valid without further specification?',[
    ['The push must always be accepted','Some designs allow replacement on a simultaneous pop; others intentionally do not.'],
    ['The push must always be rejected','A full-throughput implementation can permit it if a pop is accepted.'],
    ['Acceptance depends on the FIFO\'s documented interface contract','Full-boundary throughput and readiness rules are architectural choices.'],
    ['The queue must become empty','A single pop cannot drain four entries.']
  ],[2],'Ask about boundary semantics before writing a checker. Do not turn an implementation preference into an unstated requirement.'),
  q('arch-04','arch','Advanced','Arbitration fairness','A fixed-priority arbiter always prefers requester 0. Requester 0 stays active forever. What can happen to requester 3?',[
    ['It can starve despite mutual exclusion being correct','Safety of grant selection does not establish fairness.'],
    ['It must be served within four cycles','Fixed priority has no such bound under continuous higher-priority traffic.'],
    ['It receives every fourth grant automatically','That would require a different fairness policy.'],
    ['Its request becomes invalid because it waited','Waiting does not inherently invalidate an eligible request.']
  ],[0],'Verify both legal grant selection and the intended progress policy. Round-robin fairness still needs assumptions about downstream service.'),
  q('arch-05','arch','Advanced','Backpressure in an elastic stage','A one-entry output stage is holding valid data and the downstream is not ready. What must the stage do?',[
    ['Preserve the stored payload and valid until acceptance','The held item remains an obligation during a stall.'],
    ['Overwrite the payload with each new input','That loses the stalled item unless a separate storage mechanism exists.'],
    ['Clear valid for one cycle','Withdrawing an unaccepted item violates the stated holding contract.'],
    ['Always accept a second item without storage','Capacity must be respected.']
  ],[0],'Derive ready from storage availability and simultaneous output acceptance. Check full, empty, stall, and replacement transitions.'),
  q('arch-06','arch','Advanced','A dependent instruction','Instruction B consumes a register produced by older instruction A, whose result is not yet in the register file. Which mechanisms can preserve correctness?',[
    ['Forward the correct result when it is available','Bypassing can supply a result before register-file writeback.'],
    ['Stall B until its operand is available','A stall is needed when forwarding cannot yet provide the value.'],
    ['Always read the old register-file value','That violates the true dependency.'],
    ['Ignore the dependency if instruction encodings differ','Dependency is about dataflow, not identical opcodes.']
  ],[0,1],'Reason about operand availability at the consuming stage. A load-use hazard may require a stall even in a forwarded pipeline.'),
  q('arch-07','arch','Advanced','The wrong-path store','A younger store follows an unresolved branch. If the branch later redirects execution, what must a precise speculative machine prevent?',[
    ['The squashed store making an architecturally visible memory update','Wrong-path execution must not commit architectural side effects.'],
    ['All speculative computation of the store address','Address computation can be speculative if side effects remain controlled.'],
    ['Fetching any instruction after a branch','Speculative fetch is allowed by this architecture.'],
    ['The branch updating its own architectural state','The resolved branch is not necessarily squashed.']
  ],[0],'Distinguish execution from commitment. Verify side-effect gating at the point where state becomes architecturally visible.'),
  q('arch-08','arch','Intermediate','A direct-mapped conflict','A direct-mapped cache repeatedly accesses two distinct blocks mapping to the same index, with different tags. What miss behavior is likely?',[
    ['Conflict misses as the blocks evict each other','Both blocks compete for one cache location despite other indices possibly being unused.'],
    ['Only a single compulsory miss in total','Each block needs its own initial fill, and subsequent conflicts can continue.'],
    ['Guaranteed hits after the first two accesses','A direct-mapped index cannot retain both blocks simultaneously.'],
    ['No misses because the addresses differ','Address difference does not prevent index conflicts.']
  ],[0],'Separate compulsory, capacity, and conflict effects. Cache capacity alone does not determine behavior for a particular access pattern.'),
  q('arch-09','arch','Advanced','Wrapping an arbitrary-depth pointer','A FIFO has depth 6 and a 3-bit address pointer. Why is simple pointer <= pointer + 1 insufficient for address generation?',[
    ['Natural binary rollover reaches addresses 6 and 7','The legal storage indices are only 0 through 5.'],
    ['A 3-bit value cannot represent 5','Three bits can represent 0 through 7.'],
    ['Every FIFO depth must be a power of two','Arbitrary-depth synchronous FIFOs are possible with appropriate wrap logic.'],
    ['The pointer must increment by two','That would skip entries rather than implement correct wrapping.']
  ],[0],'Parameterization affects arithmetic, wrap logic, occupancy, and flag proofs. Test depths such as 1, 3, and 6, not only powers of two.'),
  q('arch-10','arch','Advanced','Credits must be conserved','A link starts with 8 credits. Each accepted packet consumes one and each valid credit return adds one. Which invariants matter?',[
    ['Send only when a credit is available under the defined same-cycle return rules','A credit represents downstream capacity, so acceptance must obey the contract.'],
    ['Track simultaneous send and return without dropping either update','Otherwise capacity accounting drifts.'],
    ['Increment credit count on every attempted send','Sending consumes a credit rather than creates one.'],
    ['Allow duplicate credit returns because they increase throughput','Duplicate returns invent capacity and can cause overflow.']
  ],[0,1],'Treat credits as conserved resources. Verify reset initialization, simultaneous events, duplicate returns, and the maximum count.'),

  q('debug-01','debug','Intermediate','The handshake is an edge event','valid is high for four sampled edges. ready is low for the first three and high on the fourth. How many transfers were accepted?',[
    ['Four','Valid alone indicates an offered item, not acceptance.'],
    ['One','Only one sampled edge has both valid and ready high.'],
    ['Zero','The fourth edge satisfies the acceptance condition.'],
    ['Three','Stalled edges do not accept transfers.']
  ],[1],'Count accepted transfers from the sampled handshake. This same event should drive monitors, occupancy accounting, and throughput measurements.'),
  q('debug-02','debug','Advanced','A deadlock by politeness','On an AXI channel, the source waits for READY before asserting VALID, and the destination waits for VALID before asserting READY. What is wrong?',[
    ['The source is violating the VALID independence requirement','The source must be able to present available work without first waiting for READY.'],
    ['Only the destination is violating the protocol','An AXI destination can wait for VALID before asserting READY.'],
    ['This guarantees the lowest latency','Both sides can wait forever.'],
    ['Nothing, because no data has been corrupted yet','Lack of progress can still reveal a protocol violation.']
  ],[0],'A handshake protocol defines both transfer and progress rules. Check dependency between control signals, not just data values.'),
  q('debug-03','debug','Advanced','AXI write channels are independent','A slave sees write data before it has accepted the corresponding write address. What is the best verification stance for AXI4?',[
    ['Declare every such sequence illegal','Address and data channels do not have a fixed handshake ordering.'],
    ['Exercise legal channel skew and check the slave handles or backpressures it correctly','The implementation must respect the independent channels while maintaining write association.'],
    ['Assume address and data always handshake together','That constrains away legal behavior.'],
    ['Ignore write data until the next reset','This loses legal transfers.']
  ],[1],'Vary channel timing independently in protocol tests. A convenient driver schedule must not become an accidental environment assumption.'),
  q('debug-04','debug','Advanced','A burst boundary mistake','An AXI4 INCR burst has AxLEN = 3 and AxSIZE = 2. How many beats are specified, and how many bytes per beat?',[
    ['3 beats, 2 bytes per beat','AxLEN encodes beats minus one; AxSIZE encodes log2(bytes per beat).'],
    ['4 beats, 4 bytes per beat','AxLEN+1 is 4, and 2^AxSIZE is 4 bytes.'],
    ['4 beats, 2 bytes per beat','The beat count is right but the size field is exponential.'],
    ['8 beats, 3 bytes per beat','Neither field has that interpretation.']
  ],[1],'Decode protocol fields before checking addresses, last-beat markers, or byte masks. Off-by-one mistakes often cluster at burst boundaries.'),
  q('debug-05','debug','Advanced','Start at the first divergence','A regression logs a mismatch at cycle 9000 followed by hundreds of errors. What is the most useful initial debugging step?',[
    ['Find the earliest divergence and trace its causal inputs and state','Later errors may be consequences of the first broken invariant.'],
    ['Fix the last error in the log first','It may only be downstream fallout.'],
    ['Increase all timeouts','A data mismatch is not necessarily a timeout problem.'],
    ['Suppress the checker until the log is quiet','This removes evidence without fixing the cause.']
  ],[0],'Build a causal timeline: accepted input, expected state transition, first wrong state, then visible output failure.'),
  q('debug-06','debug','Intermediate','Preserve the reproducer','A rare random test fails once. What should you capture before modifying the environment?',[
    ['Seed, source revisions, tool version, configuration, and failure evidence','A seed alone may not reproduce behavior after code or tool changes.'],
    ['Only the final screenshot','It usually omits the state needed to rerun the test.'],
    ['Only the test name','Different seeds and configurations can exercise very different behavior.'],
    ['Nothing; random tests cannot be reproduced','Controlled pseudo-random tests are often reproducible with sufficient context.']
  ],[0],'A reproducible failure is an engineering artifact. Preserve it, then reduce it without losing the triggering behavior.'),
  q('debug-07','debug','Advanced','Balanced counts can still hide loss','A checker observes 100 accepted requests and 100 responses. Why is this insufficient to prove transaction integrity?',[
    ['A duplicate response could balance a missing response','Equal totals do not establish a one-to-one mapping.'],
    ['The responses could contain incorrect data','Count conservation alone does not verify payload correctness.'],
    ['Equal totals prove correct ordering','The same totals can arise with illegal reordering.'],
    ['Counts are never useful','Counts are valuable complementary invariants, just not sufficient by themselves.']
  ],[0,1],'Combine conservation checks with identity, payload, and ordering checks. Independent invariants catch different bug classes.'),
  q('debug-08','debug','Advanced','Randomize the stall pattern','An interface passes tests with READY always high. Which additions are especially useful?',[
    ['Long stalls followed by back-to-back acceptance','This stresses holding behavior and the transition back to full rate.'],
    ['Stalls on the last beat and near buffer-full boundaries','These target control transitions where data loss and off-by-one bugs often occur.'],
    ['Require VALID to drop whenever READY drops','That would mask a violation of a holding-style valid/ready contract.'],
    ['Only use a faster clock','Frequency changes alone do not exercise cycle-level backpressure patterns.']
  ],[0,1],'Target state transitions and boundary combinations. Randomness is useful when it reaches meaningful scenarios and the checker models them correctly.'),
  q('debug-09','debug','Advanced','Separate checker error from DUT error','A scoreboard mismatch appears only when two responses occur in the same cycle on separate lanes. What should you investigate?',[
    ['Monitor capture and scoreboard handling of simultaneous events','A testbench may lose or misorder one of the observations.'],
    ['The DUT\'s simultaneous-lane behavior against the specification','The implementation might also violate the multi-lane contract.'],
    ['Assume the scoreboard is correct because it is software','Checkers have concurrency and modeling bugs too.'],
    ['Disable one lane in every future test','This hides the scenario rather than resolving it.']
  ],[0,1],'Use independent interface evidence to locate the first disagreement. Validate the observation and expected model before assigning blame.'),
  q('debug-10','debug','Advanced','From bug fix to regression protection','After fixing a FIFO bug triggered by reset during a simultaneous push/pop, what should you add?',[
    ['A focused test or assertion for the failure mechanism and nearby boundaries','This guards the precise bug class and helps expose related mistakes.'],
    ['Only the original full-system seed forever','Keep the seed, but a smaller check localizes failures and improves protection.'],
    ['A coverage exclusion for reset collisions','The collision is legal if the specification permits it, so it should remain tested.'],
    ['A comment saying the FIFO is now correct','A comment does not execute or establish correctness.']
  ],[0],'A useful regression test captures the violated requirement, not just the accidental details of one failing run.'),
  ...interviewQuestions,
];
export const reading = [
  { name: 'lowRISC RTL style guide', note: 'RTL coding conventions and common semantic traps', url: 'https://github.com/lowRISC/style-guides/blob/master/VerilogCodingStyle.md' },
  { name: 'Accellera assertion tutorial', note: 'Temporal properties, sampling, and formal reasoning', url: 'https://www.accellera.org/resources/videos/systemverilog-assertions-tutorial-2016' },
  { name: 'Accellera UVM resources', note: 'Official methodology and reference implementations', url: 'https://www.accellera.org/downloads/standards/uvm' },
  { name: 'Arm AMBA AXI specification', note: 'Authoritative channel, ordering, and burst rules', url: 'https://developer.arm.com/-/media/Arm%20Developer%20Community/PDF/IHI0022H_amba_axi_protocol_spec.pdf' },
];
