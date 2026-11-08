# Executive brief

A ten-page brochure for the chief executive and chief marketing officer,
covering the whole product as of the October 2026 release.

| File | What it is |
| --- | --- |
| `aureoncare-executive-brief.pdf` | Ten US-Letter pages, print-ready |
| `aureoncare-executive-brief.html` | The same brief as one self-contained web page |
| `brochure.template.html` | The source both are built from — edit this |
| `build.js` | Inlines fonts, logo and screens, then renders the PDF |
| `assets/` | Screens, logo and the three typefaces |

```
NODE_PATH=$(npm root -g) node docs/marketing/executive-brochure/build.js
```

The build refuses to write a PDF if any page would clip its content. Each
printed sheet is a fixed 11in with overflow hidden, so without that check a
paragraph that grows by one line disappears from the print with no warning.

## Structure

The brand's own promise, *Health · Efficiency · Growth*, is the chapter order:
Health for clinical leaders, Efficiency for the chief executive, Growth for the
chief marketing officer. Around them sit the case for one system, the October
additions, governance, the full inventory and the plans.

## Every claim is checked against the code

Each capability in the brief was traced to a route, service or screen before it
went in. A few were reworded on the way because the first draft went further
than the code: the claim form *picks up the diagnoses already on the chart*,
which is not the same as coding a claim automatically.

**What was left out on purpose.** `EXECUTIVE_SUMMARY.md` at the repository root
is a pre-launch document, and several of its claims cannot go in front of an
executive audience as they stand:

- **Analyst recognition** — a Gartner "Technology to Watch" listing, a KLAS
  "High Potential" rating and a HIMSS showcase selection. These appear nowhere
  else in the repository. They are claims about named third parties' views, and
  printing one that cannot be produced on request is a serious problem.
- **Compliance badges** — "HIPAA Compliant", "FDA 21 CFR Part 11", "compliant
  with all 50 states" and "$5M breach coverage secured". The repository's own
  `SEC-05_MULTI_TENANCY_PLAN.md` describes tenant isolation as an open gap, so a
  compliance badge would contradict the project's security record.
- **Projected ROI** — $1.0–1.2M per practice at 567–710%, attributed to pilot
  data from before the beta began.
- **Survey figures** — "500 practices surveyed", with percentages.

The governance page describes controls that exist instead: an audit trail that
records views, role-based access, two-step sign-in, AES-256-GCM sealed backups,
tenant-scoped restore and FHIR R4 export. If evidence for any of the excluded
claims exists — a SOC 2 report, the analyst citation itself — it can be added,
attributed to its source.

**Named vendors.** The brief lists Surescripts, LabCorp and Optum as built-in
connectors. Each is a real API client (`backend/services/vendorIntegrations/`)
with sandbox and production endpoints, switched on with the practice's own
account. That supports "connector"; it does not establish a certified
partnership. Confirm each vendor relationship before the brief is distributed
outside the company, and reword if any is not in place.

**Screens are demo data.** Every screen is a capture of the demo environment
with synthetic patients, and each caption says so. Keep that true when
replacing them. Pre-authorization screens are deliberately not used: their demo
rows name real insurers, which a reader could take as claimed relationships.
