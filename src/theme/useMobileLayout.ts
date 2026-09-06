import { useEffect, useState } from "react";
import { isMobileLandscapeActive, isMobileLayoutActive } from "./mobileLayout";

// React-facing view of html.mobile-layout / html.mobile-landscape.
// ThemeContext owns the class list; this just stays in sync so
// presentation components can swap composition without reading CSS.
export function useMobileLayout(): boolean {
  const [mobile, setMobile] = useState(isMobileLayoutActive);
  useEffect(() => {
    const apply = () => setMobile(isMobileLayoutActive());
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      observer.disconnect();
    };
  }, []);
  return mobile;
}

export function useMobileLandscape(): boolean {
  const [landscape, setLandscape] = useState(isMobileLandscapeActive);
  useEffect(() => {
    const apply = () => setLandscape(isMobileLandscapeActive());
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      observer.disconnect();
    };
  }, []);
  return landscape;
}
