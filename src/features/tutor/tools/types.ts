/**
 * Tutor tool framework (plan §15) — server-side capabilities the orchestrator
 * (and later phases) call deterministically. The model NEVER touches the
 * database; everything it could misuse is resolved here.
 *
 * Contract per §15:
 * - capability-limited: every tool declares `readOnly`; write tools arrive
 *   later behind explicit whitelists
 * - audited: each run records name/outcome/duration — NEVER input content,
 *   which can carry child message text (§19)
 * - safe by default: runTool never throws to callers; a failed tool degrades
 *   to `ok:false` so a retrieval problem cannot break a child's turn (§37)
 */

export interface ToolOutcome<T> {
  ok: boolean;
  /** Machine-readable failure reason; never shown to a child. */
  error?: string;
  data?: T;
  durationMs: number;
}

export interface TutorTool<TInput, TOutput> {
  readonly name: string;
  readonly description: string;
  readonly readOnly: boolean;
  /**
   * Deterministic input guard — throws AppError.validation on bad input.
   * Kept as code (not a JSON-schema engine): tool inputs are few and simple,
   * mirroring assertReasonableMessage in the safety layer.
   */
  validate?(input: TInput): void;
  execute(input: TInput): Promise<TOutput>;
}

export type ToolAudit = (entry: {
  tool: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}) => void;

/** Default audit sink — structured stdout, no input content (§19). */
export const consoleAudit: ToolAudit = (entry) => {
  if (process.env.NODE_ENV === "test") return;
  console.info("[tool]", entry.tool, entry.ok ? "ok" : `failed:${entry.error ?? "unknown"}`, `${entry.durationMs}ms`);
};

/**
 * Runs a tool under the §15 contract: validate → execute → time → audit.
 * Never throws; failures come back as { ok:false } with a machine reason.
 */
export async function runTool<TInput, TOutput>(
  tool: TutorTool<TInput, TOutput>,
  input: TInput,
  audit: ToolAudit = consoleAudit
): Promise<ToolOutcome<TOutput>> {
  const started = Date.now();
  try {
    tool.validate?.(input);
    const data = await tool.execute(input);
    const durationMs = Date.now() - started;
    audit({ tool: tool.name, ok: true, durationMs });
    return { ok: true, data, durationMs };
  } catch (error) {
    const durationMs = Date.now() - started;
    const err = error as Error;
    const reason = err?.name === "AppError" ? err.message : err?.name || "unknown";
    audit({ tool: tool.name, ok: false, durationMs, error: reason });
    return { ok: false, error: reason, durationMs };
  }
}
