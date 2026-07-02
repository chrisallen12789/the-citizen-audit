const fs = require("fs");
const path = require("path");
const { unique } = require("../renderers/shared");

function createDataOutputBuilders(publication, publicDir) {
  function buildSearchIndex() {
    const items = [];
    for (const page of publication.pages) {
      items.push({
        type: "Page",
        id: page.id,
        title: page.heading,
        url: page.url,
        text: [
          page.title,
          page.description,
          page.eyebrow,
          page.lede,
          JSON.stringify(page.contentBlocks),
          page.relatedSectionIds.join(" "),
          page.relatedClaimIds.join(" "),
          page.relatedSourceIds.join(" "),
          page.relatedDecisionIds.join(" "),
          page.relatedOpenQuestionIds.join(" ")
        ].join(" ")
      });
    }
    for (const source of publication.sources) {
      items.push({
        type: "Source",
        id: source.id,
        title: source.title,
        url: `/sources/${source.slug}.html`,
        text: [
          source.summary,
          source.sections.join(" "),
          source.claims.join(" "),
          source.openQuestions.join(" "),
          source.publisher,
          source.documentType,
          source.primaryOrSecondary,
          source.canonicalUrl || "",
          source.verificationStatus,
          source.notes || ""
        ].join(" ")
      });
    }
    for (const item of publication.openQuestions) {
      items.push({
        type: "Open question",
        id: item.id,
        title: item.title,
        url: `/open-questions/${item.slug}.html`,
        text: [item.whyItMatters, item.currentState, item.recordNeeded, item.sections.join(" "), item.relatedSources.join(" ")].join(" ")
      });
    }
    for (const decision of publication.decisions) {
      items.push({
        type: "Decision",
        id: decision.id,
        title: decision.title,
        url: `/decision-log/${decision.slug}.html`,
        text: [decision.body, decision.references.join(" ")].join(" ")
      });
    }
    for (const section of publication.sectionRecords) {
      items.push({
        type: "Section",
        id: section.id,
        title: section.title,
        url: section.url,
        text: [
          section.summary,
          section.sources.join(" "),
          section.decisions.join(" "),
          section.openQuestions.join(" "),
          section.relatedSections.join(" ")
        ].join(" ")
      });
    }
    for (const claim of publication.traceClaims) {
      items.push({
        type: "Claim",
        id: claim.id,
        title: claim.title,
        url: `/claims/${claim.id.toLowerCase()}.html`,
        text: [
          claim.summary,
          claim.section,
          claim.sources.join(" "),
          claim.decisions.join(" "),
          claim.openQuestions.join(" ")
        ].join(" ")
      });
    }
    return items;
  }

  function buildClaimDatabase() {
    return {
      generatedAt: new Date().toISOString(),
      audits: publication.audits.map((audit) => ({ id: audit.id, title: audit.title })),
      sections: publication.sections.map((section) => ({
        id: section.id,
        auditId: section.auditId,
        title: section.title,
        url: section.url,
        claimIds: section.claimIds
      })),
      claims: publication.claims
    };
  }

  function buildCrossReferenceTables() {
    return {
      generatedAt: new Date().toISOString(),
      ...publication.crossReferences
    };
  }

  function buildEvidenceGraph() {
    return {
      generatedAt: new Date().toISOString(),
      pages: publication.pages.map((page) => ({
        id: page.id,
        title: page.heading,
        audits: page.relatedAuditIds,
        sections: page.relatedSectionIds,
        claims: page.relatedClaimIds,
        sources: page.relatedSourceIds,
        decisions: page.relatedDecisionIds,
        openQuestions: page.relatedOpenQuestionIds,
        connectedIds: unique([
          ...page.relatedAuditIds,
          ...page.relatedSectionIds,
          ...page.relatedClaimIds,
          ...page.relatedSourceIds,
          ...page.relatedDecisionIds,
          ...page.relatedOpenQuestionIds
        ])
      })),
      audits: publication.audits.map((audit) => ({
        id: audit.id,
        title: audit.title,
        sections: audit.sectionIds,
        claims: audit.claimIds,
        sources: audit.sourceIds,
        decisions: audit.decisionIds,
        openQuestions: audit.openQuestionIds,
        connectedIds: unique([
          ...audit.sectionIds,
          ...audit.claimIds,
          ...audit.sourceIds,
          ...audit.decisionIds,
          ...audit.openQuestionIds
        ])
      })),
      sections: publication.sections.map((section) => ({
        id: section.id,
        title: section.title,
        audits: [section.auditId],
        claims: section.claimIds,
        sources: section.sourceIds,
        decisions: section.decisionIds,
        openQuestions: section.openQuestionIds,
        relatedSections: section.relatedSectionIds,
        connectedIds: unique([
          section.auditId,
          ...section.claimIds,
          ...section.sourceIds,
          ...section.decisionIds,
          ...section.openQuestionIds,
          ...section.relatedSectionIds
        ])
      })),
      claims: publication.claims.map((claim) => ({
        id: claim.id,
        title: claim.title,
        audits: [claim.auditId],
        sections: [claim.sectionId],
        sources: claim.sources,
        decisions: claim.decisions,
        openQuestions: claim.openQuestions,
        relatedClaims: claim.relatedClaims,
        connectedIds: unique([
          claim.auditId,
          claim.sectionId,
          ...claim.sources,
          ...claim.decisions,
          ...claim.openQuestions,
          ...claim.relatedClaims
        ])
      })),
      sources: publication.sources.map((source) => ({
        id: source.id,
        title: source.title,
        audits: source.auditIds || [],
        sections: source.sectionIds || source.sections || [],
        claims: source.claimIds || [],
        decisions: source.decisionIds || [],
        openQuestions: source.openQuestionIds || [],
        connectedIds: unique([
          ...(source.auditIds || []),
          ...(source.sectionIds || source.sections || []),
          ...(source.claimIds || []),
          ...(source.decisionIds || []),
          ...(source.openQuestionIds || [])
        ])
      })),
      decisions: publication.decisions.map((decision) => ({
        id: decision.id,
        title: decision.title,
        audits: decision.auditIds || [],
        sections: decision.sectionIds || decision.references || [],
        claims: decision.claimIds || [],
        sources: decision.sourceIds || [],
        openQuestions: decision.openQuestionIds || [],
        connectedIds: unique([
          ...(decision.auditIds || []),
          ...(decision.sectionIds || decision.references || []),
          ...(decision.claimIds || []),
          ...(decision.sourceIds || []),
          ...(decision.openQuestionIds || [])
        ])
      })),
      openQuestions: publication.openQuestions.map((question) => ({
        id: question.id,
        title: question.title,
        audits: question.auditIds || [],
        sections: question.sectionIds || question.sections || [],
        claims: question.claimIds || [],
        sources: question.sourceIds || question.relatedSources || [],
        decisions: question.decisionIds || [],
        connectedIds: unique([
          ...(question.auditIds || []),
          ...(question.sectionIds || question.sections || []),
          ...(question.claimIds || []),
          ...(question.sourceIds || question.relatedSources || []),
          ...(question.decisionIds || [])
        ])
      }))
    };
  }

  function buildManifest(outputs) {
    const generatedSectionPages = publication.sections.filter((section) => /^Section \d+$/.test(section.id));
    return {
      generatedAt: new Date().toISOString(),
      buildVersion: publication.primaryAudit?.currentReleaseVersion || "0.0",
      auditId: publication.primaryAudit?.id || null,
      outputs,
      counts: {
        generatedPublicationPages: publication.pages.length,
        generatedSectionPages: generatedSectionPages.length,
        generatedClaimPages: publication.claims.length
      },
      invariants: [
        "Version 1.0 analytical conclusions remain locked by edition.",
        "Decision history remains public.",
        "Open questions remain public.",
        "Unknown values are not estimated without published support."
      ]
    };
  }

  function buildPlatformStatus(metrics, manifest) {
    return {
      generatedAt: new Date().toISOString(),
      status: metrics.platformHealth,
      qaStatus: metrics.qaStatus.status,
      buildVersion: metrics.buildVersion,
      traceabilityPercent: metrics.traceabilityPercent,
      citationCoveragePercent: metrics.citationCoverage.percentVerified,
      generatedPublicationPages: metrics.generatedPublicationPages,
      generatedSectionPages: metrics.generatedSectionPages,
      generatedClaimPages: metrics.generatedClaimPages,
      manifestOutputs: manifest.outputs.length
    };
  }

  function buildTraceRecords() {
    return {
      generatedAt: new Date().toISOString(),
      scaleExplorerRows: [
        ["International assistance obligations, FY2023 basis", 99.9, "S-038"],
        ["International assistance disbursements, FY2023 basis", 71.9, "S-038 / S-039"],
        ["Net-new military assistance, Ukraine-surge cumulative obligations", 50.9, "Section 5"],
        ["Recurring security assistance lanes", 1.6, "Section 5"],
        ["Noncitizen SSI, Dec. 2021 basis", 2.21, "S-073"],
        ["Emergency Medicaid, federal + state, FY2023", 3.8, "Section 7 / A-037"]
      ],
      sections: publication.sectionRecords,
      claims: publication.traceClaims,
      sources: publication.sources.map((source) => ({
        id: source.id,
        slug: source.slug,
        title: source.title,
        canonicalUrl: source.canonicalUrl,
        officialUrl: source.officialUrl,
        archiveUrl: source.archiveUrl,
        archiveStatus: source.archiveStatus,
        publisher: source.publisher,
        publicationDate: source.publicationDate,
        retrievalDate: source.retrievalDate,
        documentType: source.documentType,
        primaryOrSecondary: source.primaryOrSecondary,
        classification: source.classification,
        sections: source.sections,
        verificationStatus: source.verificationStatus,
        urlVerificationStatus: source.urlVerificationStatus,
        notes: source.notes
      })),
      decisions: publication.decisions,
      openQuestions: publication.openQuestions
    };
  }

  function countHtmlFiles(dir) {
    let total = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += countHtmlFiles(next);
        continue;
      }
      if (entry.name.endsWith(".html")) {
        total += 1;
      }
    }
    return total;
  }

  function buildPlatformMetrics(searchIndex, traceRecords) {
    const verifiedSources = publication.sources.filter((source) => source.verificationStatus === "verified");
    const pendingSources = publication.sources.filter((source) => source.verificationStatus !== "verified");
    const archiveCoveredSources = publication.sources.filter((source) => source.archiveUrl);
    const highPrioritySources = publication.sources.filter((source) => source.citationPriority === "high");
    const highPriorityMissing = publication.sources
      .filter((source) => source.citationPriority === "high" && !source.canonicalUrl)
      .map((source) => source.id);
    const highPriorityVerified = highPrioritySources.filter((source) => source.canonicalUrl).length;
    const highPriorityCitationCompletionPercent = highPrioritySources.length
      ? Number(((highPriorityVerified / highPrioritySources.length) * 100).toFixed(2))
      : 100;
    const traceableClaims = publication.claims.filter(
      (claim) => claim.sources.length && claim.confidence && claim.revisionHistory.length
    );
    const traceabilityPercent = Number(((traceableClaims.length / publication.claims.length) * 100).toFixed(2));
    const generatedSectionPages = publication.sections.filter((section) => /^Section \d+$/.test(section.id)).length;
    return {
      generatedAt: new Date().toISOString(),
      buildVersion: publication.primaryAudit?.currentReleaseVersion || "0.0",
      audits: publication.audits.length,
      sections: publication.sections.length,
      htmlPages: countHtmlFiles(publicDir),
      generatedPublicationPages: publication.pages.length,
      generatedSectionPages,
      generatedClaimPages: publication.claims.length,
      sources: publication.sources.length,
      verifiedSourceCount: verifiedSources.length,
      pendingSourceCount: pendingSources.length,
      archiveCoverageCount: archiveCoveredSources.length,
      highPriorityCitationCompletionPercent,
      citationCoverage: {
        verified: verifiedSources.length,
        pending: pendingSources.length,
        archiveCoverageCount: archiveCoveredSources.length,
        highPriorityCitationCompletionPercent,
        percentVerified: Number(((verifiedSources.length / publication.sources.length) * 100).toFixed(2)),
        highPriorityMissingCanonicalUrls: highPriorityMissing
      },
      decisionLogs: publication.decisions.length,
      openQuestions: publication.openQuestions.length,
      claims: publication.claims.length,
      traceabilityPercent,
      platformHealth: highPriorityMissing.length ? "degraded" : "healthy",
      traceRecords: {
        sections: traceRecords.sections.length,
        claims: traceRecords.claims.length
      },
      searchRecords: searchIndex.length,
      qaStatus: {
        status: "build-generated",
        checksExpected: [
          "required source metadata",
          "high-priority canonical URLs",
          "orphaned trace records",
          "search coverage for trace claims",
          "explorer reference integrity",
          "generated-file consistency"
        ]
      }
    };
  }

  return {
    buildSearchIndex,
    buildClaimDatabase,
    buildCrossReferenceTables,
    buildEvidenceGraph,
    buildManifest,
    buildPlatformStatus,
    buildTraceRecords,
    buildPlatformMetrics
  };
}

module.exports = {
  createDataOutputBuilders
};
