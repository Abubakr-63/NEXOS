import React from "react";

export type IconProps = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Clean vector SVG representations inspired by Google Material and NEXOS multicolor gradient design.
 */

export function DriveIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Google Drive"
    >
      <rect width="48" height="48" rx="12" fill="#ffffff" />
      <path
        d="M17.5 9.5L8.5 25L13.5 33.5L22.5 18L17.5 9.5Z"
        fill="#0F9D58"
      />
      <path
        d="M30.5 9.5H17.5L22.5 18H35.5L30.5 9.5Z"
        fill="#FFBA00"
      />
      <path
        d="M22.5 18L13.5 33.5H29.5L38.5 18H22.5Z"
        fill="#4285F4"
      />
      <path
        d="M30.5 33.5L35.5 25L38.5 30L34.5 37L29.5 33.5Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function DocsIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Google Docs"
    >
      <rect width="48" height="48" rx="12" fill="#ffffff" />
      <path
        d="M14 10C12.8954 10 12 10.8954 12 12V36C12 37.1046 12.8954 38 14 38H34C35.1046 38 36 37.1046 36 36V18L28 10H14Z"
        fill="#4285F4"
      />
      <path d="M28 10L36 18H28V10Z" fill="#A1C2FA" />
      <path
        d="M18 22H30M18 26H30M18 30H25"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MeetIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Google Meet"
    >
      <rect width="48" height="48" rx="12" fill="#ffffff" />
      <rect x="10" y="15" width="18" height="18" rx="4" fill="#00832D" />
      <path d="M24 15H28V24H24V15Z" fill="#00AC47" />
      <path d="M10 28H24V33H14C11.7909 33 10 31.2091 10 29V28Z" fill="#0066DA" />
      <path
        d="M28 20.5L37 14V34L28 27.5V20.5Z"
        fill="#EA4335"
      />
      <path
        d="M28 22L37 15V24L28 22Z"
        fill="#FFBA00"
      />
      <path
        d="M28 26L37 24V33L28 26Z"
        fill="#00AC47"
      />
    </svg>
  );
}

export function GmailIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Gmail"
    >
      <rect width="48" height="48" rx="12" fill="#ffffff" />
      <path
        d="M12 34V18L24 27L36 18V34H30V24L24 28.5L18 24V34H12Z"
        fill="#EA4335"
      />
      <path d="M12 18V15C12 13.8954 12.8954 13 14 13H17L24 18.5L12 27V18Z" fill="#4285F4" />
      <path d="M36 18V15C36 13.8954 35.1046 13 34 13H31L24 18.5L36 27V18Z" fill="#34A853" />
      <path d="M18 24L12 18V34H18V24Z" fill="#4285F4" />
      <path d="M30 24L36 18V34H30V24Z" fill="#34A853" />
      <path d="M18 13.5L24 18L30 13.5H18Z" fill="#FBBC04" />
    </svg>
  );
}

export function GoogleGIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Google"
    >
      <rect width="48" height="48" rx="12" fill="#ffffff" />
      <path
        d="M34.8 24.3C34.8 23.6 34.7 22.9 34.6 22.2H24V26.5H30.1C29.8 28 29 29.2 27.7 30.1V33.1H31.5C33.7 31.1 34.8 28 34.8 24.3Z"
        fill="#4285F4"
      />
      <path
        d="M24 35.3C27 35.3 29.6 34.3 31.5 33.1L27.7 30.1C26.7 30.8 25.5 31.2 24 31.2C21.1 31.2 18.7 29.2 17.8 26.5H13.8V29.6C15.8 33 19.6 35.3 24 35.3Z"
        fill="#34A853"
      />
      <path
        d="M17.8 26.5C17.4 25.1 17.4 23.6 17.8 22.2V19.1H13.8C12.4 22 12.4 25.3 13.8 28.2L17.8 26.5Z"
        fill="#FBBC04"
      />
      <path
        d="M24 17.4C25.6 17.4 27.2 18 28.3 19.1L31.6 15.8C29.5 13.9 26.8 12.8 24 12.8C19.6 12.8 15.8 15.1 13.8 18.5L17.8 21.6C18.7 18.9 21.1 17.4 24 17.4Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function MapsIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Google Maps"
    >
      <rect width="48" height="48" rx="12" fill="#ffffff" />
      <path
        d="M24 10C17.3726 10 12 15.3726 12 22C12 30.5 24 38 24 38C24 38 36 30.5 36 22C36 15.3726 30.6274 10 24 10Z"
        fill="#34A853"
      />
      <path
        d="M24 10C30.6274 10 36 15.3726 36 22C36 26.8 32.5 31.8 27.5 35.8L24 38V22H12C12 15.4 17.4 10 24 10Z"
        fill="#4285F4"
      />
      <path
        d="M24 10C17.3726 10 12 15.3726 12 22C12 25.5 13.7 28.8 16.5 31.8L24 22V10Z"
        fill="#EA4335"
      />
      <path
        d="M16.5 31.8C18.2 33.7 20.5 35.7 24 38L24 22L16.5 31.8Z"
        fill="#FBBC04"
      />
      <circle cx="24" cy="21" r="5" fill="#FFFFFF" />
    </svg>
  );
}

