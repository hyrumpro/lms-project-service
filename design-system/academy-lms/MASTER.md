# Academy LMS — editorial design system

Source of truth for the Next.js app. These tokens already live in `src/app/globals.css`. Do not invent a second palette, and do not restyle toward the legacy purple Bootstrap theme.

## Personality

Warm paper field, ink typography, Fraunces display headings, Outfit/sans body, coral and sun as accents. One primary action per form. Lucide icons only, never emoji as controls.

## Color tokens

Use semantic classes (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary`, `text-coral`, `bg-sun`, `border-border`, `text-destructive`). Do not put raw hex or oklch values in components.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| background | oklch(0.977 0.013 88) | oklch(0.205 0.012 70) | Page field |
| foreground | oklch(0.28 0.035 258) | oklch(0.94 0.012 88) | Body text |
| card | oklch(0.995 0.007 90) | oklch(0.245 0.014 70) | Raised surfaces |
| primary | oklch(0.51 0.22 291) | oklch(0.62 0.2 291) | Primary buttons |
| coral | oklch(0.58 0.19 36) | oklch(0.7 0.19 36) | Links, active nav, badges |
| sun | oklch(0.79 0.15 62) | oklch(0.82 0.14 92) | Highlight mark, completion |
| muted-foreground | oklch(0.51 0.022 65) | oklch(0.72 0.02 80) | Helper text |
| destructive | oklch(0.577 0.215 27) | oklch(0.68 0.19 25) | Errors and destructive actions |
| radius | 0.5rem | 0.5rem | Cards, inputs, buttons |

Body text must stay at least 4.5:1 against its surface in both themes. Status is never color alone: pair it with a label.

## Type

- Headings: `font-heading` (Fraunces), weight 600, slight negative tracking.
- Body: 16px on inputs (`text-base`), 14px (`text-sm`) for secondary copy, line height relaxed.
- Kickers: `.kicker` — mono, uppercase, wide tracking.
- Prices, counts, and codes: `tabular-nums` or `font-mono`.

## Spacing and layout

8px rhythm. Page shells use `max-w-6xl` or `max-w-7xl` with `px-4`. Section gaps are 24px (`gap-6`). Cards use the shadcn `Card` spacing, not one-off borders.

## Components

Prefer the existing shadcn set in `src/components/ui`: `Button`, `Card`, `Field`, `Input`, `Textarea`, `Switch`, `Table`, `Empty`, `Alert`, `Badge`, `Tabs`.

Shared wrappers:

- `PageIntro` — heading, one description, optional action.
- `SettingsSection` — grouped fields inside a card.
- `CatalogEmpty` — empty state with a next step.

Form inputs in these wrappers are at least 44px tall (`h-11`). Focus rings stay. Decorative icons use `aria-hidden`. Icon-only controls keep an accessible name.

## Motion

No new page-load animation. Respect `prefers-reduced-motion`. State changes use the existing color and opacity transitions.
