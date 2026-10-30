"use client";
import Link from "next/link";
import type { PublicUser } from "@rom-hub/contracts";
import { NEXOSLogo } from "./nexos-logo";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Folder,
  Plus,
  Settings,
  Sun,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ArrowUpRight,
  UserRound,
  BookOpen,
} from "lucide-react";
import {
  GlassPanel,
  NavigationItem,
  NavigationPill,
  StatusIndicator,
} from "./design-system";

const destinations = [
  { href: "/dashboard", label: "Overview", Icon: LayoutDashboard },
  { href: "/projects", label: "My projects", Icon: Folder },
  { href: "/projects/new", label: "Create ROM", Icon: Plus },
  { href: "/settings", label: "Settings", Icon: Settings },
  { href: "/profile", label: "Profile", Icon: UserRound },
];
function currentSection(path: string) {
  if (path === "/projects/new") return "/projects/new";
  if (path.startsWith("/projects") || path.startsWith("/builder/"))
    return "/projects";
  if (path.startsWith("/settings")) return "/settings";
  if (path === "/profile") return "/profile";
  if (path === "/help") return "/help";
  return "/dashboard";
}
export function Shell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: PublicUser;
}) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const [touchExpanded, setTouchExpanded] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!touchExpanded) return;
    function dismiss(event: PointerEvent) {
      if (!sidebar.current?.contains(event.target as Node))
        setTouchExpanded(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [touchExpanded]);
  const [moreOpen, setMoreOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const active = currentSection(pathname);
  const title =
    pathname.startsWith("/builder/") || pathname === "/projects/new"
      ? "Visual builder"
      : active === "/help"
        ? "Help & documentation"
        : destinations.find((d) => d.href === active)?.label;
  function closeMore() {
    dialog.current?.close();
    setMoreOpen(false);
  }
  function toggleTheme() {
    const next =
      document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("romhub-theme", next);
    } catch {}
  }
  return (
    <div className="craft-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <aside
        id="workspace-sidebar"
        ref={sidebar}
        className="craft-sidebar"
        aria-label="Workspace sidebar"
        data-expanded={hovered || touchExpanded}
        onPointerEnter={(event) => {
          if (
            event.pointerType === "mouse" &&
            window.matchMedia("(hover: hover) and (pointer: fine)").matches
          )
            setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
      >
        <Link
          prefetch={false}
          href="/"
          className="rail-brand"
          aria-label="NEXOS Android Creation Studio home"
        >
          <NEXOSLogo />
        </Link>
        <div className="rail-divider" />
        <NavigationPill aria-label="Main navigation">
          {destinations.map(({ href, label, Icon }) => (
            <NavigationItem
              key={href}
              href={href}
              icon={<Icon size={25} strokeWidth={1.7} />}
              active={active === href}
              title={label}
              aria-label={label}
              onClick={() => setTouchExpanded(false)}
            >
              {label}
            </NavigationItem>
          ))}
        </NavigationPill>
        <div className="rail-bottom">
          <div
            className="rail-status"
            role="status"
            title="Build infrastructure offline"
            aria-label="Build infrastructure offline"
          >
            <span className="rail-status-dot" aria-hidden="true" />
            <span className="rail-status-label">
              Build infrastructure offline
            </span>
          </div>
          <Link
            prefetch={false}
            href="/help"
            className="profile-card"
            title="Help & documentation"
            aria-label="Help & documentation"
          >
            <span className="profile-avatar" aria-hidden="true">
              <BookOpen size={22} />
            </span>
            <span className="profile-copy">
              Help & documentation<small>Using NEXOS</small>
            </span>
          </Link>
          <button
            className="rail-toggle"
            onClick={() => setTouchExpanded(!touchExpanded)}
            aria-label={
              touchExpanded ? "Collapse navigation" : "Expand navigation"
            }
            aria-expanded={touchExpanded}
            aria-controls="workspace-sidebar"
          >
            {!touchExpanded ? (
              <PanelLeftOpen size={19} />
            ) : (
              <PanelLeftClose size={19} />
            )}
            <span>
              {touchExpanded ? "Collapse navigation" : "Expand navigation"}
            </span>
          </button>
        </div>
      </aside>
      <div className="craft-main">
        <header className="craft-topbar">
          <div className="workspace-heading">
            <Link
              prefetch={false}
              href="/"
              className="mobile-brand"
              aria-label="NEXOS Android Creation Studio home"
            >
              <NEXOSLogo size={23} wordmark={false} />
            </Link>
            <span>
              Personal workspace <span className="workspace-slash">/</span>{" "}
              <strong>{title}</strong>
            </span>
          </div>
          <div className="topbar-actions">
            <StatusIndicator>Configuration studio</StatusIndicator>
            <span className="craft-alpha">FOUNDATION</span>
            <button
              className="theme-toggle"
              aria-label="Toggle color theme"
              onClick={toggleTheme}
            >
              <Sun className="theme-sun" size={19} />
              <Moon className="theme-moon" size={19} />
            </button>
            <Link
              prefetch={false}
              href="/profile"
              className="header-avatar"
              aria-label="Your profile"
            >
              {user.username.slice(0, 1).toUpperCase()}
            </Link>
          </div>
        </header>
        <main id="workspace-main">{children}</main>
        <footer>
          <span className="footer-brand">
            <NEXOSLogo size={18} wordmark={false} /> NEXOS <span>© 2026</span>
          </span>
          <span>Your Android. Your Rules.</span>
        </footer>
      </div>
      <NavigationPill className="mobile-dock" aria-label="Mobile navigation">
        {destinations.slice(0, 3).map(({ href, label, Icon }) => (
          <NavigationItem
            key={href}
            href={href}
            icon={<Icon size={24} />}
            active={active === href}
            title={label}
            aria-label={label}
            onClick={closeMore}
          >
            {label}
          </NavigationItem>
        ))}
        <button
          className="navigation-item"
          aria-label="More navigation"
          title="More navigation"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-controls="more-navigation"
          data-active={
            active === "/settings" || active === "/profile" || moreOpen
          }
          onClick={() => {
            dialog.current?.showModal();
            setMoreOpen(true);
          }}
        >
          <span className="navigation-icon">
            <MoreHorizontal size={25} />
          </span>
          <span className="navigation-label">More</span>
        </button>
      </NavigationPill>
      <dialog
        id="more-navigation"
        className="more-dialog"
        ref={dialog}
        aria-labelledby="more-heading"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = event.currentTarget.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled])",
          );
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClose={() => setMoreOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeMore();
        }}
      >
        <GlassPanel>
          <div className="more-title">
            <div>
              <span className="craft-kicker">YOUR WORKSPACE</span>
              <h2 id="more-heading">A little more space.</h2>
            </div>
            <button
              className="icon-button"
              aria-label="Close navigation"
              onClick={closeMore}
            >
              <X size={22} />
            </button>
          </div>
          <nav aria-label="Account navigation">
            {destinations.slice(3).map(({ href, label, Icon }) => (
              <NavigationItem
                key={href}
                href={href}
                active={active === href}
                icon={<Icon size={22} />}
                onClick={closeMore}
              >
                {label}
                <ArrowUpRight size={15} />
              </NavigationItem>
            ))}
            <Link
              prefetch={false}
              href="/help"
              className="more-home"
              onClick={closeMore}
            >
              Help & documentation <BookOpen size={16} />
            </Link>
            <Link
              prefetch={false}
              href="/"
              className="more-home"
              onClick={closeMore}
            >
              NEXOS home <ArrowUpRight size={16} />
            </Link>
          </nav>
          <StatusIndicator muted>
            Cloud builds are not configured
          </StatusIndicator>
        </GlassPanel>
      </dialog>
    </div>
  );
}
