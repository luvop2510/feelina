# Feelina design system

## Product thesis
A calm trade desk for an intimate-apparel brand. The defining element is a spacious, editable size matrix that carries the retailer's familiar paper order into a precise digital workflow. Navigation and buttons remain conventional; brand identity lives in a restrained plum, a quiet wordmark, and precise typography.

## Scope and references
Web application: Apple foundations apply; macOS menu bars and native iOS tab conventions do not. Consulted Apple HIG references: accessibility, layout, typography, color, designing-for-macos, buttons, entering-data, lists-and-tables and cross-platform. `entering-data.md › Best practices`: “When possible, offer choices instead of requiring text entry.” Products come from a searchable catalogue. `lists-and-tables.md › Content`: “Use descriptive column headings in a multicolumn table.” Explicit size headings and semantic tables preserve meaning.

UI/UX Pro Max searches for wholesale apparel order management and wholesale inventory dashboard returned useful flat functional styles but marketing page structures unrelated to order entry. Those structures were rejected, not persisted as recommendations. React controlled-form guidance applies. This bespoke system replaces generic industrial slate with a muted plum tied to the product's intimate-apparel identity; that brand choice is design judgment.

## Semantic tokens
| Token | Light | Dark | Role |
|---|---|---|---|
| canvas | #F6F5F7 | #19161C | Workspace background |
| surface | #FFFFFF | #241F28 | Tables, panels, inputs |
| ink | #27212A | #F4EFF5 | Primary content |
| muted | #655D68 | #C0B5C5 | Secondary text |
| accent | #713B64 | #DBADD0 | Primary actions and selection |
| danger | #A52B39 | #FFB1BA | Errors, with explanatory text |

Dark accent buttons use #241F28 text. Light accent uses white text. Verify contrast by executable token test; dividers are decorative, while inputs and focus indicators require stronger boundaries. Status chips always contain words.

## Type and spacing
System sans stack for UI and data; a Georgia serif wordmark only. Body 16px/1.5, table text 14px/1.5, metadata no smaller than 12px. Headings 24/32/40px; use 500–650 weight instead of excessive bold. Tabular figures for amounts and quantities. Spacing 4,8,12,16,24,32,48px. Controls ≥44 CSS px; compact matrix entries may use 40px minimum with clear spacing and native keyboard entry. Radius 8px controls, 12px panels. No ornamental gradients or blur.

## Layout
A persistent desktop sidebar surrounds a single main workspace; compact screens use a toggleable navigation panel and a horizontally scrollable matrix within the page, never global horizontal overflow.

Regular:
```
| Feelina     | Context / account                  |
| Overview    | Page title             Primary CTA |
| Orders      | Summary / filters                  |
| Catalogue   | Content table / size matrix        |
| Customers   | Details                 Totals     |
| Inventory   |                                    |
```
Compact:
```
| Menu  Feelina                Account |
| Page title                          |
| Primary action                      |
| Filters                             |
| < size matrix scrolls internally >  |
| Totals                              |
```

## Components and states
Use native labels, inputs, selects, buttons and tables. One primary action per screen. Search before catalogue selection; no manual product names on orders. Inline errors retain entered values. Native dialogs or equivalent trap focus, close on Escape and restore trigger focus. Async buttons prevent duplicate submissions; error messages include recovery. Empty states explain how to populate real records. Read-only sample data is prominently labelled and never persisted.

## Print
A4 portrait with small consistent margins, repeated matrix header, no navigation/actions. Exact size column order from brief. Brand header, ORDER FORM, company verification state, customer snapshot, terms, due date, totals and signatory. Tax invoice is a separate gated record. Numeric columns remain aligned. Multi-page row breaks avoided where possible.

## Motion and accessibility
Only brief color/opacity feedback, 120–180ms. No entrance choreography: staff repeat these tasks all day. Respect prefers-reduced-motion, prefers-contrast, prefers-color-scheme and 200% zoom. No glass layer, so reduced transparency remains opaque. Visible 3px focus ring, skip link, semantic heading order, contextual labels on size inputs. Verify at 375px, landscape, tablet and desktop.

## Design self-critique
A generic landing hero was removed because it delays order entry and communicates no operational information. No decorative charts without real data, fake growth percentages, customer avatars or testimonial copy. The matrix earns the visual emphasis; other elements stay quiet.
