# Roadmap

## Release 0.1: Deployment foundation
Status: complete.

GitHub repository, Cloudflare pipeline, production domain, and static asset configuration are in place.

## Release 0.2: Publication shell
Status: in progress.

Homepage, audit reader foundation, source library foundation, explorer prototype, methodology, downloads, press, corrections, and sitemap.

Latest branch progress:

- Canonical Sections 10 through 16 converted into semantic HTML.
- Appendix A and Appendix B upgraded from placeholders into structured publication pages.
- Source Library expanded to 47 canonical `S-xxx` records currently visible in the converted v1.0 publication.
- Decision Log expanded to 15 numbered canonical `D-xxx` records with individual detail pages.
- Open Question coverage expanded to one page for every `A-001` through `A-037` register entry, including carried and resolved items.
- Explorer upgraded into an initial claim-to-source traceability surface linking sections to source, decision, and open-question records.
- Client-side publication search, release-history pages, and verification-layer generation scripts are live.

## Release 0.3: Full v1.0 web conversion
Status: in progress.

Convert the locked audit sections, appendices, source library, and decision log into structured web pages.

Remaining highest-value work:

- Add claim-to-source traceability views and section-level source panels.
- Expand search coverage and cross-reference routing across sections, sources, decisions, and open questions.
- Restore unattended deployment verification by supplying `CLOUDFLARE_API_TOKEN`; as of July 1, 2026, production root returns `200 OK` while newly generated branch pages such as `/decision-log/d-020.html` still return `404`.

## Release 0.4: Verification layer

Add source panels, trace panels, section navigation, search, open-question register, and public correction workflow.

## Release 1.0: Launch candidate

Full audit online, source library online, downloads complete, press kit complete, SEO pass, accessibility pass, and hostile-reader review complete.
