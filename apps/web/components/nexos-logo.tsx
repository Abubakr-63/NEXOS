import { Orbit } from "lucide-react";

/** The surrounding link supplies its accessible name when the wordmark is hidden. */
export function NEXOSLogo({
  size = 32,
  wordmark = true,
}: {
  size?: number;
  wordmark?: boolean;
}) {
  return (
    <>
      <Orbit
        className="nexos-mark"
        size={size}
        strokeWidth={2}
        style={{
          width: size,
          padding: 0,
          ...(size === 32 ? { margin: "0 12px" } : {}),
        }}
        aria-hidden="true"
      />
      {wordmark && (
        <span style={size === 32 ? { left: 58 } : undefined}>
          NEXOS <small>ANDROID CREATION STUDIO</small>
        </span>
      )}
    </>
  );
}
