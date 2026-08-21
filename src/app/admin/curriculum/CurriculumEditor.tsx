"use client";

/**
 * Curriculum editor UI (plan §27, Phase 2) — tree browser + per-node editors
 * + the grounded lesson view (what the tutor composes and what retrieval
 * finds for a skill). Plain fetch + local state, matching the repo's other
 * forms; styling via design tokens only.
 *
 * Create flows use create-then-edit: "+ Strand" etc. POSTs a minimal record
 * and selects it, so no separate create forms are needed.
 */
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectField } from "@/components/ui/Select";
import { BrandMark, Wordmark } from "@/components/ui/BrandMark";
import { Icon } from "@/components/ui/Icon";

/* ------------------------------- API types ------------------------------ */

interface TreeSkill {
  id: string;
  code: string;
  name: string;
  active: boolean;
}
interface TreeStandard {
  id: string;
  code: string;
  objective: string;
  gradeLevelId: string;
  skills: TreeSkill[];
}
interface TreeSubStrand {
  id: string;
  name: string;
  standards: TreeStandard[];
}
interface TreeStrand {
  id: string;
  name: string;
  subStrands: TreeSubStrand[];
}
interface TreeSubject {
  id: string;
  name: string;
  strands: TreeStrand[];
}
interface CurriculumTree {
  subjects: TreeSubject[];
  gradeLevels: Array<{ id: string; name: string }>;
}

interface GroundedView {
  bundle: {
    subjectName: string;
    skillId: string;
    skillCode: string;
    skillName: string;
    objective: string;
    lessonTitle: string;
    lessonBody: string;
    examples: string[];
    items: Array<{ _id: string; prompt: string; type: string; difficulty: number }>;
    masteryLines: string[];
  };
  lessons: Array<{ id: string; title: string; markdownBody: string; examples: string[]; active: boolean }>;
  items: Array<{
    id: string;
    type: string;
    prompt: string;
    options: string[];
    answer: string;
    explanation: string;
    difficulty: number;
    active: boolean;
  }>;
  chunks: Array<{ id: string; sourceType: string; title: string; content: string; embedded: boolean }>;
}

type Selection =
  | { kind: "strand"; id: string; subjectId: string; name: string }
  | { kind: "substrand"; id: string; strandId: string; name: string }
  | { kind: "standard"; id: string; substrandId: string; code: string; objective: string; gradeLevelId: string }
  | { kind: "skill"; id: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.error?.message ?? "Request failed.");
  }
  return body.data as T;
}

/* --------------------------------- styles -------------------------------- */

const Shell = styled.main`
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-3xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
`;

const Title = styled.h1`
  font-size: var(--text-h1);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.01em;
`;

const Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(280px, 340px) 1fr;
  gap: var(--space-xl);
  align-items: start;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const Tree = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  font-size: var(--text-sm);
`;

const TreeRow = styled.button<{ $depth: number; $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  text-align: left;
  padding: var(--space-xs) var(--space-sm);
  padding-left: calc(var(--space-sm) + ${(p) => p.$depth} * var(--space-lg));
  border: none;
  border-radius: var(--radius-sm);
  background: ${(p) => (p.$active ? "var(--color-surface-secondary)" : "transparent")};
  color: var(--color-ink);
  cursor: pointer;
  font-size: inherit;

  &:hover {
    background: var(--color-surface-secondary);
  }

  &[aria-disabled="true"] {
    color: var(--color-ink-faint);
  }
`;

const EditorStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-md);
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 140px;
  padding: var(--space-md) var(--space-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-size: var(--text-body);
  font-family: inherit;
  color: var(--color-ink);
  resize: vertical;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: var(--shadow-focus-ring);
  }
`;

const Label = styled.label`
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-ink-muted);
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
`;

const Feedback = styled.p<{ $error?: boolean }>`
  font-size: var(--text-sm);
  color: ${(p) => (p.$error ? "var(--color-danger)" : "var(--color-success)")};
`;

const PreWrap = styled.pre`
  white-space: pre-wrap;
  font-family: var(--font-family-base);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: var(--color-surface-secondary);
  border-radius: var(--radius-sm);
  padding: var(--space-md);
  max-height: 320px;
  overflow: auto;
`;

const ChunkList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
`;

/* ------------------------------ root component --------------------------- */

