# Alarm Clock design

## Context

- Artifact: a mobile alarm app with conversational onboarding, an AI alarm negotiation, and a small personal activity ledger.
- Audience: students and working people using a deliberately unproductive comedy app. Primary action: set an alarm, then resolve it through a short text conversation.
- Positioning: playful consumer utility. The user's original reference is the iPhone Clock app; keep its dark canvas, clear time numerals, switches, and bottom tabs.
- Adjectives: familiar (platform controls), sleepy (low-glare dark surfaces), mischievous (the sound stack and Duvet's copy), legible (large time and readable chat).
- Essence: familiar, sleepy, mischievous.
- Proposition: a normal alarm with a pillow arguing the other side.
- Mode: deliberately dark in both OS themes. No unrequested light-mode redesign.
- Constraints: React, Capacitor, plain CSS, small screens, keyboard operation, PG-13 character, notifications subject to iOS rules.
- References: iPhone Clock for alarm controls; the familiar message stream for conversation. Mobbin's native alarm/setup flows are a useful future reference, not a component dependency. Verify licenses before importing any third-party component.

## Aesthetic commitment

Candidates considered: a marketing-style bedtime landing page; a colorful game-like mascot interface; a quiet native clock with an argumentative sound console. The user's iPhone reference selects the third. Remove marketing hero decoration, badge clutter, three matching statistic cards, and diffuse glows. The interaction is the personality.

Signature move: **the live sound stack**. Each press of Make it worse adds a labeled sound track and an audible layer. This is actual state, not an animated ornament.

## Typography

- Display: Barlow Condensed SemiBold, Google Fonts, SIL Open Font License. Tall alarm numerals and short titles recall a bedside clock without replacing native controls.
- Body: Manrope Variable, Google Fonts, SIL Open Font License. Open, friendly letterforms for the conversation.
- Fonts are bundled locally; no remote font requests. System fallbacks remain available.
- Functional type scale: 1.25, base 16px; approximate steps 12 / 16 / 20 / 25 / 31 / 39 / 49. Dense metadata is at least 11px, controls at least 14px, primary mobile controls target 44px.
- Short display headings use modest tracking, not tighter than -0.02em. Chat line-height 1.6. Durations use tabular numerals.

## Color and tokens

Dominant charcoal, warm orange accent, off-white text. The orange connects to the user's Clock reference. Approximate distribution: 85% neutral surfaces, 10% warm supporting surfaces, 5% action accent. Green is reserved for enabled alarm switches and outcome state.

Semantic tokens live in the existing `src/style.css` root layer. OKLCH overrides have hex fallbacks for older iOS web views. The new stylesheet consumes these tokens.

| Role          | Hex fallback | Use                          |
| ------------- | ------------ | ---------------------------- |
| bg            | #101014      | Low-glare page               |
| surface       | #1a191e      | Raised controls              |
| raised        | #29262d      | Assistant message            |
| fg            | #f5f3ef      | Primary text                 |
| muted         | #b7adbf      | Secondary text               |
| accent        | #f6bd7d      | Primary action               |
| accent-fg     | #29190d      | Text on orange               |
| border        | #454047      | Decorative division          |
| border-strong | #807585      | Input outline                |
| user-surface  | #443325      | User message                 |
| user-fg       | #ffe1be      | User message text            |
| success       | #55d87c      | Enabled and completed states |

`--font-display`, `--font-body`, `--spacing` (4px), `--duvet-radius-sm` (8px), and `--duvet-radius-lg` (16px) govern new screens. Existing platform switches remain pill-shaped. Defined edges and surface lightness establish hierarchy; no diffuse card shadows.

## Layout and craft

- Mobile: one focused flow, 18px edges, bottom navigation, primary composer below the transcript, safe-area insets.
- Wide onboarding: a compact introduction beside the working conversation, not a landing-page hero. At 760px and below it becomes one column.
- Alarm: duration and the sound stack precede the chat. Persistent safe exit and accessibility mute appear below it. The plain transcript receives the most space.
- Statistics: a ruled ledger of actual durations and explicit task outcomes. No decorative metric tiles.
- Buttons: orange filled primary, warm outlined secondary, text tertiary. Hover brightness, pressed feedback, focus outline, disabled state, and descriptive loading state.
- Forms: visible labels and native date/time validation. Model failures preserve user progress and show a labeled offline fallback.
- Alarm editor: native dialog with focus containment, Escape dismissal, and focus return.
- Motion: no decorative ambient motion. Only genuine live-state feedback. Reduced motion uses instant transcript scrolling.
- Icons: Lucide with a consistent 1.65 stroke on a 24px design grid, small functional roles; no illustrated mascot or stock imagery.

## Accessibility and verification

Token contrast measured: foreground/surface 15.77:1; muted/surface 8.11:1; muted/raised 6.91:1; accent/background 11.29:1; primary button 10.08:1; user message 9.60:1; input boundary/surface 4.00:1. Each exceeds its AA threshold.

Verification notes are recorded in `VERIFICATION.md`. Real iPhone delivery, VoiceOver, and a full axe audit are separate checks; do not claim them from a web or simulator compile.

## Audit

2026-11-15: design pass applied using SvaraNova frontend-ui and samber frontend-design-deslop. Removed the oversized two-tone hero, decorative radial glow, diffuse card shadow, tiny badge text, and identical metric tiles. Replaced system-primary typography with bundled display/body fonts. Preserved the requested familiar alarm controls. The literal sound stack gives the underlying alarm screen its own structure.

Self-audit: 8/10 for prototype fit. Remaining limitations: fixed dark appearance, prototype notification behavior, no screen-reader or physical-device audit. These are recorded rather than inferred as passing.

## Changelog

2026-11-15: established a durable design system and applied both requested skills to onboarding, negotiation, tasks, and metrics.

Voice mode uses a warm amber orb consistent with Duvet's existing palette. Slow internal movement indicates readiness; a breathing outline indicates listening; faster internal movement indicates speaking. State labels provide the same information without animation. Reduced motion disables orb animation. Tap interrupts or submits; ending voice is always available.

## Snooze Department redesign — 2026-11-15

Approved direction: a late-night control room whose job is keeping you in bed. This supersedes the earlier wide-layout and transcript-first guidance above; existing clock behavior, font assets, dark appearance and PG-13 boundaries remain.

- Primary object: next enabled alarm, using oversized Barlow Condensed tabular numerals on a graphite panel with an amber top rule. Primary action: the solid amber Add Alarm control.
- Alarm rows remain a continuous list, with an amber edge and labeled switch state when enabled. Inactive time numerals use muted steel.
- Wide screens use alarm content plus a narrower Duvet standby panel. On mobile the alarm schedule stays first and the companion becomes a compact secondary practice entry.
- Palette: graphite #191A1B, chalk #F4F1E9, amber #FFAA52. Muted text is #AAAEB2 to retain readable contrast. Updated shared token values and layout rules live in src/snooze.css, loaded after the existing styles.
- Voice entry precedes the transcript. Active voice mode centers the orb, puts state labels and interruption controls with it, and keeps transcript space secondary. Emergency stop and mute stay available.
- Motion: short control compression, enabled-row color transitions, a subtle entrance, and the existing voice-state orb. Reduced motion disables animation.
- No generated images, additional fonts, UI libraries or business logic dependencies.
- Independent screenshot review: 8/10. Retained alarm-first hierarchy; addressed mobile practice-entry clipping, profile truncation and competing primary-action emphasis. Real microphone and physical-device accessibility remain outside this visual redesign's verification.
