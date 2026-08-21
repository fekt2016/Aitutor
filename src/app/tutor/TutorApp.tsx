"use client";

/**
 * TutorApp — the child's tutor experience (plan §31 Phase 1, §42.12).
 * Three steps: pick a subject → streamed chat with answer widgets → summary.
 *
 * Streaming: a plain fetch reads the SSE stream (meta/delta/blocked/done/
 * error). The tutor's output is moderated BEFORE it streams (§18.5), so the
 * UI simply renders approved deltas.
 *
 * Design: tokens only (§42.11–12) — no hard-coded colors, no emoji in chrome.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import Link from "next/link";
import { BrandMark, Wordmark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";

interface SubjectOption {
  _id: string;
  code: string;
  name: string;
}

interface QuestionWidget {
  prompt: string;
  type: "mcq" | "free";
  options: string[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  question?: QuestionWidget | null;
  hint?: string | null;
  hintAvailable?: boolean;
  completed?: boolean;
}

interface MasteryResult {
  skillName: string;
  skillId: string;
  score: number;
  band: "needs_support" | "developing" | "progressing" | "mastered";
}

interface SessionSummary {
  stats: { messages: number; correct: number; wrong: number; hintsUsed: number };
  mastery: MasteryResult[];
}

interface Envelope {
  response: string;
  interaction_type: string;
  skill: string;
  difficulty: number;
  hint_available: boolean;
  requires_action: "question" | "none";
  question?: QuestionWidget | null;
  hint?: string | null;
  praise?: boolean;
  learning_signal: { type: string; value: number };
  completed: boolean;
}

interface DonePayload {
  envelope: Envelope | null;
  mastery: MasteryResult | null;
  blocked?: boolean;
}

const BAND_LABEL: Record<MasteryResult["band"], string> = {
  needs_support: "Needs support",
  developing: "Developing",
  progressing: "Progressing",
  mastered: "Mastered",
};

/* ------------------------------------------------------------------ */
/* Styled layout (design tokens, §42.11–12)                            */
/* ------------------------------------------------------------------ */

const Shell = styled.main`
  max-width: 760px;
  margin: 0 auto;
  padding: var(--space-2xl) var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-2xl);
  min-height: 100vh;
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  flex-wrap: wrap;
`;

const Brand = styled(Link)`
  display: flex;
  align-items: center;
  gap: var(--space-md);
  text-decoration: none;
  color: inherit;
`;

const Title = styled.h1`
  font-size: var(--text-h1);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.01em;
`;

const Subtitle = styled.p`
  color: var(--color-ink-muted);
  font-size: var(--text-body-lg);
`;

const ChatCard = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const ChatScroll = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-2xl);
  overflow-y: auto;
  flex: 1;
  min-height: 320px;
  max-height: 55vh;
`;

const MessageRow = styled.div<{ $role: string }>`
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  flex-direction: ${(p) => (p.$role === "user" ? "row-reverse" : "row")};
`;

const Avatar = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-pill);
  background: var(--color-primary-subtle);
`;

const Bubble = styled.div<{ $role: string }>`
  max-width: 82%;
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-lg);
  font-size: var(--text-body-lg);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;

  ${(p) =>
    p.$role === "user"
      ? `
        background: var(--color-primary);
        color: var(--color-white);
        border-bottom-right-radius: var(--radius-sm);
      `
      : p.$role === "system"
        ? `
          margin: 0 auto;
          background: var(--color-warning-subtle);
          color: var(--color-ink-secondary);
          font-size: var(--text-small);
          text-align: center;
        `
        : `
          background: var(--color-surface-secondary);
          color: var(--color-ink);
          border-bottom-left-radius: var(--radius-sm);
        `}
`;

const ChatFooter = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg) var(--space-2xl);
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
`;

const InputRow = styled.div`
  display: flex;
  gap: var(--space-md);
`;

const StyledInput = styled.input`
  flex: 1;
  min-height: 48px;
  padding: 0 var(--space-lg);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: var(--text-body);

  &::placeholder {
    color: var(--color-ink-faint);
  }

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: var(--focus-ring);
  }

  &:disabled {
    background: var(--color-surface-secondary);
    opacity: 0.7;
  }
`;

const WidgetCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-top: var(--space-md);
  padding: var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
`;