export function PlayStoreIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Google Play Store"
    >
      <rect width="48" height="48" rx="12" fill="#ffffff" />
      <path
        d="M13 11.5C12.4 12.1 12 13 12 14.2V33.8C12 35 12.4 35.9 13 36.5L13.1 36.6L25.2 24.5V23.5L13.1 11.4L13 11.5Z"
        fill="#4285F4"
      />
      <path
        d="M29.2 28.5L25.2 24.5V23.5L29.2 19.5L29.3 19.6L34.1 22.3C35.5 23.1 35.5 24.4 34.1 25.2L29.3 27.9L29.2 28.5Z"
        fill="#FBBC04"
      />
      <path
        d="M29.3 28.4L25.2 24.3L13 36.5C13.5 37 14.2 37.1 15.1 36.6L29.3 28.4Z"
        fill="#EA4335"
      />
      <path
        d="M29.3 19.6L15.1 11.4C14.2 10.9 13.5 11 13 11.5L25.2 23.7L29.3 19.6Z"
        fill="#34A853"
      />
    </svg>
  );
}

export function PhotosIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Google Photos"
    >
      <rect width="48" height="48" rx="12" fill="#ffffff" />
      <path
        d="M24 12C24 16.4183 20.4183 20 16 20H24V12Z"
        fill="#EA4335"
      />
      <path
        d="M24 12C24 16.4183 27.5817 20 32 20V12H24Z"
        fill="#FBBC04"
      />
      <path
        d="M36 24C31.5817 24 28 27.5817 28 32V24H36Z"
        fill="#4285F4"
      />
      <path
        d="M12 24C16.4183 24 20 27.5817 20 32V24H12Z"
        fill="#34A853"
      />
      <path
        d="M20 24C20 19.5817 23.5817 16 28 16V24H20Z"
        fill="#EA4335"
      />
      <path
        d="M28 24C28 28.4183 24.4183 32 20 32V24H28Z"
        fill="#34A853"
      />
    </svg>
  );
}

export function CalendarIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Google Calendar"
    >
      <rect width="48" height="48" rx="12" fill="#ffffff" />
      <rect x="11" y="11" width="26" height="26" rx="6" fill="#4285F4" />
      <rect x="14" y="17" width="20" height="17" rx="3" fill="#ffffff" />
      <path d="M11 17H37V14C37 12.3431 35.6569 11 34 11H14C12.3431 11 11 12.3431 11 14V17Z" fill="#1A73E8" />
      <path d="M37 31V34C37 35.6569 35.6569 37 34 37H31L37 31Z" fill="#EA4335" />
      <path d="M11 31V34C11 35.6569 12.3431 37 14 37H17L11 31Z" fill="#34A853" />
      <path d="M31 11H34C35.6569 11 37 12.3431 37 14V17L31 11Z" fill="#FBBC04" />
      <text
        x="24"
        y="30"
        fontFamily="system-ui, sans-serif"
        fontSize="13"
        fontWeight="bold"
        fill="#1A73E8"
        textAnchor="middle"
      >
        31
      </text>
    </svg>
  );
}

export function ChromeBrowserIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Browser"
    >
      <rect width="48" height="48" rx="12" fill="#ffffff" />
      <circle cx="24" cy="24" r="14" fill="#EA4335" />
      <path
        d="M24 10C29.5 10 34.2 13.2 36.4 17.8L27.2 24H24L24 10Z"
        fill="#EA4335"
      />
      <path
        d="M36.4 17.8C37.4 19.6 38 21.7 38 24C38 31.7 31.7 38 24 38L29.3 28.5L36.4 17.8Z"
        fill="#FBBC04"
      />
      <path
        d="M24 38C18.1 38 13.1 34.4 11 29.3L18.4 20.5L24 38Z"
        fill="#34A853"
      />
      <circle cx="24" cy="24" r="6.5" fill="#FFFFFF" />
      <circle cx="24" cy="24" r="5" fill="#4285F4" />
    </svg>
  );
}

