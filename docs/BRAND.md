# قيّم / Qayem brand

## Direction and implementation

Retain ink #3b2030, wine #7c3654, bronze #a56332, neutral #f3f4f6 and white #ffffff. IBM Plex Sans Arabic SemiBold provides the Arabic and Latin wordmark outlines; interface body text retains the existing IBM Plex families. The Q symbol frames three assessment strokes, referring to structured evaluation. No generic tick, organizational seal or affiliation imagery.

The built-in imagegen tool generated three concepts. Concept B, a geometric Q with assessment strokes, was selected for its distinct silhouette at small sizes. A was too conversational and C too detailed for navigation. The generated bitmap is an exploration reference only; production uses deterministic SVG geometry and actual font outlines. Arabic قيّم was shaped with HarfBuzz, retaining the shadda and connected glyphs, then converted to vector paths using fontTools. No generated Arabic pixels or external font load is required to render the wordmarks.

Combined lockup: mark beside centered Arabic and English wordmarks, with comparable optical heights and deliberate baseline spacing. Sidebar uses a single-language lockup for readable small sizes; login/workspaces use the bilingual version. Both light and dark variants and the compact Q favicon are included. Evaluation printouts, reports and loading states use the same assets.

## Files

frontend/public/qayem-logo.svg and qayem-logo-white.svg: bilingual.
qayem-logo-ar.svg / qayem-logo-en.svg and their -white variants: locale lockups.
favicon.svg: compact mark. docs/images/brand.svg: review sheet.
IBM-Plex-OFL.txt preserves the font license. Font outlines are derived from the official Google Fonts IBM Plex Sans Arabic distribution.

## Imagegen exploration prompt (abridged)

Use case: logo-brand. Asset type: concept exploration board for Qayem, a bilingual Arabic/English interview and candidate evaluation platform. Create one refined presentation sheet with three distinct vector-friendly symbol concepts: (1) two interlocking dialogue brackets framing a centered assessment bar, (2) a geometric Q with three balanced evaluation strokes, (3) an open interview dossier with an ascending assessment rhythm. Exclude generic approval marks and institutional symbols. Wine #7c3654, deep ink #3b2030 and restrained bronze #a56332 on white. Precise flat geometry, strong 24px silhouette. Label concepts only A, B, C. Do not draw Arabic text; typography will be professionally typeset separately in SVG. Intended final brand words Qayem and قيّم will have equal visual prominence. Plenty of whitespace, professional design studio exploration, no gradients, no mockups, no textures.
