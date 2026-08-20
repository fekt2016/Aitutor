import Link from "next/link";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { BrandMark, Wordmark } from "@/components/ui/BrandMark";

const Shell = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  padding: var(--space-lg) var(--space-3xl);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
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

const HeaderNav = styled.nav`
  display: flex;
  gap: var(--space-lg);
  align-items: center;
`;

const NavLink = styled(Link)`
  font-size: var(--text-small);
  font-weight: var(--font-weight-semibold);
  color: var(--color-ink-secondary);

  &:hover {
    color: var(--color-primary);
    text-decoration: none;
  }
`;

const Hero = styled.section`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-5xl) var(--space-3xl);
  gap: var(--space-2xl);
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
`;

const HeroTitle = styled.h1`
  font-family: var(--font-display);
  font-size: var(--text-display);
  font-weight: var(--font-weight-extrabold);
  line-height: var(--line-height-tight);
  letter-spacing: -0.02em;
  max-width: 16em;
`;

const Highlight = styled.span`
  color: var(--color-primary);
`;

const HeroSub = styled.p`
  font-size: var(--text-body-lg);
  color: var(--color-ink-muted);
  max-width: 34em;
  line-height: var(--line-height-relaxed);
`;

const HeroActions = styled.div`
  display: flex;
  gap: var(--space-lg);
  flex-wrap: wrap;
  justify-content: center;
`;

const FeatureGrid = styled.section`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-xl);
  max-width: 1080px;
  width: 100%;
  padding: 0 var(--space-3xl) var(--space-5xl);
  margin: 0 auto;
`;

const FeatureCard = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-2xl);
`;

const FeatureIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--color-primary-subtle);
  color: var(--color-primary);
  margin-bottom: var(--space-lg);
`;

const FeatureTitle = styled.h3`
  font-size: var(--text-h3);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--space-sm);
`;

const FeatureBody = styled.p`
  color: var(--color-ink-muted);
  line-height: var(--line-height-snug);
`;

const features: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "shield-check",
    title: "Safe by design",
    body: "Multi-layer moderation and age-appropriate content, enforced in code — never just a prompt.",
  },
  {
    icon: "book-open",
    title: "NaCCA aligned",
    body: "Teaching grounded in the Ghana primary curriculum, subject by subject, skill by skill.",
  },
  {
    icon: "target",
    title: "Adaptive",
    body: "Mastery is measured and the tutor adapts — explaining, practising, and reviewing what each child needs.",
  },
  {
    icon: "sparkles",
    title: "Warm & encouraging",
    body: "A patient teacher, not a chatbot. Effort is praised, mistakes become lessons, and learning sticks.",
  },
];

export default function Home() {
  return (
    <Shell>
      <Header>
        <Brand href="/">
          <BrandMark size={36} />
          <Wordmark />
        </Brand>
        <HeaderNav>
          <NavLink href="/login">Log in</NavLink>
          <Link href="/register">
            <Button $size="sm">Get started</Button>
          </Link>
        </HeaderNav>
      </Header>

      <Hero>
        <HeroTitle>
          A friendly tutor for every child —{" "}
          <Highlight>safe, personal, and built for learning.</Highlight>
        </HeroTitle>
        <HeroSub>
          EazWorld AI Tutor helps children aged 5–11 learn Mathematics, English and more — guided by
          the Ghana NaCCA curriculum, one skill at a time.
        </HeroSub>
        <HeroActions>
          <Link href="/register">
            <Button $size="lg">Create an account</Button>
          </Link>
          <Link href="/login">
            <Button $size="lg" $variant="secondary">
              Log in
            </Button>
          </Link>
        </HeroActions>
      </Hero>

      <FeatureGrid>
        {features.map((f) => (
          <FeatureCard key={f.title}>
            <FeatureIcon>
              <Icon name={f.icon} size={22} />
            </FeatureIcon>
            <FeatureTitle>{f.title}</FeatureTitle>
            <FeatureBody>{f.body}</FeatureBody>
          </FeatureCard>
        ))}
      </FeatureGrid>
    </Shell>
  );
}