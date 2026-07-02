function createRelationships(publication) {
  const sectionPathByName = Object.fromEntries(
    publication.sections.map((section) => [section.id, section.url])
  );

  function linkSections(sectionNames) {
    return sectionNames
      .map((sectionName) => {
        const href = sectionPathByName[sectionName] || "/audit.html";
        return `<a class="tag" href="${href}">${sectionName}</a>`;
      })
      .join(" ");
  }

  function renderSectionTagList(sectionNames) {
    return sectionNames.length
      ? linkSections(sectionNames)
      : "<span class='empty-state'>No related sections</span>";
  }

  function relatedDecisionsForSections(sectionNames) {
    return publication.decisions.filter((decision) =>
      (decision.sectionIds || decision.references || []).some((section) => sectionNames.includes(section))
    );
  }

  function relatedSourcesForDecision(decision) {
    return publication.sources.filter((source) =>
      source.decisionIds.includes(decision.id) ||
      source.sectionIds.some((sectionId) => (decision.sectionIds || decision.references || []).includes(sectionId))
    );
  }

  function relatedOpenQuestionsForDecision(decision) {
    return publication.openQuestions.filter((item) => item.decisionIds.includes(decision.id));
  }

  function findSectionRecord(sectionId) {
    return publication.sections.find((section) => section.id === sectionId) || null;
  }

  function relatedClaimsForSource(sourceId) {
    return publication.claims.filter((claim) => claim.sources.includes(sourceId));
  }

  function relatedClaimsForDecision(decisionId) {
    return publication.claims.filter((claim) => claim.decisions.includes(decisionId));
  }

  function relatedClaimsForOpenQuestion(openQuestionId) {
    return publication.claims.filter((claim) => claim.openQuestions.includes(openQuestionId));
  }

  function findClaimRecord(claimId) {
    return publication.claims.find((claim) => claim.id === claimId) || null;
  }

  function relatedSourcesForClaim(claim) {
    return claim.sources.map(findSourceRecord).filter(Boolean);
  }

  function relatedDecisionsForClaim(claim) {
    return claim.decisions.map(findDecisionRecord).filter(Boolean);
  }

  function relatedOpenQuestionsForClaim(claim) {
    return claim.openQuestions.map(findOpenQuestionRecord).filter(Boolean);
  }

  function relatedClaimsForClaim(claim) {
    return claim.relatedClaims.map(findClaimRecord).filter(Boolean);
  }

  function relatedDecisionsForSource(sourceId, sections = []) {
    return publication.decisions.filter(
      (decision) =>
        decision.sourceIds.includes(sourceId) ||
        (decision.sectionIds || decision.references || []).some((section) => sections.includes(section))
    );
  }

  function relatedOpenQuestionsForSource(sourceId) {
    return publication.openQuestions.filter((item) => item.sourceIds.includes(sourceId));
  }

  function findSourceRecord(sourceId) {
    return publication.sources.find((source) => source.id === sourceId) || null;
  }

  function findDecisionRecord(decisionId) {
    return publication.decisions.find((decision) => decision.id === decisionId) || null;
  }

  function findOpenQuestionRecord(openQuestionId) {
    return publication.openQuestions.find((item) => item.id === openQuestionId) || null;
  }

  return {
    linkSections,
    renderSectionTagList,
    relatedDecisionsForSections,
    relatedSourcesForDecision,
    relatedOpenQuestionsForDecision,
    findSectionRecord,
    relatedClaimsForSource,
    relatedClaimsForDecision,
    relatedClaimsForOpenQuestion,
    findClaimRecord,
    relatedSourcesForClaim,
    relatedDecisionsForClaim,
    relatedOpenQuestionsForClaim,
    relatedClaimsForClaim,
    relatedDecisionsForSource,
    relatedOpenQuestionsForSource
  };
}

module.exports = {
  createRelationships
};
