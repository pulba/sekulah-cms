# Engineering Quality, Automated Testing & Bug Hunting Protocol

Comprehensive operational specification for AI coding agents to inspect, test, debug, audit, and refactor software systems with zero regression and verified correctness.

---

## 1. Core Principles & Safety Boundaries

1. **Evidence Over Assumption**: Never report a bug without reproduction or verifiable code path analysis. Never claim a fix without verification.
2. **Surgical Precision**: Touch only lines required to resolve the issue. Avoid speculative refactoring and unsolicited formatting changes.
3. **Safety First**:
   - **Never** execute destructive commands (`DROP TABLE`, `rm -rf`, production data deletion, unreviewed database migrations).
   - **Never** alter `.env`, secrets, or credentials without explicit authorization.
   - **Preserve uncommitted changes**: Always run `git status` / check dirty state before modifying files.
4. **No False Confidence**: A test that was not executed is not a passed test. Never suppress errors, mute tests, or weaken assertions to pass a check.

---

## 2. Project Inspection (Discovery Phase)

Before executing commands or modifying code, inspect the environment:

### Discovery Checklist
- [ ] **Working Tree**: Run `git status` to detect uncommitted changes or active branch constraints.
- [ ] **Package Manager**: Identify lockfiles:
  - `bun.lock` / `bun.lockb` $\rightarrow$ `bun`
  - `pnpm-lock.yaml` $\rightarrow$ `pnpm`
  - `package-lock.json` $\rightarrow$ `npm`
  - `yarn.lock` $\rightarrow$ `yarn`
  - `Cargo.lock` $\rightarrow$ `cargo`
  - `poetry.lock` / `Pipfile.lock` $\rightarrow$ `poetry` / `pipenv`
- [ ] **Manifest & Scripts**: Read `package.json` (or language equivalent) to index available scripts:
  - `test`, `test:unit`, `test:e2e`, `test:coverage`
  - `lint`, `lint:fix`, `typecheck`, `check`
  - `build`, `dev`
- [ ] **Configuration Files**: Check testing & linting setups:
  - Vitest: `vitest.config.ts`
  - Jest: `jest.config.js`
  - Playwright: `playwright.config.ts`
  - Cypress: `cypress.config.ts`
  - TypeScript: `tsconfig.json`
  - Linter: `eslint.config.js`, `.eslintrc.*`, `biome.json`
- [ ] **Agent & Repo Rules**: Review repository rules (`AGENTS.md`, `CLAUDE.md`, `.agents/`, `README.md`).

---

## 3. Testing Strategy & Execution Priority

Prioritize checks by execution speed, stability, and diagnostic value:

```text
[Level 1: Static Analysis]
Typecheck -> Lint -> Config validation
       |
[Level 2: Targeted Unit & Integration Tests]
Run tests covering the modified scope only
       |
[Level 3: Bug Reproduction & Verification]
Failing test (Red) -> Fix (Green) -> Regression assertion
       |
[Level 4: Build Verification]
Ensure artifacts compile cleanly without broken exports or type regressions
       |
[Level 5: Broad Test Suite & E2E]
Run full test suite or browser automation when required by risk scope
```

---

## 4. Automated Testing Execution Guide

Execute commands using the detected package manager. Prefix commands with `rtk` if available in the environment.

### 4.1. Static Verification
```bash
# Typecheck
bun x tsc --noEmit           # or npm run typecheck / pnpm typecheck

# Linting
bun x eslint .               # or npm run lint / biome check .
```

### 4.2. Targeted Test Execution
Never run entire monorepos or full test suites when testing a single function. Target specific test files:
```bash
# Vitest / Jest target file
bun x vitest run path/to/file.test.ts
bun x jest path/to/file.test.ts

# Pytest / Go / Cargo
pytest tests/test_target.py -k "test_specific_case"
go test -v ./pkg/target/... -run TestSpecificCase
cargo test test_specific_case
```

### 4.3. Build Verification
```bash
bun run build                # or npm run build / pnpm build
```

### 4.4. Missing Test Infrastructure
If the project lacks tests:
1. Note the absence in the audit report.
2. Verify logic statically (strict type checks, AST/lint inspection).
3. Implement a minimal standalone test script (e.g., node/bun execution of an isolated module test) without imposing an unrequested heavy framework.

---

## 5. Bug Hunting & Root Cause Analysis

Do not patch symptoms. Identify the definitive root cause.

### 5.1. Defect Taxonomy & Inspection Points
- **Logic Bugs**:
  - Boundary conditions (off-by-one, `<`, `<=`, `>`, `>=`).
  - Falsy coercion bugs (`0`, `""`, `null`, `undefined` treated identically).
  - Operator precedence and missing parentheses.
