'use client';

import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';

declare global {
  interface Window { Tawk_API?: { hideWidget?: () => void; showWidget?: () => void; maximize?: () => void; onBeforeLoad?: () => void; onLoad?: () => void; onChatMaximized?: () => void; onChatMinimized?: () => void; onChatEnded?: () => void }; Tawk_LoadStart?: Date }
}

// Floating WhatsApp button, and an optional Tawk.to live chat (only when the owner added valid IDs).
export default function FloatChat({ number, message, tawk, preview }: { number: string; message: string; tawk: string; preview?: boolean }) {
  const [open, setOpen] = useState(false);
  const live = !!tawk && !preview;

  useEffect(() => {
    if (!live || document.getElementById('tawk-script')) return;
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();
    const api = window.Tawk_API;
    api.onBeforeLoad = () => window.Tawk_API?.hideWidget?.();
    api.onLoad = () => window.Tawk_API?.hideWidget?.();
    api.onChatMaximized = () => setOpen(true);
    api.onChatMinimized = () => { setOpen(false); window.Tawk_API?.hideWidget?.(); };
    api.onChatEnded = () => { setOpen(false); window.Tawk_API?.hideWidget?.(); };
    const el = document.createElement('script');
    el.id = 'tawk-script'; el.async = true; el.src = `https://embed.tawk.to/${tawk}`; el.charset = 'UTF-8'; el.setAttribute('crossorigin', '*');
    document.body.appendChild(el);
  }, [live, tawk]);

  const link = number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : '';
  const bottom = 'calc(1rem + env(safe-area-inset-bottom, 0px))';
  const openChat = () => { window.Tawk_API?.showWidget?.(); window.Tawk_API?.maximize?.(); };
  if (!link && !live) return null;
  return (
    <>
      {live && (
        <button onClick={openChat} aria-label="Live chat" style={{ bottom }} className={`fixed left-4 z-50 flex items-center gap-2.5 rounded-full bg-neutral-100 px-5 py-3 text-base font-medium text-neutral-900 shadow-lg transition hover:bg-white ${open ? 'pointer-events-none opacity-0' : ''}`}>
          <MessageCircle className="h-6 w-6" /> Live Chat
        </button>
      )}
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" style={{ bottom }} className="fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105">
          <MessageCircle className="h-7 w-7" />
        </a>
      )}
    </>
  );
}
