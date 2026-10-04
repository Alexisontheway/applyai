import { describe, expect, it } from 'vitest';
import { analyzeJobDescription, computeMatch, describeScore, quickMatchScore } from './score';
import { extractSkillIds } from './skills';

const RESUME = `SUMMARY
Senior full-stack engineer with eight years shipping web products.

SKILLS
TypeScript, JavaScript, React, Next.js, Node.js, PostgreSQL, GraphQL, Docker, AWS, CI/CD, testing with Playwright, accessibility, Redis, Kubernetes basics

EXPERIENCE
Built and maintained a React + TypeScript design system used by 40 engineers.
Owned GraphQL services on Node.js backed by PostgreSQL, deployed with Docker on AWS.
Introduced Playwright end-to-end tests and cut regressions by half.`;

const STRONG_JD = `About the role
We are hiring a Senior Full-Stack Engineer to work on our customer platform.

Requirements
- Deep experience with TypeScript and React
- Strong Node.js and GraphQL experience
- PostgreSQL schema design
- Familiarity with Docker and CI/CD pipelines

Nice to have
- Kubernetes
- Terraform`;

const WEAK_JD = `Machine Learning Engineer

Requirements
- 5+ years of production PyTorch experience
- Deep learning research background; published work preferred
- PyTorch, TensorFlow, CUDA, distributed training
- Strong Python and SQL

Nice to have
- Reinforcement learning
- Speech recognition`;

describe('analyzeJobDescription', () => {
  it('separates requirement skills from nice-to-haves and weights them accordingly', () => {
    const analysis = analyzeJobDescription(STRONG_JD);
    const byId = new Map(analysis.skills.map((skill) => [skill.id, skill]));

    expect(byId.get('typescript')?.section).toBe('requirements');
    expect(byId.get('kubernetes')?.section).toBe('preferred');

    // A requirement must outweigh a nice-to-have, whatever the surrounding prose.
    expect(byId.get('typescript')!.weight).toBeGreaterThan(byId.get('kubernetes')!.weight);
    expect(analysis.hasExplicitRequirements).toBe(true);
  });

  it('reads skills out of plain prose when there are no headings', () => {
    const analysis = analyzeJobDescription(
      'We need someone who knows Go and Kubernetes to run our platform.',
    );
    const ids = analysis.skills.map((skill) => skill.id);
    expect(ids).toContain('go');
    expect(ids).toContain('kubernetes');
  });
});

describe('computeMatch', () => {
  const strong = computeMatch({ resumeText: RESUME, jdText: STRONG_JD });
  const weak = computeMatch({ resumeText: RESUME, jdText: WEAK_JD });

  it('keeps scores inside 0..100', () => {
    expect(strong.score).toBeGreaterThanOrEqual(0);
    expect(strong.score).toBeLessThanOrEqual(100);
    expect(weak.score).toBeGreaterThanOrEqual(0);
    expect(weak.score).toBeLessThanOrEqual(100);
  });

  it('separates a real match from a wrong-field posting', () => {
    expect(strong.score).toBeGreaterThan(60);
    expect(weak.score).toBeLessThan(35);
    expect(strong.score - weak.score).toBeGreaterThan(30);
  });

  it('explains the score with matched and missing skills', () => {
    const matchedIds = strong.matchedSkills.map((skill) => skill.id);
    expect(matchedIds).toEqual(expect.arrayContaining(['typescript', 'react', 'nodejs']));
    expect(matchedIds).not.toContain('pytorch');

    const missingIds = weak.missingSkills.map((skill) => skill.id);
    expect(missingIds).toEqual(expect.arrayContaining(['pytorch', 'tensorflow']));
    expect(missingIds).not.toContain('react');
  });

  it('reports a breakdown whose weights match the signals used', () => {
    const { breakdown } = strong;
    expect(breakdown.engine).toBe('taxonomy+tfidf');
    // Without an ML service the semantic weight is redistributed, never dropped.
    expect(breakdown.semanticSimilarity).toBeNull();
    expect(breakdown.weights.semanticSimilarity).toBe(0);
    expect(breakdown.weights.skillCoverage + breakdown.weights.keywordRelevance).toBeCloseTo(1, 5);
    expect(breakdown.skillCoverage).toBeGreaterThan(0.6);
  });

  it('uses the semantic signal when the ML service supplies one', () => {
    const withSemantic = computeMatch({
      resumeText: RESUME,
      jdText: STRONG_JD,
      semanticSimilarity: 0.9,
    });
    const without = computeMatch({ resumeText: RESUME, jdText: STRONG_JD });
    expect(withSemantic.breakdown.semanticSimilarity).toBeCloseTo(0.9, 5);
    expect(withSemantic.breakdown.weights.semanticSimilarity).toBeCloseTo(0.15, 5);
    expect(withSemantic.score).toBeGreaterThan(without.score);
  });

  it('still scores when the posting has no recognizable skills', () => {
    const result = computeMatch({
      resumeText: RESUME,
      jdText:
        'We are a fast growing company looking for a generalist to join our team and help customers succeed.',
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.skillCoverage).toBe(0);
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same inputs', () => {
    expect(computeMatch({ resumeText: RESUME, jdText: STRONG_JD }).score).toBe(strong.score);
  });
});

describe('skill extraction boundaries', () => {
  it('does not invent skills from substrings', () => {
    // `Java` must not be read as `JavaScript`, `R` must not be read as `React`,
    // `Go` must not be read as `Google` — the classic regex-boundary bug.
    const ids = extractSkillIds('I write Java and R, and I once visited Google.');
    expect(ids).toContain('java');
    expect(ids).not.toContain('javascript');
    expect(ids).not.toContain('react');
    expect(ids).not.toContain('go');
  });

  it('reads skills across punctuation and casing', () => {
    const ids = extractSkillIds('Stack: React.js, NodeJS, postgres, CI/CD, and AWS (ECS).');
    expect(ids).toEqual(expect.arrayContaining(['react', 'nodejs', 'postgres', 'ci_cd', 'aws']));
  });

  it('matches multi-word skills only when the words appear together', () => {
    expect(extractSkillIds('We do machine learning here.')).toContain('machine_learning');
    expect(extractSkillIds('We do machine woodworking and learning languages.')).not.toContain(
      'machine_learning',
    );
  });
});

describe('helpers', () => {
  it('describeScore returns human language for score bands', () => {
    expect(describeScore(85)).toMatch(/strong/i);
    expect(describeScore(50)).toMatch(/partial|moderate|some/i);
    expect(describeScore(10)).toMatch(/weak|low|gap/i);
  });

  it('quickMatchScore is a fast preview that tracks the full engine', () => {
    const quick = quickMatchScore(RESUME, STRONG_JD);
    expect(quick).not.toBeNull();
    expect(
      Math.abs(quick! - computeMatch({ resumeText: RESUME, jdText: STRONG_JD }).score),
    ).toBeLessThan(25);
    expect(quickMatchScore('', STRONG_JD)).toBeNull();
  });
});
