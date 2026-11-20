# GitHub Pages Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish this presentation at https://skill-issues.console-craft.com under the console-craft organization.

**Architecture:** Make the existing repository public, as explicitly authorized. Deploy only runtime files through GitHub Actions on main; configure GitHub Pages and a DNS-only Cloudflare CNAME without changing other DNS records.

**Tech Stack:** GitHub CLI/API, GitHub Actions Pages actions, Cloudflare DNS API/flarectl.

**Spec:** The deployment description approved in this conversation: existing console-craft/skill-issues-presentation repository, public website, custom subdomain, HTTPS, no application behavior changes.

## Global Constraints

- Organization: console-craft; repository: skill-issues-presentation; deployment branch: main.
- Publish index.html, deck.js, transitions.js, assets/, and composition/ only.
- DNS: skill-issues.console-craft.com CNAME console-craft.github.io, DNS-only.
- Do not change existing apex DNS, unrelated records, presentation content, or billing.
- Verify the subdomain under the organization to avoid affecting other existing Pages sites.
- Never commit credentials; request scoped Cloudflare access securely.

## Review Focus

- Accidental source publication: inspect staging contents and repository history for likely credentials before publishing.
- Missing nested assets: confirm staged HTML/CSS/JS references resolve locally and live.
- Incorrect permissions: validate Pages Actions permissions and deployment environment configuration.
- Conflicting DNS: inspect exact-host records before writing; stop if replacement would disrupt an existing service.
- Pending TLS issuance: distinguish deployment/DNS success from certificate readiness; enforce HTTPS only when supported.

---

### Task 1: Publish the static deck

**Files:** Create `.github/workflows/pages.yml`; update `README.md`.

**Interfaces:** Existing static runtime files are input; a successful github-pages deployment is output.

- [x] Inspect published history for credential-like text and confirm explicit visibility authorization.
- [x] Make the repository public and enable Actions-based Pages.
- [x] Add the standard Pages workflow with main push/manual triggers, minimal permissions, concurrency, and github-pages environment.
- [x] Stage only the runtime allowlist; verify required files and local asset references.
- [x] Document deployment triggers, output scope, and DNS configuration.
- [ ] Review the diff, commit, and publish to main without discarding existing work.
- [ ] Confirm a successful Pages workflow run and live runtime resources.

### Task 2: Configure the custom domain

**Files:** No additional product files; update this checklist with results.

**Interfaces:** Task 1's Pages site and authorized DNS access are input; working HTTPS custom domain is output.

- [x] Obtain narrowly scoped Cloudflare Zone DNS Edit and Zone Read access for console-craft.com.
- [x] Inspect exact-host DNS records and organization Pages domain verification.
- [ ] Verify skill-issues.console-craft.com under console-craft using GitHub's TXT challenge, if accessible.
- [x] Set the repository's Pages custom domain before adding the DNS CNAME.
- [x] Create the DNS-only CNAME only if no conflicting record exists.
- [ ] Confirm authoritative/public DNS, deployment status, and certificate readiness; enable HTTPS when ready.
- [ ] Report the live URL and any remaining propagation or test limitations.
