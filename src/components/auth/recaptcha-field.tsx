"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    grecaptcha?: { getResponse: () => string; render: (el: HTMLElement, opts: { sitekey: string }) => void };
  }
}

export function RecaptchaField({ siteKey }: { siteKey: string }) {
  useEffect(() => {
    if (!siteKey) return;
    const id = "recaptcha-script";
    if (!document.getElementById(id)) {
      const script = document.createElement("script");
      script.id = id;
      script.src = "https://www.google.com/recaptcha/api.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, [siteKey]);

  if (!siteKey) return null;
  return <div className="g-recaptcha" data-sitekey={siteKey} />;
}

export function readRecaptchaToken(): string {
  return window.grecaptcha?.getResponse() ?? "";
}
