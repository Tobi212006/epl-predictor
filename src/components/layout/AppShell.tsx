import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  BarChart2,
  BookOpen,
  CalendarDays,
  Compass,
  FlaskConical,
  LayoutDashboard,
  Menu,
  ShieldHalf,
  Swords,
  UserCheck,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAppPreferences } from '../../lib/quality';
import {
  ClubKitBadge,
  ClubTlaBadge,
  PremCrownLionMark,
  SoccerBallEmblem,
  getClubUiTheme,
} from '../common/FootballMotifs';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/fixtures', label: 'Fixtures', icon: CalendarDays },
  { to: '/match-center', label: 'Match Center', icon: Compass },
  { to: '/tactical-lab', label: 'Tactical Lab', icon: ShieldHalf },
  { to: '/manager-dna', label: 'Manager DNA', icon: UserCheck },
  { to: '/manager-clash', label: 'Manager vs Manager', icon: Swords },
  { to: '/match-flow', label: 'Match Flow', icon: Activity },
  { to: '/what-if', label: 'What-if Lab', icon: FlaskConical },
  { to: '/intelligence', label: 'Team & Player Intel', icon: BarChart2 },
  { to: '/methodology', label: 'Methodology', icon: BookOpen },
];

const FALLBACK_CLUBS = [
  { team_id: 'arsenal', short_name: 'Arsenal' },
  { team_id: 'man-city', short_name: 'Man City' },
  { team_id: 'liverpool', short_name: 'Liverpool' },
  { team_id: 'brighton', short_name: 'Brighton' },
  { team_id: 'chelsea', short_name: 'Chelsea' },
  { team_id: 'everton', short_name: 'Everton' },
  { team_id: 'bournemouth', short_name: 'Bournemouth' },
  { team_id: 'brentford', short_name: 'Brentford' },
  { team_id: 'leeds', short_name: 'Leeds' },
  { team_id: 'aston-villa', short_name: 'Aston Villa' },
  { team_id: 'tottenham', short_name: 'Tottenham' },
  { team_id: 'newcastle', short_name: 'Newcastle' },
  { team_id: 'hull-city', short_name: 'Hull City' },
  { team_id: 'ipswich', short_name: 'Ipswich' },
  { team_id: 'fulham', short_name: 'Fulham' },
  { team_id: 'nottm-forest', short_name: 'Nottm Forest' },
  { team_id: 'coventry', short_name: 'Coventry' },
  { team_id: 'man-united', short_name: 'Man United' },
  { team_id: 'sunderland', short_name: 'Sunderland' },
  { team_id: 'crystal-palace', short_name: 'Crystal Palace' },
];

