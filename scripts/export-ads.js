const fs = require('fs');
const path = require('path');

const publication = require('../data-model');

const ROOT = path.resolve(__dirname, '..');
const ADS_VERSION = '1.0.0';
const TODAY = new Date().toISOString().slice(0, 10);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(relativePath, value) {
  const targetPath = path.join(ROOT, relativePath);
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`wrote ${relativePath}`);
}

function numberFromId(id) {
  const match = String(id || '').match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function pad(number, width) {
  return String(number).padStart(width, '0');
}

function adsAuditId(legacyId) {
  return `AUD-${pad(numberFromId(legacyId), 3)}`;
}

function adsClaimId(legacyId) {
  return `CLM-${pad(numberFromId(legacyId), 6)}`;
}

function adsSourceId(legacyId) {
  return `SRC-${pad(numberFromId(legacyId), 6)}`;
}

function adsDecisionId(legacyId) {
  return `DEC-${pad(numberFromId(legacyId), 6)}`;
}

function adsUnknownId(legacyId) {
  return `UNK-${pad(numberFromId(legacyId), 6)}`;
}

function auditDirectory(adsId) {
  return adsId.replace('AUD-', '').toLowerCase();
}

function normalizeAuditStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('publish')) return 'published';
  if (value.includes('review')) return 'review';
  if (value.includes('withdraw')) return 'withdrawn';
  if (value.includes('supersed')) return 'superseded';
  if (value.includes('draft')) return 'draft';
  return 'active';
}

function normalizeClaimStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('contest')) return 'contested';
  if (value.includes('withdraw')) return 'withdrawn';
  if (value.includes('unknown')) return 'unknown';
  if (value.includes('revis')) return 'revised';
  if (value.includes('propos')) return 'proposed';
  return 'supported';
}

function normalizeConfidence(confidence) {
  const value = String(confidence || '').toLowerCase();
  if (value.includes('high')) return 'high';
  if (value.includes('medium')) return 'medium';
  if (value.includes('low')) return 'low';
  return 'not-rated';
}

function normalizeSourceType(source) {
  const value = `${source.type || ''} ${source.documentType || ''} ${source.publisher || ''}`.toLowerCase();
  if (value.includes('statute') || value.includes('u.s. code')) return 'statute';
  if (value.includes('court')) return 'court';
  if (value.includes('dataset') || value.includes('data')) return 'dataset';
  if (value.includes('academic')) return 'academic';
  if (value.includes('press')) return 'press';
  if (value.includes('government') || value.includes('congress') || value.includes('agency') || source.agency) return 'government';
  if (value.includes('primary')) return 'primary-document';
  return 'other';
}

function normalizeSourceHealth(source) {
  const archiveStatus = String(source.archiveStatus || '').toLowerCase();
  const verification = String(source.verificationStatus || source.urlVerificationStatus || '').toLowerCase();

  if (verification.includes('missing')) return 'missing';
  if (verification.includes('degraded')) return 'degraded';
  if (archiveStatus.includes('available') && verification.includes('verified')) return 'verified';
  if (archiveStatus.includes('available')) return 'archived-only';
  if (source.officialUrl || source.canonicalUrl) return 'current-only';
  return 'degraded';
}

function normalizeDecisionStatus(decision) {
  const body = String(decision.body || '').toLowerCase();
  if (body.includes('withdrawn')) return 'withdrawn';
  if (body.includes('superseded')) return 'superseded';
  return 'locked';
}

function normalizeUnknownStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('resolved') && value.includes('partial')) return 'partially-resolved';
  if (value.includes('resolved')) return 'resolved';
  if (value.includes('block')) return 'blocked';
  if (value.includes('withdraw')) return 'withdrawn';
  return 'open';
}

function firstRevisionDate(record) {
  return record.revisionHistory?.[0]?.date || TODAY;
}

