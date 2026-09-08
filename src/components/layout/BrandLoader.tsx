"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MDC_LOGO_URL, MDC_TRUCK_URL } from "@/lib/brand";

function isInternalNavigation(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const target = event.target as Element | null;
  const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.hasAttribute("download")) return false;
  if (anchor.target && anchor.target.toLowerCase() !== "_self") return false;
  const raw = String(anchor.getAttribute("href") || "").trim();
  if (!raw || raw.startsWith("#") || /^(?:mailto:|tel:|sms:|javascript:)/i.test(raw)) return false;
  try {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return false;
    return true;
  } catch {
    return false;
  }
}

export default function BrandLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [cycle, setCycle] = useState(0);
  const firstPath = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideAfter = useCallback((ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), ms);
  }, []);

  const show = useCallback((ms: number) => {
    setCycle((value) => value + 1);
    setVisible(true);
    hideAfter(ms);
  }, [hideAfter]);

  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      hideAfter(1150);
      return;
    }
    show(560);
  }, [pathname, hideAfter, show]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!isInternalNavigation(event)) return;
      /* No frenamos Next.js: solo cubrimos la transición mientras navega. */
      show(1500);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [show]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!visible) return null;

  return (
    <div className="mdc-admin-loader" role="status" aria-live="polite" aria-label="Cargando MDC Ferretería">
      <div className="mdc-admin-loader-glow" aria-hidden="true" />
      <div className="mdc-admin-loader-inner" key={cycle}>
        <img className="mdc-admin-loader-logo" src={MDC_LOGO_URL} alt="MDC Ferretería" />
        <div className="mdc-admin-loader-stage" aria-hidden="true">
          <div className="mdc-admin-loader-track">
            <div className="mdc-admin-loader-progress" />
          </div>
          <div className="mdc-admin-loader-truck">
            <img src={MDC_TRUCK_URL} alt="" />
          </div>
        </div>
        <strong>MDC Ferretería</strong>
        <span>Preparando sistema de gestión</span>
        <small>Linares · Región del Maule</small>
      </div>
    </div>
  );
}
