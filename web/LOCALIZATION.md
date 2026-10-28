# Console languages

The original static-exported console supports **English (`en`)** and
**Simplified Chinese (`zh-CN`)**. The language button is available on authentication
screens, in the header, and in the sidebar (including full-screen task details).

An explicit selection is stored using the existing client-side preference cookie.
Without a valid saved choice, the first supported browser language is used; other
languages fall back to English. Static HTML and its initial hydration use English.
The provider then applies the preference and updates `document.documentElement.lang`.
No server-side rendering service, account migration, page reload, or model request
is involved. Blocked browser storage does not prevent changing the current session's
language. Clearing/expiring the preference restores browser-language detection.

## Messages and data boundaries

`src/lib/i18n/messages/*.json` contains English translations grouped by feature.
The original Chinese text is the stable message key and is also the Chinese
translation, assembled by `catalog.ts`. Each message belongs in one catalog;
messages used across features belong in `common.json`.

Use numbered placeholders instead of joining translated fragments:

```tsx
import { t as uiText } from "@/lib/i18n/core";
uiText("确认删除任务 #{0}？", [task.id]);
```

Interpolation substitutes values literally; it does not parse HTML, translate user
text, or treat replacement symbols as code. Unknown keys remain readable. The rare
case where the same Chinese text has different meanings uses gettext-style context:
`uiText("关闭", [], "toggle")` resolves `toggle\u0004关闭` to “Off”, whereas the
unqualified message means “Close”. Chinese remains “关闭” in both cases.

Translate **explicit interface labels only**. Leave task names/descriptions,
prompts, instructions, skills, model names, findings, reports, raw logs, protocol
markers, routing paths, enum values, and structured chat-mention serialization
unchanged. User/model content can therefore remain Chinese in an English interface.
Raw server diagnostics are displayed verbatim unless they match an explicit
interface message; selecting a language does not claim to translate the backend.

## React and formatting

`useUILocale()` subscribes to a small external locale store. A language change does
not remount the page, so form drafts, dialogs, and data subscriptions survive.
New components can call `translate(locale, message, values)` with the locale returned
by that hook, or use `<UIMessage message="关闭" />` for a standalone interface label.

Existing components that call the shared `uiText` helper explicitly subscribe and
opt out of React Compiler memoization with `"use no memo"`. This is necessary because
the compiler cannot see that module-level label getters depend on the external
locale. Module-level display maps use getters rather than translating at import
time. Memoized *display* computations also depend on locale. Do not add locale to
effects that submit data, initialize a form draft, or start/resume jobs.

Dates and explicitly formatted numbers use `getLocale()` with `Intl`/locale-aware
methods. Keep numeric identifiers and protocol values unchanged. Relative-time
messages use the same catalogs as other labels.

## Verification and activation

From `web/`:

```sh
npm run test:i18n
npx tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build:static
```

The test suite covers catalog completeness, interpolation, locale resolution,
reactive status labels, contexts, and source message coverage. Browser verification
should additionally check selection persistence, form drafts, auth/consent gating,
safe confirmation dialogs, and desktop/mobile layouts. Use isolated fixtures for
destructive actions; never start a scan or mutate existing jobs to test localization.

The frontend is embedded in the Go binary. Follow the original static export and
`CGO_ENABLED=0 go build -tags embedui` instructions to rebuild it. Activating a new
binary requires a coordinated restart: the original server resumes unpaused jobs.
Do not change pause states or assume a source edit alone updates the running UI.
