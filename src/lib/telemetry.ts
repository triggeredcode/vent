import * as Sentry from "@sentry/nextjs";

type Attributes = Record<string, string | number | boolean | undefined>;

/**
 * Wraps a step of the voice/journal pipeline in a Sentry span.
 * Spans carry timings, model names and token counts only — never transcripts,
 * journal text, or audio. Without SENTRY_DSN this is a transparent pass-through.
 */
export function traced<T>(name: string, op: string, attributes: Attributes, run: (span: Sentry.Span) => Promise<T>) {
  return Sentry.startSpan({ name, op, attributes }, run);
}

export function recordUsage(span: Sentry.Span, usage: { model: string; inputTokens?: number; outputTokens?: number; ms: number }) {
  span.setAttributes({
    "gen_ai.system": "ollama",
    "gen_ai.request.model": usage.model,
    "gen_ai.usage.input_tokens": usage.inputTokens,
    "gen_ai.usage.output_tokens": usage.outputTokens,
    "vent.duration_ms": usage.ms,
  });
}