- **Runtime & Exception Crashes**:
  - Unchecked null/undefined member access (`foo.bar` when `foo` is nullish).
  - Unhandled Promise rejections and unhandled async exceptions.
  - JSON parse errors on invalid network payloads.
- **Client & Console Errors**:
  - Hydration mismatches (SSR vs. client render).
  - Missing React/Astro client directives (`client:load`, `client:visible`).
  - Dangling DOM event listeners or accessing browser globals (`window`, `document`) during SSR.
- **API & Network Failures**:
  - Status code mismatches (e.g., returning 200 with `{ error: ... }` when client expects 4xx/5xx).
  - Payload schema drift between frontend client and backend server.
  - CORS header omissions or wrong HTTP methods.
- **Database & Data Tier**:
  - Unhandled unique constraint violations.
  - Connection pool exhaustion from unclosed sessions.
  - Missing foreign key indexes or transactions omitted during multi-table writes.
- **Concurrency & Race Conditions**:
  - Read-after-write inconsistencies.
  - Debounce/throttle omissions on rapid user input.
  - Multiple simultaneous writes to shared in-memory state.

### 5.2. Root Cause Protocol
```text
1. Reproduce: Create minimal reproducible input or test case that triggers failure.
2. Isolate: Trace call stack to the exact function and line number.
3. Validate Hypothesis: Confirm why current implementation fails on this input.
4. Apply Minimal Fix: Modify strictly necessary code.
5. Re-verify: Confirm test passes and related functionality remains healthy.
```

---

## 6. Clean Code & Structural Quality Audit

Audit code against sustainable engineering standards:

- **Duplication (DRY)**: Identify redundant blocks $\ge 10$ lines that serve identical purposes. Extract shared helpers only within logical domain boundaries.
- **Cyclomatic Complexity**: Flag functions with nesting depth $> 3$ or high branching complexity. Refactor using early returns (guard clauses).
- **Dead Code & Unused Symbols**: Detect uncalled functions, unused variables, orphan imports, and unreachable branches.
- **Naming & Intent**: Ensure variable and function names communicate semantic intent (e.g., `isApplicantVerified` vs `chk`).
- **Separation of Concerns**:
  - Business logic must not reside in UI presentation components.
  - Data access must not leak raw SQL/queries directly into route handlers.
- **Project Consistency**: Adhere to the existing project idiom (tabs vs. spaces, error handling format, export styles).

---

## 7. Security Audit Protocol

Review critical security surfaces:

### 7.1. Trust Boundaries & Input Validation
- All untrusted input (URL params, request bodies, query strings, headers) must be validated before processing (e.g., Zod, Valibot, standard schemas).
- Reject unexpected fields; enforce length, format, and type limits.

### 7.2. Authentication & Authorization
- Verify that every protected route and mutation enforces session validation.
- Protect against IDOR (Insecure Direct Object Reference): verify that the authenticated user owns or has explicit permission to access the target resource ID.

### 7.3. Injection Vectors
- **SQL / NoSQL**: Enforce parameterized queries or ORM abstractions. Reject string concatenation in queries.
- **Command Injection**: Avoid passing unsanitized user inputs to shell execution commands.
- **XSS**: Audit dynamic HTML rendering (e.g., `innerHTML`, `set:html`, `dangerouslySetInnerHTML`). Ensure user strings are properly escaped.

### 7.4. Secrets & Sensitive Data
- Audit client-side bundles: ensure no API secret keys, database credentials, or private tokens leak into client scripts.
- Ensure sensitive fields (`passwordHash`, `ssn`, `authTokens`) are excluded from API response serializations.

### 7.5. Dependency Vulnerabilities
```bash
bun pm audit                 # or npm audit / pnpm audit
```
Address high/critical vulnerabilities affecting reachable code paths.

---

## 8. Performance & Resource Audit

Identify verifiable bottlenecks through static analysis and profiling:

- **Database Performance**:
  - Detect N+1 queries (looping over queries inside application code instead of joins/batch queries).
  - Ensure columns used in `WHERE`, `ORDER BY`, and `JOIN` clauses have supporting indexes.
  - Verify pagination limits (prevent unbound `SELECT * FROM table`).
- **Memory & Resource Leaks**:
  - Verify removal of event listeners, intervals, and observers (`clearInterval`, `removeEventListener`, `unsubscribe`).
  - Prevent unbounded caching in process memory.
- **Bundle & Asset Bloat**:
  - Check for accidental inclusion of heavy server libraries in client bundles.
  - Optimize dynamic imports for route-level code splitting.