const OptionButton = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  padding: var(--space-md) var(--space-lg);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);

  &:hover:not(:disabled) {
    background: var(--color-primary-subtle);
    border-color: var(--color-primary);
  }

  &:disabled {
    opacity: var(--color-disabled-opacity, 0.6);
    cursor: not-allowed;
  }
`;

const HintRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-md);
`;

const TypingDots = styled.span`
  display: inline-flex;
  gap: 4px;
  padding: var(--space-sm) var(--space-lg);

  span {
    width: 7px;
    height: 7px;
    border-radius: var(--radius-pill);
    background: var(--color-ink-faint);
    animation: blink 1.2s var(--ease-standard) infinite;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }
    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }

  @keyframes blink {
    0%,
    80%,
    100% {
      opacity: 0.3;
    }
    40% {
      opacity: 1;
    }
  }
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-md);
`;

const StatCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
`;

const StatValue = styled.strong`
  font-size: var(--text-h2);
  font-weight: var(--font-weight-bold);
  font-family: var(--font-mono);
`;

const StatLabel = styled.span`
  font-size: var(--text-small);
  color: var(--color-ink-muted);
`;

const MasteryRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
`;

const ErrorBanner = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  background: var(--color-danger-subtle);
  color: var(--color-danger);
  font-size: var(--text-small);
`;

const SubjectGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-lg);
`;

const SubjectCard = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-2xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-ink);
  font-family: var(--font-sans);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);

  &:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-elevation-1);
  }
`;

const SubjectName = styled.strong`
  font-size: var(--text-h3);
  font-weight: var(--font-weight-bold);
  color: var(--color-ink);
