# ROMCRAFT studio design system

Presentation lives in `apps/web/components/design-system.tsx` and `apps/web/app/studio-design.css`. The root layout imports this stylesheet after the existing global/Tailwind stylesheet. Existing authentication, project persistence, validation, and builder state remain in their original modules.

## Components

- GlassPanel: blurred surface for floating overlays.
- GlassCard: bordered content surface with restrained hover elevation.
- NavigationPill / NavigationItem: semantic navigation with route-aware `aria-current`.
- FloatingToolbar: grouped editor actions.
- SectionHeader: consistent eyebrow, heading, description and secondary content.
- ProfileCard: link to existing account settings and sessions.
- StatusIndicator: text plus a decorative status dot.
- PrimaryButton / SecondaryButton: native buttons preserving disabled and event behavior.

## Tokens and behavior

The stylesheet defines dark/light surface, border, text, accent, active-state, shadow, radius and easing tokens. New surfaces should use these variables rather than hardcoded page colors. Backdrop blur is limited to the rail, dock, overlays and small floating panels; cards use gradients. No external images, downloaded fonts or animation library are required.

Desktop uses a floating 176 px rail, collapsible to 94 px. Tablet automatically uses the compact rail. At 720 px and below, the rail is replaced with a bottom dock for Overview, My projects, Create ROM and More. More opens a native modal dialog for Settings, Profile and the home page, with focus containment, Escape dismissal and focus restoration. The dock and page spacing account for safe-area insets. Desktop collapse transitions are disabled across the mobile breakpoint to avoid intermediate horizontal overflow.

The selected item follows the actual route: new configurations select Create ROM; saved project and builder routes select My projects; settings descendants select Settings. The brand links to the existing landing page. No new product routes or account capabilities are fabricated.

Reduced-motion preferences disable motion. Visible labels, native links/buttons, focus rings, accessible names and contrast remain part of the component contract. The illustrative phone is a visual concept, not an actual device render.

## Verification

`pnpm exec playwright test --config playwright.styles.config.ts` checks generated CSS, computed layout, desktop/tablet/mobile breakpoints, rail collapse, route selection, dialog focus, theme persistence and reduced motion. Set `STYLE_TEST_URL` to check a running dev server. The existing end-to-end suite additionally verifies the editor, authenticated persistence and automated WCAG A/AA checks. Automated checks do not replace assistive-technology testing.
