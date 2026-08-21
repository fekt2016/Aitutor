/**
 * POST /api/v1/tutor/sessions/:id/messages (plan §26) — send a turn, stream
 * the tutor's reply as SSE.
 *
 * Safety-first streaming: input is validated + moderated, the tutor turn is
 * generated and its OUTPUT is moderated and checked BEFORE any content streams
 * to the child (§18.5). The approved text is then streamed as SSE deltas and
 * the full action envelope follows on `done` (drives the answer widgets).
 *
 * Events:
 *   meta    {sessionId, messageId}
 *   delta   {text}            — word chunks of the approved reply
 *   blocked {text}            — input was moderated; warm deflection instead
 *   done    {envelope, mastery, usage}
 *   error   {message}
 */
import { withApiHandler, readJson, type ApiHandlerContext } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { ensureDb } from "@/server/db";
import { getSessionUser, requireOwner } from "@/lib/authorize";
import { StudentProfileModel, GradeLevelModel, TutorMessageModel, TutorSessionModel, UserModel } from "@/models";
import { assertReasonableMessage, moderateInput } from "@/features/tutor/safety/moderation";
import { deflectionFor } from "@/features/tutor/safety/deflections";
import { assertSessionActive, assertSessionMessageCap } from "@/features/tutor/caps";
import { getProvider } from "@/features/tutor/providers";
import { TutorOrchestrator } from "@/features/tutor/orchestrator/orchestrator";

export const POST = withApiHandler(async (req, ctx: ApiHandlerContext) => {
  const user = await getSessionUser();
  await ensureDb();
  const { id } = (await ctx.params) as { id: string };

  const session = await TutorSessionModel.findById(id).lean();
  if (!session) throw AppError.notFound("That session doesn't exist.");

  const studentId = session.studentId.toString();
  await requireOwner(user, studentId);

  const body = await readJson(req, { allowedFields: ["content"] });
  const content = typeof body.content === "string" ? body.content.trim() : "";
  assertReasonableMessage(content);

  assertSessionActive(session);
  await assertSessionMessageCap(session);

  const provider = getProvider();
  const verdict = await moderateInput(provider, {
    text: content,
    studentId,
    sessionId: id,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Input was flagged → warm deflection, persist a system note (§18.2).
        if (verdict.flagged) {
          const message = deflectionFor(verdict.categories);
          await TutorMessageModel.create({
            sessionId: session._id,
            role: "system",
            contentType: "text",
            content: message,
            safety: { moderated: true, verdict: "blocked" },
          });
          send("blocked", { text: message });
          send("done", { envelope: null, mastery: null, blocked: true });
          controller.close();
          return;
        }

        // Persist the user's message (the transcript is purged per §19 —
        // summaries + signals persist instead).
        const userMessage = await TutorMessageModel.create({
          sessionId: session._id,
          role: "user",
          contentType: "text",
          content,
          safety: { moderated: true, verdict: "ok" },
        });

        const profile = await StudentProfileModel.findOne({ studentId }).lean();
        const grade = profile?.gradeLevelId
          ? await GradeLevelModel.findById(profile.gradeLevelId).lean()
          : null;
        const studentUser = await UserModel.findById(studentId).select("name ageBand").lean();

        const orchestrator = new TutorOrchestrator(provider);
        const result = await orchestrator.handleTurn({
          studentId,
          session,
          userMessage: content,
          student: {
            name: studentUser?.name ?? null,
            ageBand: studentUser?.ageBand ?? null,
            gradeName: grade?.name ?? null,
            gradeLevelId: profile?.gradeLevelId?.toString() ?? null,
            vocabularyLevel: grade?.vocabularyLevel,
            explanationDepth: grade?.explanationDepth,
            interactionStyle: grade?.interactionStyle,
          },
        });

        send("meta", { sessionId: id, messageId: result.assistantMessageId });

        // Stream the approved text in word chunks (approved before streaming).
        const words = result.envelope.response.split(/(\s+)/);
        for (const word of words) {
          if (word.length === 0) continue;
          send("delta", { text: word });
        }

        send("done", {
          envelope: result.envelope,
          mastery: result.mastery ?? null,
          usage: result.usage,
          userMessageId: userMessage._id.toString(),
        });
        controller.close();
      } catch (error) {
        console.error("[tutor] streaming turn failed", {
          name: error instanceof Error ? error.name : typeof error,
        });
        send("error", { message: "My learning machine hiccuped! Please try again in a moment." });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});

export const dynamic = "force-dynamic";