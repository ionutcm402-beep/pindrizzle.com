# Ping Design System — v1

Status: active visual-rebuild baseline.

## Product feeling

Ping should feel like a premium local utility: calm, immediate, trustworthy and unusually polished. The quality target is native-app discipline, not imitation of any existing product.

## Principles

1. Content first — local information is the visual hero.
2. Calm hierarchy — fewer boxes, badges, shadows and competing accents.
3. One Ping accent — green is identity and action, not decoration.
4. Typography carries hierarchy — avoid decorative UI when type and spacing can explain the structure.
5. Motion explains state — short, restrained transitions only.
6. Location is trustworthy — blue is reserved for location/navigation context; red is reserved for genuine urgency.
7. Icons are consistent — interface controls use one line-icon language, not platform-dependent emoji.
8. Mobile first — every primary interaction must feel natural at one-handed phone width before desktop framing is considered.
9. Accessibility is part of the aesthetic — focus, contrast, zoom, target size and reduced motion remain first-class requirements.
10. Working product logic stays untouched by visual migration unless a UX change is explicitly planned and tested.

## Core tokens

### Colour
- Canvas: `#F4F5F2`
- Surface: `#FFFFFF`
- Soft surface: `#F7F8F5`
- Primary ink: `#101311`
- Secondary ink: `#343936`
- Muted text: `#727873`
- Soft muted text: `#969B97`
- Divider: `rgba(16,19,17,.09)`
- Ping green: `#46D66F`
- Ping green ink: `#0E351B`
- Location blue: `#3C83F6`
- Urgent red: `#E8554F`

### Spacing
Use the shared rhythm only unless a component has a documented optical exception:
`4 / 8 / 12 / 16 / 24 / 32 / 40 / 48`

### Radius
- Small: 10px
- Control: 14px
- Card: 20px
- Sheet: 28px
- Pill/circle: full radius

### Elevation
Normal content cards do not use visible shadows. Elevation is reserved for actual layers: modal sheets, transient menus, floating map content and desktop app framing.

### Typography
Use the native system UI stack. Aim for six meaningful hierarchy levels rather than unique sizes for each component. Display/title weights are strong but not ultra-black; metadata is readable and deliberately quiet.

## Feed reference rules

The Feed is the reference screen for the rest of Ping.

- No dark marketing-style hero card.
- Live state is a quiet status treatment.
- Category uses a small semantic colour marker rather than emoji decoration.
- Ping cards are flat white surfaces with a subtle border.
- Title/body/location/time/interaction hierarchy must be visible without heavy separators.
- Photos sit naturally inside content with one consistent media radius.
- Actions are lightweight; confirming a Ping should not visually overpower the Ping itself.
- Bottom navigation is application chrome, not a floating pill.
- The central Create Ping action remains distinctive but restrained.

## Migration order

1. Foundation tokens + app shell.
2. Feed + bottom navigation.
3. Ping detail + composer.
4. Map.
5. Search.
6. Alerts + notifications.
7. You/profile/settings.
8. Business/promote.
9. Auth/onboarding/install.
10. Moderator/internal screens.
11. Full device visual QA + interaction polish.
12. Dark mode only after the light system is stable.

## Quality gate

Every migrated screen must pass:
- Clarity: primary purpose understood within roughly two seconds.
- Hierarchy: first, second and third visual priorities are obvious.
- Consistency: typography, spacing, controls and icons feel like one product.
- Restraint: nothing decorative remains without a job.
- Accessibility: keyboard, touch, zoom, contrast and reduced motion remain correct.
- Functionality: existing data, safety and payment behavior is unchanged unless explicitly included in scope.
