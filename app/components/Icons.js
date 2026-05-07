// app/components/Icons.js
'use client';

const PATHS = {
  'i-career': 'M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6',
  'i-finance': 'M3 17l6-6 4 4 8-8M14 7h7v7',
  'i-research': null, // uso <circle>
  'i-teaching': 'M4 6h16v12H4zM4 6l8 6 8-6',
  'i-clinical': null,
  'i-legal': 'M12 3v18M5 8l7-5 7 5M3 21h18M7 8l-4 8h8L7 8zm10 0l-4 8h8l-4-8z',
  'i-plan': 'M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z',
  'i-marketing': 'M3 11l18-8-5 18-4-8-9-2z',
  'i-results': 'M3 3v18h18M7 14l4-4 4 4 6-6',
  'i-ai': 'M12 2a4 4 0 014 4v2a4 4 0 01-4 4 4 4 0 01-4-4V6a4 4 0 014-4zM6 20v-2a4 4 0 014-4h4a4 4 0 014 4v2',
  'i-code': 'M8 6l-6 6 6 6M16 6l6 6-6 6M14 4l-4 16',
  'i-book': 'M4 19.5A2.5 2.5 0 016.5 17H20V2H6.5A2.5 2.5 0 004 4.5v15zM4 19.5V22h16',
  'i-paper': 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M8 13h8M8 17h5',
  'i-prompt': 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z',
  'i-board': 'M3 18h18M5 18l2-9 5 4 5-4 2 9',
};

export function Icon({ name, size = 22, color }) {
  const style = color ? { color } : undefined;

  if (name === 'i-research') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={style}>
        <circle cx="11" cy="11" r="6" />
        <path d="M15 15l5 5" />
      </svg>
    );
  }
  if (name === 'i-clinical') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={style}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 2v20M2 12h20" />
      </svg>
    );
  }
  if (name === 'i-oncology') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={style}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      </svg>
    );
  }

  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={path} />
    </svg>
  );
}

// ícones inline menores (arrow, etc)
export function ArrowRight({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
export function ArrowUpRight({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 17L17 7M7 7h10v10" />
    </svg>
  );
}
export function ArrowLeft({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
export function InfoIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
export function CloseIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
export function ChatIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
    </svg>
  );
}
