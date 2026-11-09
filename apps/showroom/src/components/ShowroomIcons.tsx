import type { ReactNode } from "react";

function Svg({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconPalette() {
  return (
    <Svg>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.5 0 2-1 2-2 0-.8-.5-1.2-.5-2 0-1 1-1.5 2-1.5H17c1.9 0 3.5-1.6 3.5-3.5S16.6 3.5 12 3.5Z" />
      <circle cx="7.5" cy="10.5" r="1" />
      <circle cx="10" cy="7" r="1" />
      <circle cx="14" cy="7" r="1" />
      <circle cx="16.5" cy="10.5" r="1" />
    </Svg>
  );
}

export function IconBolt() {
  return (
    <Svg>
      <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z" />
    </Svg>
  );
}

export function IconWrench() {
  return (
    <Svg>
      <path d="M14.5 6.5a4 4 0 0 0-5.1 4.8L4 16.6a1.9 1.9 0 0 0 2.7 2.7l5.3-5.4a4 4 0 0 0 4.8-5.1l-2.4 2.4-2-2 2.1-2.7Z" />
    </Svg>
  );
}

export function IconRocket() {
  return (
    <Svg>
      <path d="M12 15c-1.5-2-2.5-4.5-2-7 1.5-3 4-4.5 6-5 .5 2-.5 4.5-2 6 1 1.5 1 3.5 0 5l-2 1Z" />
      <path d="M10 11.5c-2.5.5-4 2-4.5 4.5 2 .5 4.5-1 5-3.5M12 15l-3 3c-.5 2 .5 3.5 2 4 .5-2 0-3.5 1-5" />
      <circle cx="14.8" cy="7.2" r="1.1" />
    </Svg>
  );
}

export function IconShield() {
  return (
    <Svg>
      <path d="M12 3.5 5 6v5.4c0 4.3 3 7.4 7 9.1 4-1.7 7-4.8 7-9.1V6l-7-2.5Z" />
      <path d="m9 11.7 2.2 2.2 3.9-4.1" />
    </Svg>
  );
}

export function IconUsers() {
  return (
    <Svg>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.5-3 2.8-4.5 5.5-4.5s5 1.5 5.5 4.5" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 5.2M17.5 15.3c1.7.5 2.7 1.9 3 4.2" />
    </Svg>
  );
}

export function IconSun() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  );
}

export function IconMoon() {
  return (
    <Svg>
      <path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z" />
    </Svg>
  );
}

export function IconChevronDown() {
  return (
    <Svg size={16}>
      <path d="m7 9.5 5 5 5-5" />
    </Svg>
  );
}

export function IconStore() {
  return (
    <Svg>
      <path d="M4 9.5V20h16V9.5" />
      <path d="M3 4h18l-1.5 5.5a3 3 0 0 1-4.5 1.8 3 3 0 0 1-6 0 3 3 0 0 1-4.5-1.8L3 4Z" />
      <path d="M9 20v-5h6v5" />
    </Svg>
  );
}

export function IconUser() {
  return (
    <Svg>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.6-4 3.3-6 7-6s6.4 2 7 6" />
    </Svg>
  );
}

export function IconCard() {
  return (
    <Svg>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </Svg>
  );
}

export function IconLogout() {
  return (
    <Svg>
      <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
    </Svg>
  );
}

export function IconExternalLink() {
  return (
    <Svg size={16}>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
    </Svg>
  );
}

export function IconTag() {
  return (
    <Svg>
      <path d="M20 13 13 20 4 11V4h7l9 9Z" />
      <circle cx="8.5" cy="8.5" r="1.2" />
    </Svg>
  );
}

export function RetailIcon({ type, size = 24 }: { type?: string; size?: number }) {
  switch (type) {
    case "clothing":
      return <Svg size={size}><path d="m8 4-4 2.5 2 4L8 9v11h8V9l2 1.5 2-4L16 4c-.6 1.3-2 2-4 2S8.6 5.3 8 4Z" /></Svg>;
    case "electronics":
      return <Svg size={size}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Svg>;
    case "food":
      return <Svg size={size}><path d="M4 9h16l-1.5 11h-13L4 9Z" /><path d="m8 9 4-6 4 6M8 13v3M12 13v3M16 13v3" /></Svg>;
    case "jewelry":
      return <Svg size={size}><path d="m7 4-4 6 9 10 9-10-4-6H7Z" /><path d="m3 10 9 2 9-2M7 4l5 8 5-8" /></Svg>;
    case "cosmetics":
      return <Svg size={size}><path d="M9 3h6v5H9zM8 8h8l1 12H7L8 8Z" /><path d="M10 12h4" /></Svg>;
    case "furniture":
      return <Svg size={size}><path d="M5 12V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4" /><path d="M3 11v8h18v-8a2 2 0 0 0-2-2M5 9a2 2 0 0 0-2 2M6 19v2M18 19v2" /></Svg>;
    case "books":
      return <Svg size={size}><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23V5.5Z" /><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23V5.5Z" /></Svg>;
    case "art":
      return <Svg size={size}><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.5 0 2-1 2-2 0-.8-.5-1.2-.5-2 0-1 1-1.5 2-1.5H17c1.9 0 3.5-1.6 3.5-3.5S16.6 3.5 12 3.5Z" /><circle cx="7.5" cy="10.5" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="14" cy="7" r="1" /></Svg>;
    case "hardware":
      return <Svg size={size}><path d="M14.5 6.5a4 4 0 0 0-5.1 4.8L4 16.6a1.9 1.9 0 0 0 2.7 2.7l5.3-5.4a4 4 0 0 0 4.8-5.1l-2.4 2.4-2-2 2.1-2.7Z" /></Svg>;
    default:
      return <Svg size={size}><path d="M4 9.5V20h16V9.5" /><path d="M3 4h18l-1.5 5.5a3 3 0 0 1-4.5 1.8 3 3 0 0 1-6 0 3 3 0 0 1-4.5-1.8L3 4Z" /><path d="M9 20v-5h6v5" /></Svg>;
  }
}
