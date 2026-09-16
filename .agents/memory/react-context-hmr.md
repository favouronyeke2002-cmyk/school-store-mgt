---
name: React context HMR flicker
description: "useAuth must be used within AuthProvider" on hot reload is a transient Vite HMR artefact, not a real bug.
---

When Vite invalidates AuthContext.tsx or ShiftContext.tsx during HMR, there is a brief window where the new context module is loaded but the old provider wrapping AppContent hasn't re-rendered yet. This triggers "useAuth must be used within AuthProvider" in the browser console.

**Why:** These context files export both a provider and a hook in the same file, which Vite cannot Fast Refresh (it says "default export is incompatible"). A full module replacement is issued, causing the transient mismatch.

**How to apply:** Ignore this error in browser logs during development. It self-resolves within 1–2 seconds. It does NOT indicate a production bug. Only investigate if it persists after the page fully settles.
