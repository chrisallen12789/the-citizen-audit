const audits = require("./audits");
const sectionsRaw = require("./sections");
const claimsRaw = require("./claims");
const sourcesRaw = require("./sources");
const decisionsRaw = require("./decisions");
const openQuestionsRaw = require("./open-questions");
const releases = require("./releases");
const glossary = require("./glossary");
const sectionContent = require("./section-content");

function unique(values) {
  return [...new Set(values)];
}

function overlaps(left, right) {
  return left.some((value) => right.includes(value));
}

const claims = claimsRaw.map((claim) => ({
  ...claim,
  relatedClaims:
    claim.relatedClaims && claim.relatedClaims.length
      ? claim.relatedClaims
      : unique(
          claimsRaw
            .filter((candidate) => candidate.id !== claim.id)
            .filter(
              (candidate) =>
                candidate.sectionId === claim.sectionId ||
                overlaps(candidate.sources, claim.sources) ||
                overlaps(candidate.decisions, claim.decisions) ||
                overlaps(candidate.openQuestions, claim.openQuestions)
            )
            .map((candidate) => candidate.id)
        )
}));

const sections = sectionsRaw.map((section) => {
  const claimIds = unique(
    section.claimIds && section.claimIds.length
      ? section.claimIds
      : claims.filter((claim) => claim.sectionId === section.id).map((claim) => claim.id)
  );
  return {
    ...section,
    claimIds,
    contentBlocks: sectionContent[section.id] || []
  };
});

const sources = sourcesRaw.map((source) => {
  const claimIds = claims.filter((claim) => claim.sources.includes(source.id)).map((claim) => claim.id);
  const decisionIds = unique(
    claims
      .filter((claim) => claim.sources.includes(source.id))
      .flatMap((claim) => claim.decisions)
  );
  const openQuestionIds = unique(
    [
      ...(source.openQuestionIds || []),
      ...(source.openQuestions || []),
      ...claims.filter((claim) => claim.sources.includes(source.id)).flatMap((claim) => claim.openQuestions)
    ].filter(Boolean)
  );
  return {
    ...source,
    claimIds,
    decisionIds,
    openQuestionIds,
    sectionIds: unique(source.sectionIds || source.sections || [])
  };
});

const decisions = decisionsRaw.map((decision) => {
  const claimIds = claims
    .filter((claim) => claim.decisions.includes(decision.id))
    .map((claim) => claim.id);
  const sourceIds = unique(
    claims
      .filter((claim) => claim.decisions.includes(decision.id))
      .flatMap((claim) => claim.sources)
  );
  const openQuestionIds = unique(
    claims
      .filter((claim) => claim.decisions.includes(decision.id))
      .flatMap((claim) => claim.openQuestions)
  );
  return {
    ...decision,
    sectionIds: unique(decision.sectionIds || decision.references || []),
    claimIds,
    sourceIds,
    openQuestionIds
  };
});

const openQuestions = openQuestionsRaw.map((question) => {
  const claimIds = claims
    .filter((claim) => claim.openQuestions.includes(question.id))
    .map((claim) => claim.id);
  const sourceIds = unique([
    ...(question.sourceIds || []),
    ...(question.relatedSources || []),
    ...claims.filter((claim) => claim.openQuestions.includes(question.id)).flatMap((claim) => claim.sources)
  ]);
  const decisionIds = unique(
    claims
      .filter((claim) => claim.openQuestions.includes(question.id))
      .flatMap((claim) => claim.decisions)
  );
  return {
    ...question,
    sectionIds: unique(question.sectionIds || question.sections || []),
    claimIds,
    sourceIds,
    decisionIds
  };
});

const sectionsById = new Map(sections.map((section) => [section.id, section]));
const sourcesById = new Map(sources.map((source) => [source.id, source]));
const decisionsById = new Map(decisions.map((decision) => [decision.id, decision]));
const openQuestionsById = new Map(openQuestions.map((question) => [question.id, question]));
const claimsById = new Map(claims.map((claim) => [claim.id, claim]));

const auditsEnriched = audits.map((audit) => ({
  ...audit,
  sectionIds: sections.filter((section) => section.auditId === audit.id).map((section) => section.id),
  claimIds: claims.filter((claim) => claim.auditId === audit.id).map((claim) => claim.id),
  sourceIds: sources.filter((source) => (source.auditIds || []).includes(audit.id)).map((source) => source.id),
  decisionIds: decisions.filter((decision) => (decision.auditIds || []).includes(audit.id)).map((decision) => decision.id),
  openQuestionIds: openQuestions
    .filter((question) => (question.auditIds || []).includes(audit.id))
    .map((question) => question.id)
}));