export default function CurriculumEditor() {
  const [tree, setTree] = useState<CurriculumTree | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [view, setView] = useState<GroundedView | null>(null);
  const [tab, setTab] = useState<"skill" | "lesson" | "items" | "grounded">("skill");
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);

  const refreshTree = useCallback(async () => {
    try {
      setTree(await api<CurriculumTree>("/api/v1/admin/curriculum/tree"));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load the curriculum.");
    }
  }, []);

  // Initial tree load — setState only fires after the request settles.
  useEffect(() => {
    let cancelled = false;
    api<CurriculumTree>("/api/v1/admin/curriculum/tree")
      .then((data) => {
        if (!cancelled) setTree(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Could not load the curriculum.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the grounded view whenever a skill is selected. Stale views are
  // guarded at render time by comparing bundle.skillId to the selection.
  useEffect(() => {
    if (selected?.kind !== "skill") return;
    const skillId = selected.id;
    let cancelled = false;
    api<GroundedView>(`/api/v1/admin/curriculum/skill/${skillId}/grounded`)
      .then((data) => {
        if (!cancelled) setView(data);
      })
      .catch((e) => {
        if (!cancelled) setFeedback({ text: e.message, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const selectSkill = (id: string) => {
    setSelected({ kind: "skill", id });
    setView(null); // event-handler state change — no stale view while loading
    setTab("skill");
    setFeedback(null);
  };

  async function run(action: () => Promise<unknown>, okMessage: string) {
    try {
      await action();
      await refreshTree();
      setFeedback({ text: okMessage });
    } catch (e) {
      setFeedback({ text: e instanceof Error ? e.message : "Something went wrong.", error: true });
    }
  }

  /* Create-then-edit helpers — one per taxonomy level. */
  const addStrand = (subjectId: string) =>
    run(async () => {
      const data = await api<{ strand: { id: string } }>("/api/v1/admin/curriculum/strand", {
        method: "POST",
        body: JSON.stringify({ subjectId, name: "New strand" }),
      });
      setSelected({ kind: "strand", id: data.strand.id, subjectId, name: "New strand" });
    }, "Strand added — rename it below.");

  const addSubStrand = (strandId: string) =>
    run(async () => {
      const data = await api<{ substrand: { id: string } }>("/api/v1/admin/curriculum/substrand", {
        method: "POST",
        body: JSON.stringify({ strandId, name: "New sub-strand" }),
      });
      setSelected({ kind: "substrand", id: data.substrand.id, strandId, name: "New sub-strand" });
    }, "Sub-strand added — rename it below.");

  const addStandard = (substrandId: string, gradeLevelId: string) =>
    run(async () => {
      const data = await api<{ standard: { id: string } }>("/api/v1/admin/curriculum/standard", {
        method: "POST",
        body: JSON.stringify({
          substrandId,
          gradeLevelId,
          code: `NEW.${Date.now().toString(36).toUpperCase()}`,
          objective: "Describe the teaching objective.",
        }),
      });
      setSelected({
        kind: "standard",
        id: data.standard.id,
        substrandId,
        code: "",
        objective: "",
        gradeLevelId,
      });
    }, "Content standard added — edit it below.");

  const addSkill = (standard: TreeStandard) =>
    run(async () => {
      const data = await api<{ skill: { id: string } }>("/api/v1/admin/curriculum/skill", {
        method: "POST",
        body: JSON.stringify({
          contentStandardId: standard.id,
          code: `new-skill-${Date.now().toString(36)}`,
          name: "New skill",
        }),
      });
      selectSkill(data.skill.id);
    }, "Skill added — edit it below.");

  const addLessonOrItem = (skillId: string, type: "lesson" | "item") =>
    run(async () => {
      const payload =
        type === "lesson"
          ? { skillId, title: "New lesson", markdownBody: "Write the lesson body here." }
          : {
              skillId,
              type: "mcq",
              prompt: "New question?",
              options: ["Option A", "Option B", "Option C"],
              answer: "Option A",
              difficulty: 2,
            };
      await api(`/api/v1/admin/curriculum/${type}`, { method: "POST", body: JSON.stringify(payload) });
      // Re-pull the grounded view so the new row shows up in the editor.
      setView(await api<GroundedView>(`/api/v1/admin/curriculum/skill/${skillId}/grounded`));
    }, type === "lesson" ? "Lesson added." : "Practice item added.");

  return (
    <Shell>
      <Header>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <BrandMark size={36} />
          <div>
            <Title>Curriculum editor</Title>
            <Wordmark />
          </div>
        </div>
        <Badge $variant="info">NaCCA taxonomy</Badge>
      </Header>

      {loadError && <Feedback $error>{loadError}</Feedback>}
      {feedback && <Feedback $error={feedback.error}>{feedback.text}</Feedback>}

      {!tree && !loadError && <EmptyState title="Loading curriculum…" />}

      {tree && (
        <Columns>
          <Card style={{ padding: "var(--space-md)" }}>
            <Tree>
              {tree.subjects.map((subject) => (
                <TreeGroup key={subject.id} label={subject.name} depth={0}
                  action={{ label: "+ Strand", onClick: () => void addStrand(subject.id) }}>
                  {subject.strands.map((strand) => (
                    <TreeGroup key={strand.id} label={strand.name} depth={1}
                      action={{ label: "+ Sub-strand", onClick: () => void addSubStrand(strand.id) }}
                      onEdit={() =>
                        setSelected({ kind: "strand", id: strand.id, subjectId: subject.id, name: strand.name })
                      }>
                      {strand.subStrands.map((subStrand) => (
                        <TreeGroup key={subStrand.id} label={subStrand.name} depth={2}
                          action={{
                            label: "+ Standard",
                            onClick: () => void addStandard(subStrand.id, tree.gradeLevels[0]?.id ?? ""),
                          }}
                          onEdit={() =>
                            setSelected({
                              kind: "substrand",
                              id: subStrand.id,
                              strandId: strand.id,
                              name: subStrand.name,
                            })
                          }>
                          {subStrand.standards.map((standard) => (
                            <TreeGroup key={standard.id} label={`${standard.code} · ${standard.objective.slice(0, 34)}…`} depth={3}
                              action={{ label: "+ Skill", onClick: () => void addSkill(standard) }}
                              onEdit={() =>
                                setSelected({
                                  kind: "standard",
                                  id: standard.id,
                                  substrandId: subStrand.id,
                                  code: standard.code,
                                  objective: standard.objective,
                                  gradeLevelId: standard.gradeLevelId,
                                })
                              }>
                              {standard.skills.map((skill) => (
                                <TreeRow key={skill.id} $depth={4} $active={selected?.id === skill.id}
                                  aria-disabled={!skill.active}
                                  onClick={() => selectSkill(skill.id)}>
                                  <Icon name="book-open" size={14} />
                                  {skill.name}
                                </TreeRow>
                              ))}
                            </TreeGroup>
                          ))}
                        </TreeGroup>
                      ))}
                    </TreeGroup>
                  ))}
                </TreeGroup>
              ))}
            </Tree>
          </Card>

          <Card style={{ padding: "var(--space-lg)" }}>
            <EditorStack>
              {!selected && (
                <EmptyState
                  icon="book-open"
                  title="Pick something to edit"
                  hint="Select a strand, standard or skill in the tree — or add new levels with the + buttons."
                />
              )}

              {selected?.kind === "strand" && (
                <TaxonomyEditor
                  key={selected.id}
                  type="strand"
                  fields={{ subjectId: selected.subjectId, name: selected.name }}
                  label="name"
                  onDelete={() => void run(() => deleteNode("strand", selected.id), "Strand deleted.")}
                  onSave={(fields) =>
                    run(() => patchNode("strand", selected.id, fields), "Strand saved.")
                  }
                />
              )}
              {selected?.kind === "substrand" && (
                <TaxonomyEditor
                  key={selected.id}
                  type="substrand"
                  fields={{ strandId: selected.strandId, name: selected.name }}
                  label="name"
                  onDelete={() => void run(() => deleteNode("substrand", selected.id), "Sub-strand deleted.")}
                  onSave={(fields) =>
                    run(() => patchNode("substrand", selected.id, fields), "Sub-strand saved.")
                  }
                />
              )}
              {selected?.kind === "standard" && (
                <StandardEditor
                  key={selected.id}
                  standard={{
                    id: selected.id,
                    substrandId: selected.substrandId,
                    code: selected.code,
                    objective: selected.objective,
                    gradeLevelId: selected.gradeLevelId,
                  }}
                  gradeLevels={tree.gradeLevels}
                  onDelete={() => void run(() => deleteNode("standard", selected.id), "Standard deleted.")}
                  onSave={(fields) =>
                    run(() => patchNode("standard", selected.id, fields), "Standard saved.")
                  }
                />
              )}

              {selected?.kind === "skill" && (
                <>
                  <Row>
                    {(["skill", "lesson", "items", "grounded"] as const).map((t) => (
                      <Button key={t} $variant={tab === t ? "primary" : "ghost"} $size="sm"
                        onClick={() => setTab(t)} type="button">
                        {t === "items" ? "Practice items" : t === "grounded" ? "Grounded view" : t[0].toUpperCase() + t.slice(1)}
                      </Button>
                    ))}
                  </Row>

                  {tab === "skill" && view?.bundle.skillId === selected?.id && (
                    <SkillEditor key={view.bundle.skillId} view={view}
                      onSave={(fields) => run(() => patchNode("skill", view.bundle.skillId, fields), "Skill saved.")}
                      onDelete={() => void run(() => deleteNode("skill", view.bundle.skillId), "Skill archived.")}
                      onAddLesson={() => void addLessonOrItem(view.bundle.skillId, "lesson")}
                      onAddItem={() => void addLessonOrItem(view.bundle.skillId, "item")}
                      onOpenLesson={() => setTab("lesson")}
                      onOpenItems={() => setTab("items")}
                    />
                  )}

                  {tab === "lesson" && view?.bundle.skillId === selected?.id && (
                    <LessonEditor view={view}
                      onSave={(lessonId, fields) =>
                        run(() => patchNode("lesson", lessonId, fields), "Lesson saved.")
                      } />
                  )}

                  {tab === "items" && view?.bundle.skillId === selected?.id && (
                    <ItemsEditor view={view}
                      onSave={(itemId, fields) =>
                        run(() => patchNode("item", itemId, fields), "Item saved.")
                      } />
                  )}

                  {tab === "grounded" && view?.bundle.skillId === selected?.id && <GroundedPanel view={view} />}
                </>
              )}
            </EditorStack>
          </Card>
        </Columns>
      )}
    </Shell>
  );
}

/* ------------------------------- API calls ------------------------------- */

function patchNode(type: string, id: string, fields: Record<string, unknown>) {
  return api(`/api/v1/admin/curriculum/${type}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

function deleteNode(type: string, id: string) {
  return api(`/api/v1/admin/curriculum/${type}/${id}`, { method: "DELETE" });
}

/* ------------------------------ tree pieces ------------------------------ */

interface TreeGroupProps {
  label: string;
  depth: number;
  action?: { label: string; onClick: () => void };
  onEdit?: () => void;
  children?: React.ReactNode;
}

function TreeGroup({ label, depth, action, onEdit, children }: TreeGroupProps) {
  return (
    <div>
      <TreeRow $depth={depth} onClick={onEdit} aria-disabled={!onEdit}>
        <span style={{ flex: 1 }}>{label}</span>
        {action && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
            style={{
              border: "none",
              background: "none",
              color: "var(--color-primary)",
              cursor: "pointer",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--font-weight-semibold)",
            }}
          >
            {action.label}
          </button>
        )}
      </TreeRow>
      {children}
    </div>
  );
}

/* ------------------------------ node editors ----------------------------- */

interface TaxonomyEditorProps {
  type: "strand" | "substrand";
  fields: Record<string, string>;
  label: string;
  onSave: (fields: Record<string, unknown>) => void;
  onDelete: () => void;
}

function TaxonomyEditor({ type, fields, label, onSave, onDelete }: TaxonomyEditorProps) {
  const [name, setName] = useState(fields.name ?? "");
  return (
    <EditorStack>
      <h2 style={{ fontSize: "var(--text-h2)", margin: 0, textTransform: "capitalize" }}>{type}</h2>
      <FieldGrid>
        <Label>
          {label}
          <input value={name} onChange={(e) => setName(e.target.value)}
            style={inputStyle} />
        </Label>
      </FieldGrid>
      <Row>
        <Button onClick={() => onSave({ ...fields, name })}>Save</Button>
        <Button $variant="danger" onClick={onDelete}>Delete</Button>
      </Row>
    </EditorStack>
  );
}

const inputStyle = {
  minHeight: "48px",
  padding: "0 var(--space-lg)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--text-body)",
  fontFamily: "inherit",
} as const;

interface StandardEditorProps {
  standard: { id: string; substrandId: string; code: string; objective: string; gradeLevelId: string };
  gradeLevels: Array<{ id: string; name: string }>;
  onSave: (fields: Record<string, unknown>) => void;
  onDelete: () => void;
}

function StandardEditor({ standard, gradeLevels, onSave, onDelete }: StandardEditorProps) {
  const [code, setCode] = useState(standard.code);
  const [objective, setObjective] = useState(standard.objective);
  const [gradeLevelId, setGradeLevelId] = useState(standard.gradeLevelId);
  return (
    <EditorStack>
      <h2 style={{ fontSize: "var(--text-h2)", margin: 0 }}>Content standard</h2>
      <FieldGrid>
        <Label>
          Code
          <input value={code} onChange={(e) => setCode(e.target.value)} style={inputStyle} />
        </Label>
        <SelectField id="grade-level" label="Grade level" value={gradeLevelId} onChange={(e) => setGradeLevelId(e.target.value)}>
          {gradeLevels.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </SelectField>
      </FieldGrid>
      <Label>
        Objective
        <TextArea value={objective} onChange={(e) => setObjective(e.target.value)} rows={3} style={{ minHeight: 90 }} />
      </Label>
      <Row>
        <Button onClick={() => onSave({ code, objective, gradeLevelId })}>Save</Button>
        <Button $variant="danger" onClick={onDelete}>Delete</Button>
      </Row>
    </EditorStack>
  );
}

/* ------------------------------ skill editors ---------------------------- */

interface SkillEditorProps {
  view: GroundedView;
  onSave: (fields: Record<string, unknown>) => void;
  onDelete: () => void;
  onAddLesson: () => void;
  onAddItem: () => void;
  onOpenLesson: () => void;
  onOpenItems: () => void;
}

function SkillEditor({ view, onSave, onDelete, onAddLesson, onAddItem, onOpenLesson, onOpenItems }: SkillEditorProps) {
  // Keyed by skill id at the usage site, so state resets per selection
  // without a setState-in-effect.
  const [form, setForm] = useState({
    name: view.bundle.skillName,
    description: "",
    defaultDifficulty: 3,
    active: true,
  });

  return (
    <EditorStack>
      <FieldGrid>
        <Label>
          Skill name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
        </Label>
        <Label>
          Default difficulty (1–5)
          <input type="number" min={1} max={5} value={form.defaultDifficulty}
            onChange={(e) => setForm({ ...form, defaultDifficulty: Number(e.target.value) })}
            style={inputStyle} />
        </Label>
      </FieldGrid>
      <Label>
        Description
        <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2} placeholder="What this skill teaches." style={{ minHeight: 70 }} />
      </Label>
      <label style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center", fontSize: "var(--text-sm)" }}>
        <input type="checkbox" checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        Active (visible to students)
      </label>
      <Row>
        <Button onClick={() => onSave(form)}>Save skill</Button>
        <Button $variant="secondary" onClick={onAddLesson}>+ Lesson</Button>
        <Button $variant="secondary" onClick={onAddItem}>+ Practice item</Button>
        <Button $variant="danger" onClick={onDelete}>Archive</Button>
      </Row>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", margin: 0 }}>
        {view.lessons.length} lesson(s) · {view.items.length} practice item(s) ·{" "}
        <button type="button" onClick={onOpenLesson} style={linkStyle}>edit lesson</button> ·{" "}
        <button type="button" onClick={onOpenItems} style={linkStyle}>edit items</button>
      </p>
    </EditorStack>
  );
}

const linkStyle = {
  border: "none",
  background: "none",
  color: "var(--color-primary)",
  cursor: "pointer",
  fontSize: "inherit",
  padding: 0,
} as const;

function LessonEditor({ view, onSave }: { view: GroundedView; onSave: (id: string, fields: Record<string, unknown>) => void }) {
  if (view.lessons.length === 0) {
    return <EmptyState title="No lesson yet" hint="Add one from the Skill tab." />;
  }
  return (
    <EditorStack>
      {view.lessons.map((lesson) => (
        <LessonCard key={lesson.id} lesson={lesson} onSave={onSave} />
      ))}
    </EditorStack>
  );
}

function LessonCard({ lesson, onSave }: { lesson: GroundedView["lessons"][number]; onSave: (id: string, f: Record<string, unknown>) => void }) {
  const [title, setTitle] = useState(lesson.title);
  const [body, setBody] = useState(lesson.markdownBody);
  const [examples, setExamples] = useState(lesson.examples.join("\n"));
  return (
    <EditorStack>
      <Label>
        Lesson title
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
      </Label>
      <Label>
        Lesson body (markdown — this is what grounds the tutor)
        <TextArea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
      </Label>
      <Label>
        Worked examples (one per line)
        <TextArea value={examples} onChange={(e) => setExamples(e.target.value)} rows={4} style={{ minHeight: 80 }} />
      </Label>
      <Button onClick={() =>
        onSave(lesson.id, {
          title,
          markdownBody: body,
          examples: examples.split("\n").map((s) => s.trim()).filter(Boolean),
        })
      }>
        Save lesson
      </Button>
    </EditorStack>
  );
}

function ItemsEditor({ view, onSave }: { view: GroundedView; onSave: (id: string, fields: Record<string, unknown>) => void }) {
  if (view.items.length === 0) {
    return <EmptyState title="No practice items yet" hint="Add one from the Skill tab." />;
  }
  return (
    <EditorStack>
      {view.items.map((item) => (
        <ItemCard key={item.id} item={item} onSave={onSave} />
      ))}
    </EditorStack>
  );
}

function ItemCard({ item, onSave }: { item: GroundedView["items"][number]; onSave: (id: string, f: Record<string, unknown>) => void }) {
  const [form, setForm] = useState({
    prompt: item.prompt,
    options: item.options.join(", "),
    answer: item.answer,
    explanation: item.explanation,
    difficulty: item.difficulty,
    type: item.type,
  });
  return (
    <EditorStack>
      <Row>
        <Badge $variant="neutral">{form.type}</Badge>
        <Badge $variant={item.active ? "success" : "warning"}>{item.active ? "active" : "inactive"}</Badge>
      </Row>
      <Label>
        Prompt
        <TextArea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} rows={2} style={{ minHeight: 70 }} />
      </Label>
      <FieldGrid>
        <Label>
          Options (comma-separated, MCQ only)
          <input value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} style={inputStyle} />
        </Label>
        <Label>
          Answer
          <input value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} style={inputStyle} />
        </Label>
        <Label>
          Difficulty (1–5)
          <input type="number" min={1} max={5} value={form.difficulty}
            onChange={(e) => setForm({ ...form, difficulty: Number(e.target.value) })} style={inputStyle} />
        </Label>
      </FieldGrid>
      <Label>
        Explanation (child-friendly)
        <TextArea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} rows={2} style={{ minHeight: 70 }} />
      </Label>
      <Button onClick={() =>
        onSave(item.id, {
          ...form,
          options: form.options.split(",").map((s) => s.trim()).filter(Boolean),
        })
      }>
        Save item
      </Button>
    </EditorStack>
  );
}

/* ---------------------------- grounded view tab -------------------------- */

function GroundedPanel({ view }: { view: GroundedView }) {
  return (
    <EditorStack>
      <h2 style={{ fontSize: "var(--text-h2)", margin: 0 }}>What the tutor sees</h2>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)", margin: 0 }}>
        Subject: {view.bundle.subjectName} · Objective: {view.bundle.objective || "—"} ·{" "}
        Mastery lines: {view.bundle.masteryLines.length}
      </p>
      <PreWrap>{view.bundle.lessonBody || "(no lesson body)"}</PreWrap>

      <h3 style={{ fontSize: "var(--text-h3)", margin: 0 }}>
        Retrieval chunks ({view.chunks.length})
      </h3>
      {view.chunks.length === 0 ? (
        <EmptyState title="No chunks indexed" hint="Writes to this skill re-index its chunks automatically." />
      ) : (
        <ChunkList>
          {view.chunks.map((chunk) => (
            <li key={chunk.id}>
<Card style={{ padding: "var(--space-md)" }}>
                <Row>
                  <strong style={{ fontSize: "var(--text-sm)" }}>{chunk.title || "(untitled)"}</strong>
                  <span style={{ display: "flex", gap: "var(--space-xs)" }}>
                    <Badge $variant="info">{chunk.sourceType}</Badge>
                    <Badge $variant={chunk.embedded ? "success" : "warning"}>
                      {chunk.embedded ? "embedded" : "no embedding"}
                    </Badge>
                  </span>
                </Row>
                <PreWrap>{chunk.content}</PreWrap>
              </Card>
            </li>
          ))}
        </ChunkList>
      )}
    </EditorStack>
  );
}
