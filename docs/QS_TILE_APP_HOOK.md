# Wiring the Quick Settings tile into `App.tsx`

Do **not** replace all of `App.tsx`. Add the following in the existing
root component (the one that owns `view` / `setViewState`).

## 1. Import

```ts
import { consumeNativeOpenView } from "./lockscreen/openViewFromNative";
```

## 2. After DB is ready (same place you call `startLockScreenSync`)

```ts
useEffect(() => {
  if (!dbReady) return;
  const open = consumeNativeOpenView();
  if (open) setViewState(open);
}, [dbReady]);
```

Also re-check on resume (tile tap while the app was backgrounded):

```ts
useEffect(() => {
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    const open = consumeNativeOpenView();
    if (open) setViewState(open);
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}, []);
```

`consumeNativeOpenView` clears the pending key, so a normal resume
without a tile tap is a no-op.
