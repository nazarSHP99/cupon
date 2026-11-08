interface IconProps { name: 'upload' | 'ticket' | 'sound' | 'muted' | 'download' | 'again' | 'insert' | 'mouse' | 'left' | 'right'; size?: number }

export function Icon({ name, size = 20 }: IconProps) {
  const paths = {
    mouse: <><rect x="6" y="2.5" width="12" height="19" rx="6" /><path className="mouse-wheel" d="M12 6v4" /></>,
    left: <path d="M20 12H4m6-6-6 6 6 6" />,
    right: <path d="M4 12h16m-6-6 6 6-6 6" />,
    insert: <path d="M12 3v11m-4-4 4 4 4-4M4 16h16v5H4z" />,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" /></>,
    ticket: <><path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Z" /><path d="M15 5v2m0 3v2m0 3v2m0 1v1" /></>,
    sound: <><path d="m11 5-5 4H3v6h3l5 4V5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    muted: <><path d="m11 5-5 4H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6" /></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4" /></>,
    again: <><path d="M3 10a9 9 0 1 1 1.8 8.4M3 4v6h6" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
