# MOTION_SYSTEM.md — Motion Architecture & Performance Specification

**Product:** EPL Tactical Intelligence
**Libraries:** `motion/react` (v12), React Three Fiber / Three.js (`useFrame`), Web Animations API (WAAPI), and a custom single-RAF Rellax-style GPU scroll parallax engine (`ParallaxLayer`).

---

## 1. Layered Motion Architecture

### A. Shared-Element & Spatial Navigation (`motion/react`)
- **Root Reduced-Motion Policy:** `<MotionConfig reducedMotion="user">` wraps the entire `<HashRouter>` tree in `/src/App.tsx`.
- **Route Continuity:** `AnimatedRoutes` uses `<AnimatePresence mode="wait">` with crisp GPU `opacity` + `translateY` page enters/exits (`220ms`, cubic-bezier `[0.16, 1, 0.3, 1]`).
- **Shared-Element Pill Indicators (`layoutId`):**
  - Desktop nav active tab highlights morph smoothly across links via `<motion.span layoutId="desktop-nav-pill">` (`spring`, `stiffness: 420, damping: 34`).
  - Mobile nav active tab highlights share `<motion.span layoutId="mobile-nav-pill">`.
  - Inspired by spatial shared-element transitions (`react-native-magic-move` concepts adapted cleanly to native web DOM layout animations without any React Native dependencies).
- **Interactive Overlays:**
  - Hero quick-predictor popovers (`window` and `mode`) and inline prediction banners animate in/out via `<AnimatePresence>` + spring scale/slide transitions.
  - 3D/2D pitch player role and tactical edge inspector drawers animate smoothly via `<AnimatePresence>` + `<motion.div>`.

### B. Lightweight Scroll Parallax Engine (`ParallaxLayer`, Rellax-Inspired)
- Located at `/src/components/common/ParallaxLayer.tsx`.
- **Architecture:** All mounted `ParallaxLayer` nodes register into a module-level `Set<RegisteredLayer>` driven by **one shared passive `scroll`/`resize` listener** and **one coalesced `requestAnimationFrame` pass** (zero per-component scroll listeners, zero React re-renders during scroll).
- **GPU Compositing:** Writes exclusively `translate3d(0, clampedPx, 0)` with pixel-clamped bounds (`maxShift`), automatic mobile attenuation (`0.45x` under `768px`), and instant bypass when `prefers-reduced-motion` is active.
- **No Transform Stacking:** Never attached to elements that already own an inline scroll `transform` (e.g., hero background slide layers use their own unified scroll/pointer transform).

### C. 3D Turning-Spine Shelf & WAAPI Tactical Dossier (`MatchdayShelf3D.tsx`)
- **Single-RAF Spring Physics:** Drives `3×N` wrapped 3D CSS `preserve-3d` cuboid fixtures (`translate3d` + `rotateZ/X/Y`) with pointer-tilt damping, wheel/drag snap, and masked line-swap captions.
- **WAAPI Shared-Rect Expansion:** Clicking an active fixture cover measures its `getBoundingClientRect()` and animates the full-screen Tactical Dossier from `inset(...) rotate(-4.2deg)` to `inset(0) rotate(0deg)` over `920ms` (`cubic-bezier(.76, 0, .18, 1)`).
- **SVG Ink-Blot Poster Reveal:** 7 displaced SVG `<circle>` masks filtered through `feTurbulence` + `feDisplacementMap` reveal the vertical matchday chalk poster organically.

### D. 3D WebGL Tactical Theatre (`TacticalTheatre3D.tsx`)
- **Frame-Rate Independent Damping:** Player tokens (`CompositePlayerToken`) and camera presets (`CameraRig`) use `THREE.MathUtils.damp(..., Math.min(0.05, delta))` inside `useFrame` so formation morphs remain smooth across 60Hz and 120Hz displays with zero per-frame allocations (`_vA`, `_vB`, `_vTarget` scratch vectors).
- **Live Ball Progression:** Faceted icosahedron ball particles traverse quadratic Bézier passing arcs smoothly along `curve.getPointAt()`.

---

## 2. Performance & Accessibility Guardrails

1. **Zero Custom Cursor Overhead:** Native OS cursor only; no `mousemove` cursor loops.
2. **Reduced Motion Honor:** `prefers-reduced-motion: reduce` disables CSS keyframes, collapses WAAPI/ink-reveal timers to `1ms`, disables `ParallaxLayer` transforms, and defaults `<MotionConfig reducedMotion="user">`.
3. **WebGL Resilience:** Software WebGL caps DPR at `1` and disables heavy MSAA; `webglcontextlost` gracefully promotes `PitchFallback2D` automatically without user intervention.
