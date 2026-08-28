import type { SVGProps } from "react";

export type PingIconName =
  | "feed" | "map" | "search" | "plus" | "alerts" | "user" | "myPings"
  | "activity" | "following" | "bell" | "location" | "radius"
  | "profile" | "edit" | "install" | "shield" | "legal"
  | "promote" | "beta" | "moderation" | "review" | "signout"
  | "alert" | "traffic" | "lostFound" | "free" | "help" | "local"
  | "deals" | "parking" | "events" | "outages" | "business"
  | "marketplace" | "property" | "vehicle" | "link"
  | "check" | "remove" | "clock" | "replies" | "confirmations" | "chevron" | "more";

type Props = SVGProps<SVGSVGElement> & { name: PingIconName; size?: number };

export default function PingIcon({ name, size = 20, className, ...props }: Props) {
  const common = {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: `pd-icon${className ? ` ${className}` : ""}`,
  };

  let content;
  switch (name) {
    case "feed": content = <><path d="M5 5h14M5 12h14M5 19h9"/><circle cx="3" cy="5" r=".5"/><circle cx="3" cy="12" r=".5"/><circle cx="3" cy="19" r=".5"/></>; break;
    case "myPings": content = <><path d="M5 5h9M5 11h9M5 17h6"/><path d="M19 8c0 3-4 6-4 6s-4-3-4-6a4 4 0 1 1 8 0Z"/><circle cx="15" cy="8" r="1.2"/></>; break;
    case "map": content = <><path d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2Z"/><path d="M8 4v13M16 7v13"/></>; break;
    case "search": content = <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></>; break;
    case "plus": content = <path d="M12 5v14M5 12h14"/>; break;
    case "alerts": case "bell": content = <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>; break;
    case "user": case "profile": content = <><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 3.4-6.5 8-6.5s7.2 2.3 8 6.5"/></>; break;
    case "activity": content = <><path d="M5 6h14M5 12h14M5 18h14"/><circle cx="3" cy="6" r=".5"/><circle cx="3" cy="12" r=".5"/><circle cx="3" cy="18" r=".5"/></>; break;
    case "following": content = <path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z"/>; break;
    case "location": case "local": content = <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>; break;
    case "radius": content = <><circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6"/><path d="M12 2a10 10 0 0 1 10 10M2 12A10 10 0 0 1 12 2M12 22A10 10 0 0 1 2 12"/></>; break;
    case "edit": content = <><path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.5 7.1 2.8 2.8"/></>; break;
    case "install": content = <><path d="M12 3v12M8 11l4 4 4-4"/><path d="M5 19h14"/></>; break;
    case "shield": content = <><path d="M12 3 19 6v5c0 4.7-2.8 8.1-7 10-4.2-1.9-7-5.3-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></>; break;
    case "legal": content = <><path d="M12 3v18M6 6h12M5 6l-3 6h6L5 6ZM19 6l-3 6h6l-3-6Z"/><path d="M7 21h10"/></>; break;
    case "promote": content = <><path d="m5 13 7-7 7 7"/><path d="M12 6v13"/><path d="M5 19h14"/></>; break;
    case "beta": content = <><path d="M9 3h6M10 3v5l-5 9a3 3 0 0 0 2.6 4h8.8A3 3 0 0 0 19 17l-5-9V3"/><path d="M7.5 15h9"/></>; break;
    case "moderation": content = <><path d="M12 3 20 7v5c0 4.5-3 7.6-8 9-5-1.4-8-4.5-8-9V7l8-4Z"/><path d="M9 12h6M12 9v6"/></>; break;
    case "review": content = <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>; break;
    case "signout": content = <><path d="M10 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5"/><path d="m14 8 4 4-4 4M8 12h10"/></>; break;
    case "alert": content = <><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17h.01"/></>; break;
    case "traffic": content = <><path d="M5 18h14l-1.5-7h-11L5 18Z"/><path d="m8 11 1-5h6l1 5M8 18v2M16 18v2"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></>; break;
    case "lostFound": content = <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M8.5 9a2.2 2.2 0 1 1 3.7 1.6c-.9.8-1.7 1.1-1.7 2.4M10.5 15h.01"/></>; break;
    case "free": content = <><rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M3 9h18M7.5 5.5C7.5 3.8 9.5 3 12 9c2.5-6 4.5-5.2 4.5-3.5S14.7 9 12 9c-2.7 0-4.5-1.8-4.5-3.5Z"/></>; break;
    case "help": content = <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 4.2 1.8c-1 .9-1.9 1.3-1.9 2.7M12 17h.01"/></>; break;
    case "deals": content = <><path d="M4 5h8l8 8-7 7-8-8V5Z"/><circle cx="8" cy="9" r="1.2"/><path d="m10 15 5-5M10.2 11.2h.01M14.8 15.8h.01"/></>; break;
    case "parking": content = <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9M9 13h4"/></>; break;
    case "events": content = <><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M7 3v4M17 3v4M3.5 10h17"/><path d="m12 13 .9 1.8 2 .3-1.45 1.4.34 2-1.79-.95-1.79.95.34-2-1.45-1.4 2-.3Z"/></>; break;
    case "outages": content = <><path d="m13 2-7 11h6l-1 9 7-12h-6l1-8Z"/><path d="M3 20h4M17 20h4"/></>; break;
    case "business": content = <><path d="M4 9h16l-1-5H5L4 9Z"/><path d="M5 9v11h14V9M9 20v-6h6v6"/><path d="M4 9c0 2 3 2 4 0 1 2 3 2 4 0 1 2 3 2 4 0 1 2 4 2 4 0"/></>; break;
    case "marketplace": content = <><path d="M4 8.5 12 4l8 4.5v10.5H4V8.5Z"/><path d="M8 19v-6h8v6M3 21h18"/><path d="M7 8h10"/></>; break;
    case "property": content = <><path d="m3 11 9-7 9 7"/><path d="M5.5 9.5V20h13V9.5M9 20v-6h6v6"/></>; break;
    case "vehicle": content = <><path d="M4 15h16l-1.5-6h-13L4 15Z"/><path d="m7 9 1.5-4h7L17 9"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/></>; break;
    case "link": content = <><path d="M10 13a4 4 0 0 0 5.7.1l2.2-2.2a4 4 0 0 0-5.7-5.7L11 6.4"/><path d="M14 11a4 4 0 0 0-5.7-.1l-2.2 2.2a4 4 0 0 0 5.7 5.7l1.2-1.2"/></>; break;
    case "check": content = <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>; break;
    case "remove": content = <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>; break;
    case "clock": content = <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>; break;
    case "replies": content = <path d="M5 5h14v11H9l-4 4V5Z"/>; break;
    case "confirmations": content = <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>; break;
    case "chevron": content = <path d="m9 6 6 6-6 6"/>; break;
    case "more": content = <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>; break;
    default: content = <circle cx="12" cy="12" r="8"/>;
  }

  return <svg {...common} {...props}>{content}</svg>;
}
