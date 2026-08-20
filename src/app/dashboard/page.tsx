import Link from "next/link";
import { redirect } from "next/navigation";
import styled from "styled-components";
import { auth } from "@/features/auth/nextauth";
import { ensureDb } from "@/server/db";
import { ParentChildModel, UserModel, StudentProfileModel } from "@/models";
import { PARENT_ROLE, STUDENT_ROLE } from "@/features/auth/roles";
import AddChildForm from "./AddChildForm";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { BrandMark, Wordmark } from "@/components/ui/BrandMark";
import LogoutButton from "@/components/auth/LogoutButton";

const Shell = styled.main`
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-4xl) var(--space-3xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-3xl);
`;

const PageHeader = styled.header`
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

  &:hover {
    text-decoration: none;
  }
`;

const Title = styled.h1`
  font-size: var(--text-h1);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.01em;
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
`;

const SectionTitle = styled.h2`
  font-size: var(--text-h2);
  font-weight: var(--font-weight-bold);
`;

const ChildCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  padding: var(--space-xl) var(--space-2xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
`;

const ChildIdentity = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  min-width: 0;
`;

const ChildAvatar = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-pill);
  background: var(--color-surface-secondary);
  color: var(--color-ink-secondary);
`;

const ChildDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
`;

const ChildName = styled.strong`
  font-size: var(--text-body-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-ink);
`;

const ChildMeta = styled.span`
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
  color: var(--color-ink-muted);
  font-size: var(--text-small);
`;

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = session.user.role;
  const userId = session.user.id;
  const name = session.user.name ?? "friend";

  await ensureDb();

  if (role === PARENT_ROLE) {
    const links = await ParentChildModel.find({ parentId: userId }).select("childId").lean();
    const childIds = links.map((l) => l.childId);
    const children = childIds.length
      ? await UserModel.find({ _id: { $in: childIds } })
          .select("name email username ageBand createdAt")
          .lean()
      : [];

    return (
      <Shell>
        <PageHeader>
          <Brand href="/">
            <BrandMark size={36} />
            <Wordmark size="body" />
          </Brand>
          <LogoutButton />
        </PageHeader>

        <Title>Hello, {name}</Title>

        <Section>
          <SectionTitle>Your children</SectionTitle>
          {children.length === 0 ? (
            <EmptyState
              icon="user"
              title="No children yet"
              hint="Add your first child below — children get their own login and never sign themselves up."
            />
          ) : (
            children.map((child) => (
              <ChildCard key={child._id.toString()}>
                <ChildIdentity>
                  <ChildAvatar>
                    <Icon name="user" size={20} />
                  </ChildAvatar>
                  <ChildDetails>
                    <ChildName>{child.name}</ChildName>
                    <ChildMeta>
                      {child.username && <span>@{child.username}</span>}
                      {child.email && <span>{child.email}</span>}
                      {child.ageBand && (
                        <Badge>Ages {child.ageBand.replace("-", "–")}</Badge>
                      )}
                    </ChildMeta>
                  </ChildDetails>
                </ChildIdentity>
                <Link href="/login">
                  <Button $size="sm" $variant="secondary">
                    Log in as {child.name.split(" ")[0]}
                  </Button>
                </Link>
              </ChildCard>
            ))
          )}
        </Section>

        <Section>
          <SectionTitle>Add a child</SectionTitle>
          <AddChildForm />
        </Section>
      </Shell>
    );
  }

  if (role === STUDENT_ROLE) {
    const profile = await StudentProfileModel.findOne({ studentId: userId })
      .select("language dailySessionLimit")
      .lean();

    return (
      <Shell>
        <PageHeader>
          <Brand href="/">
            <BrandMark size={36} />
            <Wordmark size="body" />
          </Brand>
          <LogoutButton />
        </PageHeader>

        <Title>Hello, {name}</Title>

        <Section>
          <SectionTitle>Ready to learn?</SectionTitle>
          <EmptyState
            icon="graduation-cap"
            title="Your tutor is ready"
            hint={
              profile
                ? `Eazi will help you practise today. Daily limit: ${profile.dailySessionLimit} sessions.`
                : "Eazi will help you practise today."
            }
          >
            <Link href="/tutor">
              <Button>Start learning</Button>
            </Link>
          </EmptyState>
        </Section>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader>
        <Brand href="/">
          <BrandMark size={36} />
          <Wordmark size="body" />
        </Brand>
        <LogoutButton />
      </PageHeader>

      <Title>Hello, {name}</Title>

      <Section>
        <SectionTitle>Staff area</SectionTitle>
        <EmptyState
          icon="shield-check"
          title="Admin and teacher surfaces arrive in later phases"
        />
      </Section>
    </Shell>
  );
}