import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  HTMLAttributes,
  ReactNode,
} from "react";

type SurfaceProps = HTMLAttributes<HTMLDivElement>;
export function GlassPanel({ className = "", ...props }: SurfaceProps) {
  return <div className={`glass-panel ${className}`} {...props} />;
}
export function GlassCard({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <article className={`glass-card ${className}`} {...props} />;
}
export function FloatingToolbar({ className = "", ...props }: SurfaceProps) {
  return <div className={`floating-toolbar ${className}`} {...props} />;
}
export function NavigationPill({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <nav className={`navigation-pill ${className}`} {...props} />;
}
export function NavigationItem({
  icon,
  children,
  active,
  className = "",
  ...props
}: ComponentProps<typeof Link> & { icon: ReactNode; active?: boolean }) {
  return (
    <Link
      prefetch={false}
      className={`navigation-item ${className}`}
      aria-current={active ? "page" : undefined}
      {...props}
    >
      <span className="navigation-icon">{icon}</span>
      <span className="navigation-label">{children}</span>
    </Link>
  );
}
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        {eyebrow && <span className="craft-kicker">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function StatusIndicator({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <span className={`status-indicator ${muted ? "status-muted" : ""}`}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}
export function ProfileCard({
  className = "",
  ...props
}: Omit<ComponentProps<typeof Link>, "href" | "children">) {
  return (
    <Link href="/settings" className={`profile-card ${className}`} {...props}>
      <span className="profile-avatar" aria-hidden="true">
        R
      </span>
      <span className="profile-copy">
        Your account<small>Profile & sessions</small>
      </span>
      <span className="profile-arrow" aria-hidden="true">
        ↗
      </span>
    </Link>
  );
}
export function PrimaryButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button primary ${className}`} {...props} />;
}
export function SecondaryButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button secondary ${className}`} {...props} />;
}