`;

/* ------------------------------------------------------------------ */
/* SSE parsing                                                         */
/* ------------------------------------------------------------------ */

async function* readSse(response: Response): AsyncGenerator<{ event: string; data: unknown }> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator: number;
    while ((separator = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const eventLine = raw.split("\n").find((line) => line.startsWith("event: "));
      const dataLine = raw.split("\n").find((line) => line.startsWith("data: "));
      if (!eventLine || !dataLine) continue;
      let data: unknown;
      try {
        data = JSON.parse(dataLine.slice(6));
      } catch {
        continue;
      }
      yield { event: eventLine.slice(7), data };
    }
  }
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

interface TutorAppProps {
  studentName: string;
  gradeName: string | null;
  subjects: SubjectOption[];
}

type Step = "pick" | "chat" | "summary";

export default function TutorApp({ studentName, gradeName, subjects }: TutorAppProps) {
  const [step, setStep] = useState<Step>("pick");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [skillName, setSkillName] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  const createSession = useCallback(async (subjectId: string) => {
    setError(null);
    try {
      const response = await fetch("/api/v1/tutor/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Couldn't start a session. Try again!");
        return;
      }
      const session = body.data.session;
      setSessionId(session.id);
      setSubjectName(session.subject);
      setSkillName(session.skill?.name ?? "");
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          text: `Hi ${studentName.split(" ")[0]}! I'm Eazi, your learning buddy${gradeName ? ` for ${gradeName}` : ""}. Let's have fun with ${session.subject}${
            session.skill?.name ? ` — we'll learn about ${session.skill.name}` : ""
          }! Say hello or ask me anything.`,
        },
      ]);
      setStep("chat");
    } catch {
      setError("My learning machine is waking up. Try again in a moment!");
    }
  }, [studentName, gradeName]);

  const endSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`/api/v1/tutor/sessions/${sessionId}/end`, { method: "POST" });
      const body = await response.json();
      if (response.ok) {
        setSummary({
          stats: body.data.session.stats,
          mastery: body.data.mastery,
        });
        setStep("summary");
      }
    } catch {
      setSummary({ stats: { messages: 0, correct: 0, wrong: 0, hintsUsed: 0 }, mastery: [] });
      setStep("summary");
    }
  }, [sessionId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming || !sessionId) return;
      setInput("");
      setError(null);

      const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: trimmed };
      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      setStreamText("");
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", text: "", hintAvailable: false },
      ]);

      try {
        const response = await fetch(`/api/v1/tutor/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error?.message ?? "Something went wrong. Try again!");
        }

        let finalEnvelope: Envelope | null = null;
        let blockedText: string | null = null;
        let fullText = "";

        for await (const { event, data } of readSse(response)) {
          if (event === "delta") {
            fullText += (data as { text: string }).text;
            setStreamText(fullText);
          } else if (event === "blocked") {
            blockedText = (data as { text: string }).text;
          } else if (event === "done") {
            finalEnvelope = (data as DonePayload).envelope;
          } else if (event === "error") {
            throw new Error((data as { message: string }).message);
          }
        }

        if (blockedText) {
          setMessages((prev) => [
            ...prev.filter((m) => !(m.role === "assistant" && m.text === "")),
            { id: `s-${Date.now()}`, role: "system", text: blockedText },
          ]);
          setIsStreaming(false);
          setStreamText("");
          return;
        }

        if (finalEnvelope) {
          const text = fullText || finalEnvelope.response;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant" && last.text === "") {
              next[next.length - 1] = {
                ...last,
                text,
                question: finalEnvelope.question ?? null,
                hint: finalEnvelope.hint ?? null,
                hintAvailable: finalEnvelope.hint_available,
                completed: finalEnvelope.completed,
              };
            }
            return next;
          });

          if (finalEnvelope.completed) {
            await endSession();
          }
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "My learning machine hiccuped. Try again!";
        setError(message);
        setMessages((prev) => [
          ...prev.filter((m) => !(m.role === "assistant" && m.text === "")),
          { id: `e-${Date.now()}`, role: "system", text: message },
        ]);
      } finally {
        setIsStreaming(false);
        setStreamText("");
      }
    },
    [isStreaming, sessionId, endSession]
  );

  const resetToPick = useCallback(() => {
    setStep("pick");
    setSessionId(null);
    setMessages([]);
    setSummary(null);
    setError(null);
  }, []);

  /* ------------------------------------------------------------------ */

  if (step === "pick") {
    return (
      <Shell>
        <Header>
          <Brand href="/">
            <BrandMark size={36} />
            <Wordmark size="body" />
          </Brand>
          <Link href="/dashboard">
            <Button $variant="secondary" $size="sm">
              Dashboard
            </Button>
          </Link>
        </Header>
        <div>
          <Title>Ready to learn, {studentName.split(" ")[0]}?</Title>
          <Subtitle>Pick a subject — I&apos;ll meet you inside.</Subtitle>
        </div>
        {error && (
          <ErrorBanner>
            <Icon name="alert-triangle" size={18} />
            {error}
          </ErrorBanner>
        )}
        <SubjectGrid>
          {subjects.map((subject) => (
            <SubjectCard key={subject._id} onClick={() => createSession(subject._id)}>
              <Icon name={subject.code.startsWith("MATHEMATICS") ? "trending-up" : "book-open"} size={24} />
              <SubjectName>{subject.name}</SubjectName>
              <span style={{ color: "var(--color-ink-muted)", fontSize: "var(--text-small)" }}>
                Start learning
              </span>
            </SubjectCard>
          ))}
        </SubjectGrid>
      </Shell>
    );
  }

  if (step === "summary") {
    const { stats, mastery } = summary ?? { stats: { messages: 0, correct: 0, wrong: 0, hintsUsed: 0 }, mastery: [] };
    return (
      <Shell>
        <Header>
          <Brand href="/">
            <BrandMark size={36} />
            <Wordmark size="body" />
          </Brand>
          <Link href="/dashboard">
            <Button $variant="secondary" $size="sm">
              Dashboard
            </Button>
          </Link>
        </Header>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
          <Avatar style={{ width: 56, height: 56 }}>
            <Icon name="star" size={28} filled />
          </Avatar>
          <div>
            <Title>Well done!</Title>
            <Subtitle>
              You finished your {subjectName} session{skillName ? ` on ${skillName}` : ""}. Every bit of
              practice makes your brain stronger!
            </Subtitle>
          </div>
        </div>
        <SummaryGrid>
          <StatCard>
            <StatValue>{stats.messages}</StatValue>
            <StatLabel>Messages</StatLabel>
          </StatCard>
          <StatCard>
            <StatValue>{stats.correct}</StatValue>
            <StatLabel>Correct answers</StatLabel>
          </StatCard>
          <StatCard>
            <StatValue>{stats.wrong}</StatValue>
            <StatLabel>Try-again moments</StatLabel>
          </StatCard>
          <StatCard>
            <StatValue>{stats.hintsUsed}</StatValue>
            <StatLabel>Hints used</StatLabel>
          </StatCard>
        </SummaryGrid>
        {mastery.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <Subtitle style={{ margin: 0 }}>Your progress</Subtitle>
            {mastery.map((m) => (
              <MasteryRow key={m.skillId}>
                <span style={{ fontWeight: "var(--font-weight-semibold)" }}>{m.skillName}</span>
                <Badge>{BAND_LABEL[m.band]}</Badge>
              </MasteryRow>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: "var(--space-md)", flexWrap: "wrap" }}>
          <Button onClick={resetToPick}>
            <Icon name="plus" size={18} />
            New session
          </Button>
          <Link href="/dashboard">
            <Button $variant="secondary">Back to dashboard</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  /* Chat step */
  const currentAssistant = messages.find((m) => m.role === "assistant" && m.text === "" && m.id.startsWith("a-"));

  return (
    <Shell>
      <Header>
        <Brand href="/">
          <BrandMark size={36} />
          <Wordmark size="body" />
        </Brand>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <Badge>{subjectName}</Badge>
          <Button $variant="secondary" $size="sm" onClick={() => void endSession()} disabled={isStreaming}>
            End session
          </Button>
        </div>
      </Header>

      <ChatCard>
        <ChatScroll>
          {messages.map((message) => (
            <MessageRow key={message.id} $role={message.role}>
              {message.role !== "user" && (
                <Avatar aria-hidden>
                  <Icon name="sparkles" size={18} />
                </Avatar>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", alignItems: message.role === "user" ? "flex-end" : "flex-start", width: "100%" }}>
                {message.text && (
                  <Bubble $role={message.role}>{message.text}</Bubble>
                )}
                {message.role === "assistant" && message.question && message.text && (
                  <WidgetCard>
                    <strong style={{ fontSize: "var(--text-body-lg)" }}>{message.question.prompt}</strong>
                    {message.question.type === "mcq" ? (
                      message.question.options.map((option) => (
                        <OptionButton key={option} onClick={() => void sendMessage(option)} disabled={isStreaming}>
                          {option}
                        </OptionButton>
                      ))
                    ) : (
                      <InputRow>
                        <StyledInput
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !isStreaming) void sendMessage(input);
                          }}
                          placeholder="Type your answer…"
                          disabled={isStreaming}
                          aria-label="Your answer"
                        />
                        <Button onClick={() => void sendMessage(input)} disabled={isStreaming || !input.trim()}>
                          <Icon name="arrow-right" size={18} />
                        </Button>
                      </InputRow>
                    )}
                  </WidgetCard>
                )}
                {message.role === "assistant" && message.hintAvailable && message.text && !message.completed && (
                  <HintRow>
                    <Button $variant="ghost" $size="sm" onClick={() => void sendMessage("Show me a hint")} disabled={isStreaming}>
                      <Icon name="sparkles" size={16} />
                      Need a hint?
                    </Button>
                  </HintRow>
                )}
              </div>
            </MessageRow>
          ))}

          {currentAssistant && (
            <MessageRow $role="assistant">
              <Avatar aria-hidden>
                <Icon name="sparkles" size={18} />
              </Avatar>
              <Bubble $role="assistant">
                {streamText || (
                  <TypingDots aria-label="Eazi is typing">
                    <span />
                    <span />
                    <span />
                  </TypingDots>
                )}
              </Bubble>
            </MessageRow>
          )}
          <div ref={bottomRef} />
        </ChatScroll>

        <ChatFooter>
          {error && (
            <ErrorBanner>
              <Icon name="alert-triangle" size={18} />
              {error}
            </ErrorBanner>
          )}
          <InputRow>
            <StyledInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isStreaming) void sendMessage(input);
              }}
              placeholder="Type a message or your answer…"
              disabled={isStreaming}
              aria-label="Message Eazi"
            />
            <Button onClick={() => void sendMessage(input)} disabled={isStreaming || !input.trim()}>
              <Icon name="arrow-right" size={18} />
            </Button>
          </InputRow>
        </ChatFooter>
      </ChatCard>
    </Shell>
  );
}