- **Render & Compute Overhead**:
  - Eliminate redundant re-renders or expensive calculations executed on hot render paths.

---

## 9. Error Handling & Data Integrity

Ensure resilience under failure conditions:

- **Fail-Safe Defaults**: Degrade gracefully when external services or optional features fail.
- **Null Safety**: Guarantee safe handling of empty arrays, null database fields, and undefined optional attributes.
- **Network & External Resilience**: Implement explicit timeouts and retry mechanisms with backoff for transient network requests.
- **Transactional Consistency**: Wrap atomic multi-step mutations in database transactions; ensure automatic rollback on failure.
- **Secure Diagnostics**:
  - Log full error stacks internally with contextual metadata.
  - Return sanitized, non-leaking error messages to clients (e.g., never expose raw stack traces or DB errors to public API responses).

---

## 10. Safe Refactoring & Regression Testing

Refactoring must never change observable external behavior.

### Refactoring Rules
1. **Behavioral Invariance**: Do not rename external APIs, route paths, query parameters, or response payloads.
2. **Database Integrity**: Never drop columns or change types without explicit backward-compatible migration paths.
3. **Pre-Refactor Baseline**: Run static checks and unit tests before touching code.
4. **Stepwise Changes**: Perform refactoring in small, independent commits or edits.
5. **Regression Verification**:
   - Run affected tests after each change.
   - For every fixed bug, add a dedicated regression test case ensuring the exact defect cannot reappear.

---

## 11. Test Failure Handling & Environmental Blockers

When tests or checks fail:

1. **Classify Failure**:
   - **Code Defect**: Direct bug introduced by code changes $\rightarrow$ fix immediately.
   - **Environment / Infrastructure**: Missing service (Docker, Redis, DB), missing environment variable, network timeout $\rightarrow$ document explicitly.
   - **Stale / Flaky Test**: Test depends on timing, order, or stale mocks $\rightarrow$ isolate cause; never simply mute without explanation.
2. **Strict Rule**:
   - Do **NOT** comment out tests.
   - Do **NOT** change assertions from strict to loose (e.g., `expect(a).toBe(b)` $\rightarrow$ `expect(true).toBe(true)`).
   - Do **NOT** use `// @ts-ignore` or `any` casting to hide typecheck failures.
3. **Transparent Reporting**: If an external dependency blocks full verification, report the exact error, command run, and remediation steps needed.

---

## 12. Standardized Audit & Test Report Template

Every audit or verification session must output a structured markdown report:

```markdown
# Quality & Verification Report

## Executive Summary
- **Target Scope**: [Modules / Files audited]
- **Status**: [PASSED | PASSED WITH WARNINGS | FAILED]
- **Verification Evidence**: [Typecheck: OK | Lint: OK | Tests: X/X passed | Build: OK]

## Discovered Issues

| ID | Severity | Category | File | Description | Status |
|:---|:---|:---|:---|:---|:---|
| ISS-01 | High | Security | `src/server/auth.ts` | Missing permission check on delete endpoint | Fixed |
| ISS-02 | Medium | Performance| `src/server/db.ts` | N+1 query inside applicant listing | Fixed |
| ISS-03 | Low | Clean Code | `src/utils/date.ts` | Dead helper function `parseLegacyDate` | Removed |

## Root Cause & Changes Made
### ISS-01: Missing permission check
- **Root Cause**: Handler did not check user role before executing mutation.
- **Resolution**: Added role validation guard clause at entry of `deleteApplicant`.
- **Files Touched**: `src/server/auth.ts:L45-L52`

## Verification & Test Results
- **Command Executed**: `bun run typecheck && bun test src/server/auth.test.ts`
- **Output**: 4 passed, 0 failed.
- **Build Status**: `bun run build` exited with code 0.

## Limitations & Unresolved Risks
- [e.g., E2E suite requires live payment gateway sandbox; verified with local unit mock only.]
```

---

## 13. Definition of Done (DoD)

A task or audit is completed **only** when all of the following criteria are met:

- [ ] **Discovery**: Relevant scripts, configs, and existing conventions identified.
- [ ] **Implementation**: Surgical changes applied; no unrelated files or formatting altered.
- [ ] **Type & Static Checks**: Typecheck passes with 0 errors. Linter passes or clean.
- [ ] **Targeted Verification**: Relevant unit/integration tests pass.
- [ ] **Regression Prevention**: New regression test added or covered by existing tests.
- [ ] **Build Validation**: Project build passes without errors (when applicable).
- [ ] **Zero Masking**: No tests disabled, assertions weakened, or `@ts-ignore` added.
- [ ] **Transparent Documentation**: Detailed audit report provided with exact commands and evidence.