function exportAudit(audit) {
  const adsId = adsAuditId(audit.id);
  const dir = auditDirectory(adsId);
  const auditClaims = publication.claims.filter((claim) => claim.auditId === audit.id);
  const auditSources = publication.sources.filter((source) => (source.auditIds || []).includes(audit.id));
  const auditDecisions = publication.decisions.filter((decision) => (decision.auditIds || []).includes(audit.id));
  const auditUnknowns = publication.openQuestions.filter((question) => (question.auditIds || []).includes(audit.id));

  const auditRecord = {
    id: adsId,
    legacyId: audit.id,
    numericId: pad(numberFromId(audit.id), 3),
    adsVersion: ADS_VERSION,
    title: audit.title,
    subtitle: audit.shortTitle || '',
    status: normalizeAuditStatus(audit.status),
    version: audit.currentReleaseVersion || audit.version || '0.1.0',
    classification: 'public',
    summary: audit.canonicalTitle || audit.title,
    created: TODAY,
    updated: TODAY,
    permalink: audit.auditPath || `/audits/${dir}/`,
    tags: ['public-audit', 'evidence-platform'],
    records: {
      claims: `audits/${dir}/claims.json`,
      sources: `audits/${dir}/sources.json`,
      decisions: `audits/${dir}/decisions.json`,
      unknowns: `audits/${dir}/unknowns.json`,
      revisions: `audits/${dir}/revisions.json`,
      downloads: `audits/${dir}/downloads.json`
    },
    metrics: {
      claims: auditClaims.length,
      sources: auditSources.length,
      decisions: auditDecisions.length,
      unknowns: auditUnknowns.length,
      downloads: 0
    },
    institutionalRules: [
      'Evidence before opinion',
      'Transparency before trust',
      'Verification must be easier than belief'
    ]
  };

  const claims = auditClaims.map((claim) => ({
    id: adsClaimId(claim.id),
    legacyId: claim.id,
    auditId: adsId,
    legacyAuditId: claim.auditId,
    title: claim.title,
    statement: claim.statement,
    status: normalizeClaimStatus(claim.status),
    confidence: normalizeConfidence(claim.confidence),
    claimType: 'factual',
    sources: (claim.sources || []).map(adsSourceId),
    legacySources: claim.sources || [],
    decisions: (claim.decisions || []).map(adsDecisionId),
    legacyDecisions: claim.decisions || [],
    unknowns: (claim.openQuestions || []).map(adsUnknownId),
    legacyUnknowns: claim.openQuestions || [],
    created: firstRevisionDate(claim),
    updated: firstRevisionDate(claim),
    notes: claim.revisionHistory?.map((item) => item.summary).join(' ') || ''
  }));

  const sources = auditSources.map((source) => ({
    id: adsSourceId(source.id),
    legacyId: source.id,
    title: source.title,
    sourceType: normalizeSourceType(source),
    publisher: source.publisher || source.agency || '',
    agency: source.agency || '',
    published: source.publicationDate || undefined,
    accessed: source.retrievalDate || undefined,
    updated: source.retrievalDate || firstRevisionDate(source),
    url: source.officialUrl || source.canonicalUrl || undefined,
    archiveUrl: source.archiveUrl || undefined,
    archiveDate: source.archiveDate || undefined,
    health: normalizeSourceHealth(source),
    usedByClaims: (source.claimIds || []).map(adsClaimId),
    notes: source.summary || source.urlVerificationNote || ''
  }));

  const decisions = auditDecisions.map((decision) => ({
    id: adsDecisionId(decision.id),
    legacyId: decision.id,
    title: decision.title,
    status: normalizeDecisionStatus(decision),
    scope: 'audit',
    appliesTo: [adsId, ...(decision.sectionIds || [])],
    decision: decision.body || decision.title,
    rationale: decision.body || '',
    created: firstRevisionDate(decision),
    updated: firstRevisionDate(decision),
    locked: firstRevisionDate(decision),
    notes: decision.revisionHistory?.map((item) => item.summary).join(' ') || ''
  }));

  const unknowns = auditUnknowns.map((question) => ({
    id: adsUnknownId(question.id),
    legacyId: question.id,
    auditId: adsId,
    legacyAuditId: question.auditIds?.[0] || audit.id,
    title: question.title,
    status: normalizeUnknownStatus(question.status),
    severity: 'major',
    description: question.currentState || question.recordNeeded || question.whyItMatters || question.title,
    whyItMatters: question.whyItMatters || '',
    relatedClaims: (question.claimIds || []).map(adsClaimId),
    relatedSources: (question.sourceIds || question.relatedSources || []).map(adsSourceId),
    resolution: question.recordNeeded || '',
    created: firstRevisionDate(question),
    updated: firstRevisionDate(question),
    notes: question.revisionHistory?.map((item) => item.summary).join(' ') || ''
  }));

  writeJson(`audits/${dir}/audit.json`, auditRecord);
  writeJson(`audits/${dir}/claims.json`, claims);
  writeJson(`audits/${dir}/sources.json`, sources);
  writeJson(`audits/${dir}/decisions.json`, decisions);
  writeJson(`audits/${dir}/unknowns.json`, unknowns);
  writeJson(`audits/${dir}/revisions.json`, []);
  writeJson(`audits/${dir}/downloads.json`, []);

  return {
    id: adsId,
    title: audit.title,
    status: auditRecord.status,
    path: `/audits/${dir}/`,
    record: `audits/${dir}/audit.json`,
    publicUrl: audit.auditPath || `/audits/${dir}/`
  };
}

const registry = {
  adsVersion: ADS_VERSION,
  updated: TODAY,
  audits: publication.audits.map(exportAudit)
};

writeJson('registry/audits.json', registry);
