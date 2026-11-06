interface IconProps { name: 'arrow' | 'upload' | 'ticket' | 'sound' | 'muted' | 'close' | 'check' | 'spark' | 'download' | 'again' | 'printer'; size?: number }

export function Icon({ name, size = 20 }: IconProps) {
  const paths = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" /></>,
    ticket: <><path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Z" /><path d="M15 5v2m0 3v2m0 3v2m0 1v1" /></>,
    sound: <><path d="m11 5-5 4H3v6h3l5 4V5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    muted: <><path d="m11 5-5 4H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    spark: <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z" /></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4" /></>,
    again: <><path d="M3 10a9 9 0 1 1 1.8 8.4M3 4v6h6" /></>,
    printer: <><path d="M7 8V3h10v5M7 17H4V8h16v9h-3M7 14h10v7H7z" /><path d="M16 11h1" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