const orderedSections = sections.filter((section) => /^Section \d+$/.test(section.id));
for (let index = 0; index < orderedSections.length; index += 1) {
  const current = orderedSections[index];
  current.order = index + 1;
  current.previousSectionId = orderedSections[index - 1]?.id || null;
  current.nextSectionId = orderedSections[index + 1]?.id || null;
}

const crossReferences = {
  audits: Object.fromEntries(
    auditsEnriched.map((audit) => [
      audit.id,
      {
        sections: audit.sectionIds,
        claims: audit.claimIds,
        sources: audit.sourceIds,
        decisions: audit.decisionIds,
        openQuestions: audit.openQuestionIds
      }
    ])
  ),
  sections: Object.fromEntries(
    sections.map((section) => [
      section.id,
      {
        audits: [section.auditId],
        claims: section.claimIds,
        sources: section.sourceIds,
        decisions: section.decisionIds,
        openQuestions: section.openQuestionIds,
        relatedSections: section.relatedSectionIds
      }
    ])
  ),
  claims: Object.fromEntries(
    claims.map((claim) => [
      claim.id,
      {
        audits: [claim.auditId],
        sections: [claim.sectionId],
        sources: claim.sources,
        decisions: claim.decisions,
        openQuestions: claim.openQuestions,
        relatedClaims: claim.relatedClaims
      }
    ])
  ),
  sources: Object.fromEntries(
    sources.map((source) => [
      source.id,
      {
        audits: source.auditIds || [],
        sections: source.sectionIds,
        claims: source.claimIds,
        decisions: source.decisionIds,
        openQuestions: source.openQuestionIds,
        relatedSources: unique(
          source.claimIds.flatMap((claimId) => (claimsById.get(claimId)?.sources || []).filter((id) => id !== source.id))
        )
      }
    ])
  ),
  decisions: Object.fromEntries(
    decisions.map((decision) => [
      decision.id,
      {
        audits: decision.auditIds || [],
        sections: decision.sectionIds,
        claims: decision.claimIds,
        sources: decision.sourceIds,
        openQuestions: decision.openQuestionIds,
        relatedDecisions: unique(
          decision.claimIds.flatMap((claimId) =>
            (claimsById.get(claimId)?.decisions || []).filter((id) => id !== decision.id)
          )
        )
      }
    ])
  ),
  openQuestions: Object.fromEntries(
    openQuestions.map((question) => [
      question.id,
      {
        audits: question.auditIds || [],
        sections: question.sectionIds,
        claims: question.claimIds,
        sources: question.sourceIds,
        decisions: question.decisionIds,
        relatedOpenQuestions: unique(
          question.claimIds.flatMap((claimId) =>
            (claimsById.get(claimId)?.openQuestions || []).filter((id) => id !== question.id)
          )
        )
      }
    ])
  )
};

function toLegacySectionRecord(section) {
  return {
    id: section.id,
    title: section.title,
    url: section.url,
    summary: section.summary,
    sources: section.sourceIds,
    decisions: section.decisionIds,
    openQuestions: section.openQuestionIds,
    relatedSections: section.relatedSectionIds
  };
}

function toLegacyClaim(claim) {
  return {
    id: claim.id,
    title: claim.title,
    summary: claim.statement,
    section: claim.sectionId,
    sources: claim.sources,
    decisions: claim.decisions,
    openQuestions: claim.openQuestions,
    relatedClaims: claim.relatedClaims,
    sectionRecord: sectionsById.get(claim.sectionId)?.url || null
  };
}

module.exports = {
  audits: auditsEnriched,
  sections,
  claims,
  sources,
  decisions,
  openQuestions,
  releases,
  glossary,
  crossReferences,
  primaryAudit: auditsEnriched[0] || null,
  transparencyScorecard: glossary.transparencyScorecard || [],
  sectionRecords: sections.map(toLegacySectionRecord),
  traceClaims: claims.map(toLegacyClaim),
  maps: {
    sectionsById,
    sourcesById,
    decisionsById,
    openQuestionsById,
    claimsById
  }
};