export function PhoneAppIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Phone"
    >
      <rect width="48" height="48" rx="12" fill="#00AC47" />
      <path
        d="M32.5 28.2L28.8 24.5C28.4 24.1 27.8 24.1 27.4 24.5L25.6 26.3C23.6 25.2 22 23.6 20.9 21.6L22.7 19.8C23.1 19.4 23.1 18.8 22.7 18.4L19 14.7C18.6 14.3 18 14.3 17.6 14.7L15.3 17C14.7 17.6 14.4 18.5 14.6 19.4C15.5 24.4 19.4 28.3 24.4 29.2C25.3 29.4 26.2 29.1 26.8 28.5L29.1 26.2C29.5 25.8 30.1 25.8 30.5 26.2L32.5 28.2Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function MessagesAppIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Messages"
    >
      <rect width="48" height="48" rx="12" fill="#1A73E8" />
      <path
        d="M14 16C14 13.7909 15.7909 12 18 12H30C32.2091 12 34 13.7909 34 16V26C34 28.2091 32.2091 30 30 30H20L15 35V29.5C14.4 28.5 14 27.3 14 26V16Z"
        fill="#FFFFFF"
      />
      <circle cx="20" cy="21" r="2" fill="#1A73E8" />
      <circle cx="25" cy="21" r="2" fill="#1A73E8" />
      <circle cx="30" cy="21" r="2" fill="#1A73E8" />
    </svg>
  );
}

export function FilesAppIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Files"
    >
      <rect width="48" height="48" rx="12" fill="#ffffff" />
      <path
        d="M12 16C12 14.8954 12.8954 14 14 14H22L26 18H34C35.1046 18 36 18.8954 36 20V32C36 33.1046 35.1046 34 34 34H14C12.8954 34 12 33.1046 12 32V16Z"
        fill="#4285F4"
      />
      <path
        d="M12 21H36V32C36 33.1046 35.1046 34 34 34H14C12.8954 34 12 33.1046 12 32V21Z"
        fill="#34A853"
      />
      <path d="M22 26H28" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function TerminalAppIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Terminal"
    >
      <rect width="48" height="48" rx="12" fill="#091b3e" />
      <path
        d="M16 18L23 24L16 30"
        stroke="#38BDF8"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="26"
        y1="30"
        x2="33"
        y2="30"
        stroke="#38BDF8"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SettingsAppIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Settings"
    >
      <rect width="48" height="48" rx="12" fill="#475569" />
      <circle cx="24" cy="24" r="6" fill="#0F172A" />
      <path
        d="M24 12V16M24 32V36M12 24H16M32 24H36M15.5 15.5L18.3 18.3M29.7 29.7L32.5 32.5M15.5 32.5L18.3 29.7M29.7 18.3L32.5 15.5"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CameraAppIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Camera"
    >
      <rect width="48" height="48" rx="12" fill="#0284C7" />
      <path
        d="M14 18C14 16.8954 14.8954 16 16 16H20L22 13H26L28 16H32C33.1046 16 34 16.8954 34 18V31C34 32.1046 33.1046 33 32 33H16C14.8954 33 14 32.1046 14 31V18Z"
        fill="#FFFFFF"
      />
      <circle cx="24" cy="24.5" r="5.5" fill="#0284C7" />
      <circle cx="24" cy="24.5" r="3" fill="#38BDF8" />
    </svg>
  );
}

export function NexosAppIcon({
  name,
  size = 48,
  className,
  style,
}: { name: string } & IconProps) {
  switch (name.toLowerCase()) {
    case "drive":
      return <DriveIcon size={size} className={className} style={style} />;
    case "docs":
      return <DocsIcon size={size} className={className} style={style} />;
    case "meet":
      return <MeetIcon size={size} className={className} style={style} />;
    case "gmail":
    case "email":
      return <GmailIcon size={size} className={className} style={style} />;
    case "google":
      return <GoogleGIcon size={size} className={className} style={style} />;
    case "maps":
      return <MapsIcon size={size} className={className} style={style} />;
    case "playstore":
    case "store":
      return <PlayStoreIcon size={size} className={className} style={style} />;
    case "photos":
      return <PhotosIcon size={size} className={className} style={style} />;
    case "calendar":
      return <CalendarIcon size={size} className={className} style={style} />;
    case "browser":
    case "chrome":
      return <ChromeBrowserIcon size={size} className={className} style={style} />;
    case "phone":
      return <PhoneAppIcon size={size} className={className} style={style} />;
    case "messages":
      return <MessagesAppIcon size={size} className={className} style={style} />;
    case "files":
      return <FilesAppIcon size={size} className={className} style={style} />;
    case "terminal":
      return <TerminalAppIcon size={size} className={className} style={style} />;
    case "settings":
      return <SettingsAppIcon size={size} className={className} style={style} />;
    case "camera":
      return <CameraAppIcon size={size} className={className} style={style} />;
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          style={style}
          aria-label={name}
        >
          <rect width="48" height="48" rx="12" fill="#38BDF8" />
          <circle cx="24" cy="24" r="8" fill="#FFFFFF" />
        </svg>
      );
  }
}
