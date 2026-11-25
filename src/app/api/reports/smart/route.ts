import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, AuthError } from '@/lib/auth/session';
import { buildSmartReportSnapshot } from '@/lib/reports/smartReportData';

/**
 * POST /api/reports/smart { question } — Smart Reports (review of 18 Nov 2026, item 12).
 *
 * Answers a plain-English question about the recruitment data the viewer can see, using Claude.
 * The model only gets the scoped, PII-free snapshot from buildSmartReportSnapshot and is told to
 * answer from it alone. The answer streams back as plain text (markdown-light).
 *
 * Needs ANTHROPIC_API_KEY on the server. Without it the route answers 503 with a setup message
 * and the rest of the app is unaffected.
 */
const questionSchema = z.object({
  question: z.string().trim().min(3, 'Ask a question').max(1000, 'Keep the question under 1000 characters'),
});

const MODEL = 'claude-opus-5-5';

const SYSTEM_PROMPT = `You are the reporting assistant inside Costaff ATS, a recruitment tracking app used by a staffing company in India (Delivery Head, Account Managers, SPOCs and Recruiters).

You answer questions about the JSON data snapshot in the user's message. The snapshot is everything the person asking is allowed to see: their demands (requirements) with client, status, priority, positions, days open and candidate counts; pipeline status totals; interviews per day for the last 30 and next 14 days; how long candidates have waited in each phase; and, for the Delivery Head only, team activity.

How to answer:
- Use only the snapshot. If it does not hold what is needed, say what is missing and suggest which report in the app would show it (Client-wise Demands, Today's Interviews, Ready to Join, Candidate Aging, Team Contribution).
- Lead with the direct answer, then the supporting numbers. Use short headings, bullet points and small markdown tables when they help. Keep it under about 250 words unless the question needs a longer list.
- Refer to demands by their Requirement ID (e.g. CSF-2026-0004) and client name. There are no candidate names in the data; never invent any.
- Dates are India dates (today is given in the snapshot). "Aging" means days in the current phase.
- Point out anything that needs attention when it is relevant to the question (demands open over 30 days, long waits in a phase, days with many interviews).`;

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const parsed = questionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Ask a question' }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Smart Reports is not set up yet. An admin needs to add the ANTHROPIC_API_KEY setting on the server.' },
        { status: 503 }
      );
    }

    const snapshot = await buildSmartReportSnapshot(user);
    const client = new Anthropic();
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      // Quick, readable answers: reports are a lookup, not a deep analysis.
      output_config: { effort: 'low' },
      // On a policy decline the API retries on a fallback model inside the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: `Data snapshot (JSON):\n${JSON.stringify(snapshot)}\n\nQuestion: ${parsed.data.question}`,
        },
      ],
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          const final = await stream.finalMessage();
          if (final.stop_reason === 'refusal') {
            controller.enqueue(encoder.encode('\n\nSorry, I can’t answer that one. Try asking it a different way.'));
          } else if (final.stop_reason === 'max_tokens') {
            controller.enqueue(encoder.encode('\n\n(Answer cut short. Ask a narrower question for the rest.)'));
          }
        } catch (error) {
          console.error('Smart Reports stream error:', error);
          controller.enqueue(encoder.encode('\n\nSorry, the answer could not be completed. Please try again.'));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'Smart Reports could not sign in to the AI service. Check the ANTHROPIC_API_KEY setting.' }, { status: 503 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'The AI service is busy. Please try again in a minute.' }, { status: 429 });
    }
    console.error('Error in POST /api/reports/smart:', error);
    return NextResponse.json({ error: 'Failed to build the smart report' }, { status: 500 });
  }
}