const MOBILE_PRIMARY_NAV = NAV_ITEMS.slice(0, 5);

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { use3D, selectedTeamId, setSelectedTeamId } = useAppPreferences();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const standingsQuery = useQuery({
    queryKey: ['standings'],
    queryFn: api.getStandings,
  });

  const clubOptions = useMemo(() => {
    const rows = standingsQuery.data?.standings;
    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        team_id: r.team_id,
        short_name: r.short_name,
        tla: r.tla,
        primary_color: r.primary_color,
        secondary_color: r.secondary_color,
      }));
    }
    return FALLBACK_CLUBS.map((c) => ({
      ...c,
      tla: c.short_name.slice(0, 3).toUpperCase(),
      primary_color: '#63E6A5',
      secondary_color: '#F4F7F5',
    }));
  }, [standingsQuery.data?.standings]);

  const activeFocusClub = useMemo(
    () => clubOptions.find((c) => c.team_id === selectedTeamId) || clubOptions[0],
    [clubOptions, selectedTeamId],
  );

  const clubTheme = useMemo(
    () =>
      getClubUiTheme(
        activeFocusClub?.team_id,
        activeFocusClub?.primary_color || '#63E6A5',
        activeFocusClub?.secondary_color || '#F4F7F5',
      ),
    [activeFocusClub],
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.14);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isNavItemActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-[#0D131A] text-[#F4F7F5] flex flex-col lg:flex-row">
      {/* Desktop Slate Left Navigation Rail with Restrained Premier League Purple Hairline */}
      <aside
        className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 border-r border-[#34424E] bg-[#141E28] sticky top-0 h-screen"
        aria-label="Primary navigation"
      >
        <div
          className="px-5 py-4 border-b border-[#34424E] flex items-center gap-2.5"
          style={{
            background: 'linear-gradient(135deg, rgba(56, 0, 60, 0.42) 0%, rgba(20, 30, 40, 0.96) 100%)',
          }}
        >
          <PremCrownLionMark size={30} accentColor="#C084FC" />
          <div>
            <NavLink to="/" className="font-display text-base font-bold tracking-tight text-[#F4F7F5] block whitespace-nowrap">
              Pitchline TI
            </NavLink>
            <p className="text-[11px] font-mono text-[#C084FC]">
              Premier League Analytics
            </p>
          </div>
        </div>

        {/* Team-Scoped Focus Club Card */}
        {activeFocusClub && (
          <div
            className="mx-3 mt-3 rounded-xl border border-[#34424E] p-3 flex items-center gap-2.5 transition-colors duration-300"
            style={{
              background: `linear-gradient(135deg, ${clubTheme.glowSoft} 0%, rgba(13,19,26,0.94) 100%)`,
              borderColor: `${clubTheme.accent}50`,
            }}
          >
            <ClubKitBadge
              teamId={activeFocusClub.team_id}
              primaryColor={activeFocusClub.primary_color}
              secondaryColor={activeFocusClub.secondary_color}
              tla={activeFocusClub.tla}
              size="sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-display text-sm font-bold text-[#F4F7F5] truncate">
                  {activeFocusClub.short_name}
                </span>
              </div>
              <div className="text-[11px] truncate font-medium" style={{ color: clubTheme.accent }}>
                {clubTheme.meta?.nickname || 'Focus Club'}
              </div>
              {clubTheme.meta && (
                <div className="text-[10px] font-mono text-[#A5B2BD] truncate">
                  {clubTheme.meta.stadium}
                </div>
              )}
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active ? 'text-[#63E6A5]' : 'text-[#A5B2BD] hover:text-[#F4F7F5] hover:bg-[#1B2732]/60'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="desktop-nav-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-lg bg-[#1B2732] border border-[#C084FC]/45 shadow-sm -z-0"
                  />
                )}
                <Icon className="w-4 h-4 shrink-0 relative z-10" />
                <span className="relative z-10">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#34424E] text-xs text-[#A5B2BD]">
          <div className="flex items-center gap-2">
            <SoccerBallEmblem size={16} />
            <span>{use3D ? '3D WebGL Stadium Active' : '2D Tactical Vector Canvas'}</span>
          </div>
          <div className="mt-1 text-[#C084FC] font-mono">Season: 2026–27 EPL</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky 3-Zone Top Bar with subtle PL purple accent */}
        <header
          className={`sticky top-0 z-50 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 sm:gap-8 transition-all duration-300 border-b ${
            scrolled
              ? 'bg-[#141E28]/95 backdrop-blur-xl border-[#C084FC]/35 shadow-lg'
              : 'bg-[#141E28]/88 backdrop-blur-md border-[#34424E]'
          }`}
        >
          {/* Zone 1: Mobile Menu Trigger + League Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#1B2732] border border-[#34424E] text-[#F4F7F5] hover:border-[#C084FC] shrink-0"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <NavLink
              to="/"
              className="lg:hidden font-display text-sm sm:text-base font-bold tracking-tight text-[#F4F7F5] whitespace-nowrap shrink-0 flex items-center gap-2"
            >
              <PremCrownLionMark size={22} accentColor="#C084FC" />
              <span>Pitchline EPL</span>
            </NavLink>
            <div className="hidden lg:flex items-center gap-2 text-sm font-medium text-[#A5B2BD] whitespace-nowrap shrink-0">
              <span className="font-display font-semibold text-[#F4F7F5]">2026–27 Premier League</span>
              <span aria-hidden="true" className="text-[#C084FC]">·</span>
              <span className="text-xs text-[#A5B2BD]">Matchday Prediction &amp; Tactical Lab</span>
            </div>
          </div>

          {/* Zone 2: Team-Scoped Focus Club Selector */}
          <div className="hidden md:flex items-center gap-2.5">
            {activeFocusClub && (
              <ClubTlaBadge
                teamId={activeFocusClub.team_id}
                tla={activeFocusClub.tla}
                primaryColor={activeFocusClub.primary_color}
                secondaryColor={activeFocusClub.secondary_color}
                size="sm"
              />
            )}
            <label htmlFor="global-club-select" className="text-xs text-[#A5B2BD] whitespace-nowrap shrink-0">
              Focus Club
            </label>
            <select
              id="global-club-select"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="rounded-lg bg-[#1B2732] border border-[#34424E] px-3 py-1.5 text-xs text-[#F4F7F5] min-h-[38px]"
            >
              {clubOptions.map((c) => (
                <option key={c.team_id} value={c.team_id}>
                  {c.short_name}
                </option>
              ))}
            </select>
          </div>

          {/* Zone 3: Direct Studio Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/match-center')}
              className="hidden sm:inline-flex items-center px-3.5 py-1.5 rounded-lg bg-[#1B2732] hover:bg-[#233240] border border-[#34424E] text-xs font-medium text-[#F4F7F5] whitespace-nowrap shrink-0 min-h-[38px] transition-colors"
            >
              Match Center
            </button>
            <button
              type="button"
              onClick={() => navigate('/tactical-lab')}
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-[#63E6A5] hover:opacity-90 text-xs font-bold text-[#0D131A] whitespace-nowrap shrink-0 min-h-[38px] transition-opacity shadow-md"
            >
              Tactical Lab
            </button>
          </div>
        </header>

        {/* Accessible Mobile Drawer Panel (includes Focus Club Selector on Mobile) */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-b border-[#34424E] bg-[#1B2732] overflow-hidden"
            >
              <div className="p-3 pb-2 border-b border-[#34424E]/80 flex items-center gap-2.5">
                {activeFocusClub && (
                  <ClubTlaBadge
                    teamId={activeFocusClub.team_id}
                    tla={activeFocusClub.tla}
                    primaryColor={activeFocusClub.primary_color}
                    secondaryColor={activeFocusClub.secondary_color}
                    size="sm"
                  />
                )}
                <label htmlFor="mobile-club-select" className="text-xs text-[#A5B2BD] whitespace-nowrap">
                  Focus Club
                </label>
                <select
                  id="mobile-club-select"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="flex-1 rounded-lg bg-[#141E28] border border-[#34424E] px-2.5 py-1.5 text-xs text-[#F4F7F5] min-h-[40px]"
                >
                  {clubOptions.map((c) => (
                    <option key={c.team_id} value={c.team_id}>
                      {c.short_name}
                    </option>
                  ))}
                </select>
              </div>
              <nav className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5" aria-label="Mobile full navigation">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium min-h-[42px] ${
                        active
                          ? 'bg-[#141E28] border border-[#C084FC]/45 text-[#63E6A5]'
                          : 'text-[#A5B2BD] hover:text-[#F4F7F5] hover:bg-[#141E28]/60'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Secondary Horizontal Scroller */}
        <div className="lg:hidden border-b border-[#34424E] bg-[#141E28] px-3 py-1.5 flex items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 min-h-[34px] inline-flex items-center ${
                  isActive ? 'bg-[#1B2732] text-[#63E6A5] border border-[#C084FC]/45' : 'text-[#A5B2BD]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Main Viewport */}
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-6 pb-24 lg:pb-10">
          {children}
        </main>

        {/* Quiet Footer */}
        <footer className="hidden lg:flex items-center justify-between border-t border-[#34424E] px-8 py-4 text-xs text-[#A5B2BD]">
          <span>
            Independent Premier League Analytics · Quantitative projections in Python (not affiliated with the Premier League or member clubs)
          </span>
          <span>Live fixtures &amp; standings via ESPN / football-data.org · Passing &amp; heatmaps clearly labeled when simulated</span>
        </footer>
      </div>

      {/* Compact Mobile Bottom Nav */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#141E28]/95 border-t border-[#34424E] flex items-center justify-around h-14 px-1"
        aria-label="Mobile quick navigation"
      >
        {MOBILE_PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={`relative flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[10px] font-medium min-w-[56px] min-h-[44px] ${
                active ? 'text-[#63E6A5]' : 'text-[#A5B2BD]'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="mobile-nav-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute top-0 inset-x-2 h-0.5 rounded-full bg-[#C084FC]"
                />
              )}
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
