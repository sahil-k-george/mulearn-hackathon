"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  BookOpen, 
  BrainCircuit, 
  TrendingUp, 
  Users2, 
  FolderGit2, 
  UserCircle2, 
  LogOut,
  Bell,
  X,
  Menu,
  Coffee,
  Settings as SettingsIcon
} from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/store";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { notifications, user, signOut, aiStatus, storeInfo } = useApp();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard' || pathname === '/';
    return pathname.startsWith(path);
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/subjects", label: "Subject Management", icon: BookOpen },
    { href: "/planner", label: "Study Plan (Brain Dump)", icon: BrainCircuit },
    { href: "/progress", label: "Progress Tracking", icon: TrendingUp },
    { href: "/teams", label: "Teams & Collaboration", icon: Users2 },
    { href: "/team-workspace", label: "Team Workspace", icon: Users2, indent: true },
    { href: "/resources", label: "Resources", icon: FolderGit2 },
    { href: "/wellbeing", label: "Break & Well-being", icon: Coffee },
    { href: "/settings", label: "AI Settings", icon: SettingsIcon },
    { href: "/profile", label: "Profile", icon: UserCircle2, badge: unreadCount > 0 ? unreadCount : undefined },
  ];

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="mobile-topbar">
        <button 
          onClick={() => setMobileOpen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '4px' }}
          aria-label="Open Navigation Menu"
        >
          <Menu size={24} />
        </button>
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <span className="font-brand" style={{ fontSize: '22px', color: 'var(--primary)', fontWeight: 700 }}>Adaptive.</span>
        </Link>
        <Link href="/profile" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600 }}>
            {user.name.charAt(0)}
          </div>
        </Link>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      {/* Persistent / Responsive Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', marginTop: '8px' }}>
          <div>
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <h1 className="font-brand" style={{ fontSize: '28px', color: 'var(--primary)', letterSpacing: '-0.5px' }}>Adaptive.</h1>
            </Link>
            <p className="font-body" style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Academic Companion</p>
          </div>
          {mobileOpen && (
            <button 
              onClick={() => setMobileOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={20} />
            </button>
          )}
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          {navLinks.map((link, idx) => {
            const active = isActive(link.href);
            const Icon = link.icon;
            
            // Add divider before Teams and Profile
            const showDivider = link.href === '/teams' || link.href === '/profile';

            return (
              <div key={link.href}>
                {showDivider && (
                  <div style={{ margin: '12px 0', borderTop: '1px solid var(--border-light)' }}></div>
                )}
                <Link 
                  href={link.href} 
                  className={`nav-item ${active ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                  style={link.indent ? { paddingLeft: '28px', fontSize: '14px' } : {}}
                >
                  <Icon size={18} style={{ opacity: active ? 1 : 0.7 }} />
                  <span style={{ flex: 1 }}>{link.label}</span>
                  {link.badge && (
                    <span style={{ 
                      background: 'var(--accent-warning)', 
                      color: 'white', 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      padding: '2px 7px', 
                      borderRadius: '10px' 
                    }}>
                      {link.badge}
                    </span>
                  )}
                </Link>
              </div>
            );
          })}

          <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--border-light)' }}>
            {aiStatus && (
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.5 }}>
                AI: {aiStatus.requires_key ? 'key needed' : aiStatus.mock_fallback ? 'mock mode' : aiStatus.active} · DB:{' '}
                {storeInfo?.active ?? 'file'}
              </p>
            )}
            <button
              className="nav-item"
              style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}
              onClick={async () => {
                setMobileOpen(false);
                await signOut();
                router.replace('/login');
              }}
            >
              <LogOut size={18} style={{ opacity: 0.7 }} />
              <span>Logout</span>
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
}
