# @bitcode/ui-schema

Standalone UI schema definitions — domain-agnostic, framework-neutral types for schema-driven UI.

**Write a JSON schema. Render on any platform.**

## What is this?

`@bitcode/ui-schema` is the **canonical source** for UI schema types shared across all renderers:

- `@bitcode/ui` (React, Vue, React Native via Mitosis)
- `@bitcode/ui-flutter` (Dart port, Phase 5a)
- BitCode engine (optional domain → UiSchema mapping)
- Any standalone consumer (JsonForms-style usage)

It is **not a runtime** and **not a renderer**. It is type definitions + a pure reactive store. The renderer (per-platform) consumes these types and produces actual UI.

## What's inside

| Module | Contents |
|---|---|
| `types.ts` | Core types: `BcChangeMeta`, `BcEventSource`, `DataSource`, `BcKey`, `BcSelection`, field events, component sizes/variants |
| `reactive/types.ts` | `Reaction`, `Effect`, `Evaluator`, `Snapshot`, `FieldMeta`, `ValidationRule`, `ReactiveScopeLike` |
| `reactive/store.ts` | `ReactiveStore` class — headless reactive engine (pure TS, no DOM) |
| `schema/types.ts` | `UiSchema`, `FieldNode`, `FieldType`, `UiAction`, `BcRendererProps` |
| `schema/resolver.ts` | `FieldResolver` interface + `resolveField` / `resolveFieldType` / `resolveFields` pure functions + `defaultFieldResolver` |

## Usage

### As type definitions only

```typescript
import type { UiSchema } from '@bitcode/ui-schema';

const contactForm: UiSchema = {
  type: 'form',
  title: 'Contact',
  fields: [
    { name: 'email', type: 'email', label: 'Email' },
    { name: 'phone', type: 'tel', label: 'Phone' },
  ],
  actions: [{ name: 'submit', submit: true }],
};
```

### As reactive store (standalone, no framework)

```typescript
import { ReactiveStore } from '@bitcode/ui-schema';

const store = new ReactiveStore({
  initialValues: { qty: 2, price: 100 },
  reactions: [
    { when: ['qty', 'price'], target: 'total', effect: { kind: 'value', value: { expr: (s) => s.qty * s.price } } },
  ],
});

store.subscribe((snapshot) => console.log(snapshot));
store.set('qty', 5); // → { qty: 5, price: 100, total: 500, ... }
```

## Relationship to other packages

```
@bitcode/ui-schema  ← types + reactive store (this package, pure TS)
       ↑
       ├── @bitcode/ui         ← React/Vue/RN renderer (Mitosis)
       ├── @bitcode/ui-flutter  ← Flutter renderer (Dart port)
       └── BitCode engine       ← domain → UiSchema mapping (optional)
```

`@bitcode/ui-schema` has **zero dependency** on `@bitcode/ui`, BitCode engine, or any framework. It is a peer to `go-json` — not a child of it. `go-json` can be used as a string-expression evaluator (via the `Evaluator` interface), but it is optional.

## License

MIT
