---
name: Component scope rule
description: Never define components with useState inside another component's render scope — causes hook identity issues and re-mount loops.
---

In this codebase (CashierPOS.tsx especially), all sub-components must be defined as named function components at module level, BEFORE the main component that uses them.

**Why:** Defining a component inside another component's body causes React to see a new component identity on every render, unmounting and remounting the inner component and losing all its state. Also breaks hooks rules.

**How to apply:** Any new modal, panel, or sub-component that uses its own useState/useEffect must be a named `const Foo: React.FC<...> = (...)` at module scope, placed before the main CashierPOS component declaration. Never inline it inside the JSX or inside another component function body.
