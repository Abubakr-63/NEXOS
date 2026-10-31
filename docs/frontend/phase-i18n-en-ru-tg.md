# NEXOS Frontend Internationalization (i18n)
## English (en) · Russian (ru) · Tajik (tg)

### Executive Summary

This document describes the production-grade internationalization system built for NEXOS Android Creation Studio. The implementation covers all existing screens, modal dialogues, navigation bars, project creation flows, ROM studio stages, profile/settings, documentation, and dynamic 3D phone preview notifications across three fully supported languages:

1. **English (`en`)**: Canonical reference locale.
2. **Russian (`ru`)**: Polished, professional technical Russian.
3. **Tajik (`tg`)**: Standard literary Tajik Cyrillic incorporating proper national characters (`ҷ`, `ҳ`, `қ`, `ӯ`, `ғ`, `ӣ`).

---

### Architectural Highlights

1. **Zero External Dependency Bloat & Zero Lockfile Changes**:
   - Built with a native, type-safe React context and TypeScript path-mapping architecture.
   - Preserves `pnpm-lock.yaml` completely untouched, preventing merge conflicts with the backend worktree (`NEXOS-codex`).

2. **Backend & Protocol Non-Interference**:
   - Machine-readable enum values sent over `/api/v1/*` contracts (`balanced`, `performance`, `battery`, device model IDs, etc.) remain strictly canonical. Only user-facing display labels are localized.
   - URL routes (`/login`, `/register`, `/`, `/projects`, `/projects/new`, `/builder/[id]`, `/profile`, `/settings`, `/help`) remain completely stable.

3. **Client Reactivity & Seamless WebGL Lifecycle**:
   - Switching language updates the DOM and translation hooks immediately without unmounting the Three.js canvas or resetting the autonomous cinematic camera choreography.
   - Screen texture strings on the virtual 3D display (`Your Android journey` / `Welcome back`) update in real-time.

4. **Persistence & SSR Consistency**:
   - Locale preference is stored in a validated browser cookie (`nexos_locale`) with a 1-year max-age.
   - An inline hydration script sets `document.documentElement.lang` synchronously prior to paint to prevent layout flashes.

---

### File Organization

```
apps/web/
├── messages/
│   ├── en.json                       # Canonical English dictionary (12 namespaces)
│   ├── ru.json                       # Russian dictionary (100% key parity)
│   └── tg.json                       # Tajik dictionary (100% key parity, valid Cyrillic)
├── lib/i18n/
│   ├── types.ts                      # Locale definitions, supported locales, path types
│   ├── cookie.ts                     # Browser cookie reader & writer (nexos_locale)
│   ├── formatters.ts                 # Intl-based date, time and number formatters
│   ├── context.tsx                   # I18nProvider, useTranslation, useLocale hooks
│   └── index.ts                      # Public module exports
├── components/
│   ├── language-switcher.tsx         # Accessible dropdown & button variants
│   ├── auth/auth-shell.tsx           # Auth screen topbar with language switcher
│   ├── shell.tsx                     # Topbar and dock with localized nav & switcher
│   ├── account.tsx                   # Settings with full language card selection
│   ├── project-creation.tsx          # 4-stage ROM creation wizard
│   ├── studio.tsx                    # 10-stage Visual Builder Studio
│   ├── workspace-pages.tsx           # Overview, Projects, Profile
│   ├── help-content.tsx              # Localized help & documentation
│   └── pixel/desktop-experience.tsx  # 3D film copy & floating notifications
```

---

### Translation Namespaces (100% Key Parity)

| Namespace | Scope |
|---|---|
| `common` | App name, tagline, general buttons, modal actions, language names |
| `nav` | Sidebar, topbar, mobile bottom dock, more menu |
| `auth` | Login/register headings, subheadings, form fields, badges, footers |
| `overview` | Welcome kickers, statistics, action cards, device compatibility notes |
| `projects` | Project table headers, empty states, search, filter, revision counts |
| `projectCreation` | 4 wizard steps (Identity, Device, Base, Review), search, validation |
| `romStudio` | 10 builder stages, presets, draft summary, export/import, notices |
| `profile` | User identity cards, roles, session security summary |
| `settings` | Interface appearance, language selection cards, active sessions |
| `help` | Getting started guides, conceptual explanation, architecture notes |
| `phonePreview` | 3D overlay captions, 7 film scene descriptions, floating action toasts |
| `errors` | Canonical error mappings, fallback messages, network alerts |

---

### Automated Verification & Quality Assurance

1. **Automated Completeness Test (`tests/i18n-completeness.test.ts`)**:
   - Evaluates 100% key matching across `en.json`, `ru.json`, and `tg.json`.
   - Confirms all variable interpolation placeholders (`{username}`, `{count}`, `{id}`, etc.) exist identically across all translations.
   - Asserts the presence of all distinctive Tajik Cyrillic characters (`ҷ`, `ҳ`, `қ`, `ӯ`, `ғ`, `ӣ`).
   - Validates ICU pluralization and `Intl` number/date formatting.
   - Result: **7 / 7 tests passed (0 failures)**.

2. **TypeScript & Static Analysis**:
   - `pnpm --filter @rom-hub/web typecheck` generated route types and passed with **0 errors**.
   - `pnpm --filter @rom-hub/web lint` passed with **0 errors and 0 warnings**.

3. **Production Build**:
   - `pnpm --filter @rom-hub/web build` compiled all 16 static/dynamic routes with Turbopack in **4.6s**.

4. **Live Edge Chromium Verification**:
   - Tested live on `http://localhost:3000` interacting with running Codex API on port 4000.
   - Verified instant language toggle on Login (`/login`), Registration (`/register`), Settings (`/settings`), Overview (`/`), Create ROM (`/projects/new`), and Help (`/help`).
   - Generated visual verification artifacts:
     - `i18n-login-en.png`
     - `i18n-login-ru.png`
     - `i18n-login-tg.png`
     - `i18n-register-tg.png`
     - `i18n-settings-tg.png`
     - `i18n-overview-tg.png`
     - `i18n-create-rom-tg.png`
     - `i18n-help-tg.png`
