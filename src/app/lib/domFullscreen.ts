const PSEUDO_CLASS = "vcc-tour-pseudo-fullscreen";

function getFullscreenElement(): Element | null {
  const d = document as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return (
    document.fullscreenElement ||
    d.webkitFullscreenElement ||
    d.mozFullScreenElement ||
    d.msFullscreenElement ||
    null
  );
}

/**
 * Uses the Fullscreen API with vendor prefixes. Returns whether the promise resolved.
 */
export async function requestElementFullscreen(el: HTMLElement): Promise<boolean> {
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    webkitRequestFullScreen?: () => Promise<void> | void;
    mozRequestFullScreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };
  const tryCall = async (
    fn: (() => Promise<void> | void) | undefined
  ): Promise<boolean> => {
    if (!fn) return false;
    try {
      await Promise.resolve(fn());
      return true;
    } catch {
      return false;
    }
  };

  if (await tryCall(anyEl.requestFullscreen?.bind(anyEl))) return true;
  if (await tryCall(anyEl.webkitRequestFullscreen?.bind(anyEl))) return true;
  if (await tryCall(anyEl.webkitRequestFullScreen?.bind(anyEl))) return true;
  if (await tryCall(anyEl.mozRequestFullScreen?.bind(anyEl))) return true;
  if (await tryCall(anyEl.msRequestFullscreen?.bind(anyEl))) return true;

  return false;
}

export async function exitDocumentFullscreen(): Promise<void> {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    mozCancelFullScreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
  };

  try {
    if (!getFullscreenElement()) return;
    const tryCall = async (fn: (() => Promise<void> | void) | undefined) => {
      if (!fn) return;
      await Promise.resolve(fn());
    };

    await tryCall(doc.exitFullscreen?.bind(doc));
    if (getFullscreenElement()) await tryCall(doc.webkitExitFullscreen?.bind(doc));
    if (getFullscreenElement()) await tryCall(doc.mozCancelFullScreen?.bind(doc));
    if (getFullscreenElement()) await tryCall(doc.msExitFullscreen?.bind(doc));
  } catch {
    // ignore — user/browser may deny or already exited
  }
}

export function isPseudoFullscreen(el: HTMLElement): boolean {
  return el.classList.contains(PSEUDO_CLASS);
}

/** CSS fallback when Fullscreen API is unavailable or rejects (still covers viewport). */
export function enterPseudoFullscreen(el: HTMLElement): void {
  el.classList.add(PSEUDO_CLASS);
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

export function exitPseudoFullscreen(el: HTMLElement): void {
  el.classList.remove(PSEUDO_CLASS);
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

export function isDomFullscreen(el: HTMLElement): boolean {
  return !!el && getFullscreenElement() === el;
}

export function isTourImmersive(el: HTMLElement): boolean {
  return isDomFullscreen(el) || isPseudoFullscreen(el);
}

/**
 * Toggle immersive mode: prefers native fullscreen, falls back to fixed-viewport pseudo mode.
 */
export async function toggleTourImmersive(
  containerEl: HTMLElement,
  onViewportChange?: () => void
): Promise<void> {
  if (isTourImmersive(containerEl)) {
    await exitDocumentFullscreen();
    exitPseudoFullscreen(containerEl);
    onViewportChange?.();
    return;
  }

  const ok = await requestElementFullscreen(containerEl);
  if (!ok) enterPseudoFullscreen(containerEl);

  requestAnimationFrame(() => onViewportChange?.());
}
