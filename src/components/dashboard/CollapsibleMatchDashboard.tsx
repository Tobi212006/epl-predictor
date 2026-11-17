import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Heart, MapPin, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import stadiumSunsetImg from '../../assets/images/epl_stadium_sunset_1794865362280.jpg';
import tunnelFloodlightsImg from '../../assets/images/epl_tunnel_floodlights_1794865362748.jpg';
import pitchNightImg from '../../assets/images/epl_tactical_pitch_night_1794865363159.jpg';
import { useAppPreferences } from '../../lib/quality';
import type {
  FixtureItem,
  StandingRow,
  TacticalPhase,
  TacticalSnapshot,
} from '../../types/tactical';
import { LoadingSkeleton } from '../common/DataFreshnessStrip';
import {
  CLUB_IDENTITY_META,
  ClubKitBadge,
  PremChevronBackdrop,
  SoccerBallEmblem,
  getClubUiTheme,
  resolveMatchupUiAccents,
} from '../common/FootballMotifs';
import { ParallaxLayer } from '../common/ParallaxLayer';
import { TacticalTheatreStage } from '../pitch/TacticalTheatreStage';

const CARD_BACKDROPS = [stadiumSunsetImg, tunnelFloodlightsImg, pitchNightImg];

interface CollapsibleMatchDashboardProps {
  isOpen: boolean;
  onToggle: () => void;
  fixtures: FixtureItem[];
  standings: StandingRow[];
  isLoadingFixtures: boolean;
  isLoadingStandings: boolean;
  showXgCol: boolean;
  isDemo: boolean;
  liveFixturesCount: number;
  onLiveTick: () => void;
  isTickingLive: boolean;
  teamName: string;
  managerName: string;
  snapshots?: Record<TacticalPhase, TacticalSnapshot>;
  teamPrimaryColor: string;
  previewPhase: TacticalPhase;
  onPhaseChange: (p: TacticalPhase) => void;
  activeChapter: number;
  onChapterChange: (idx: number) => void;
}

export const CollapsibleMatchDashboard: React.FC<CollapsibleMatchDashboardProps> = ({
  isOpen,
  onToggle,
  fixtures,
  standings,
  isLoadingFixtures,
  isLoadingStandings,
  showXgCol,
  isDemo,
  liveFixturesCount,
  onLiveTick,
  isTickingLive,
  teamName,
  managerName,
  snapshots,
  teamPrimaryColor,
  previewPhase,
  onPhaseChange,
  activeChapter,
  onChapterChange,
}) => {
  const navigate = useNavigate();
  const { setSelectedFixtureId, selectedTeamId, setSelectedTeamId } = useAppPreferences();
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [showAllStandings, setShowAllStandings] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const toggleLike = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setLikedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Smooth auto-scroll hint when opening if user triggered it
  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.dataset.state = 'open';
    }
  }, [isOpen]);

  const featuredEight = fixtures.slice(0, 8);
  const visibleStandings = showAllStandings ? standings : standings.slice(0, 10);

  return (
    <section
      aria-label="Collapsible Tactical Matchday Dashboard"
      className="rounded-2xl border border-[#34424E] bg-[#141E28] overflow-hidden shadow-[0_18px_50px_rgba(6,10,16,0.5)]"
    >
      {/* Persistent Open / Close Header Strip */}
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-[#34424E] bg-[#1B2732]">
        <div className="flex items-center gap-3">
          <SoccerBallEmblem size={26} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#F4F7F5]">
                Matchday Command Dashboard
              </h2>
              {liveFixturesCount > 0 && (
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/35">
                  {liveFixturesCount} LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-[#A5B2BD]">
              {isOpen
                ? 'Live match cards, 3D formation sandbox, and 2026–27 Premier League table.'
                : 'Collapsed — click Open Dashboard to expand live fixtures, 3D pitch, and standings.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onLiveTick}
            disabled={isTickingLive}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#141E28] border border-[#7DD3FC]/35 text-xs font-medium text-[#7DD3FC] hover:border-[#7DD3FC] disabled:opacity-50 min-h-[38px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTickingLive ? 'animate-spin' : ''}`} />
            Live Sync
          </button>

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider min-h-[38px] transition-colors ${
              isOpen
                ? 'bg-[#141E28] text-[#F4F7F5] border border-[#34424E] hover:border-[#63E6A5]'
                : 'bg-[#63E6A5] text-[#0D131A] hover:opacity-90'
            }`}
          >
            {isOpen ? (
              <>
                Close Dashboard
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                Open Dashboard
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Animated Collapsible Body */}
      <div
        ref={contentRef}
        className="grid transition-[grid-template-rows,opacity] duration-500 ease-out"
        style={{
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <div className="p-5 sm:p-6 flex flex-col gap-8">
            {/* 1. 8-Card Stadium Matchday Showcase Grid */}
            <div>
              <ParallaxLayer speed={-0.4} maxShift={14}>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-gilda text-2xl sm:text-3xl text-[#F4F7F5]">
                      Recommended Fixtures to Scout
                    </h3>
                    <p className="text-xs text-[#A5B2BD] mt-0.5">
                      Click any match card to launch full score matrix, passing network, and Python explainability.
                    </p>
                  </div>
                  <Link
                    to="/fixtures"
                    className="px-4 py-1.5 rounded-lg border border-[#34424E] bg-[#1B2732] text-xs font-semibold text-[#F4F7F5] hover:bg-[#63E6A5] hover:text-[#0D131A] hover:border-[#63E6A5] transition-colors whitespace-nowrap"
                  >
                    See All
                  </Link>
                </div>
              </ParallaxLayer>

              {isLoadingFixtures ? (
                <LoadingSkeleton rows={2} height="h-56" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {featuredEight.map((fx, idx) => {
                    const bgPhoto = CARD_BACKDROPS[idx % CARD_BACKDROPS.length];
                    const liked = Boolean(likedIds[fx.id]);
                    const hasProbs = fx.prob_home !== null && fx.prob_draw !== null && fx.prob_away !== null;
                    const favProb = hasProbs
                      ? Math.max(fx.prob_home!, fx.prob_draw!, fx.prob_away!)
                      : null;
                    const cardAccents = resolveMatchupUiAccents(
                      { teamId: fx.home_team_id, primaryColor: fx.home_color, secondaryColor: fx.home_secondary || '#F4F7F5' },
                      { teamId: fx.away_team_id, primaryColor: fx.away_color, secondaryColor: fx.away_secondary || '#F4F7F5' },
                    );
                    const openMatch = () => {
                      setSelectedFixtureId(fx.id);
                      navigate(`/match-center/${fx.id}`);
                    };

                    return (
                      <article
                        key={fx.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open Match Center for ${fx.home_short} vs ${fx.away_short}`}
                        onClick={openMatch}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openMatch();
                          }
                        }}
                        className="group relative aspect-[203/252] rounded-xl overflow-hidden shadow-[0_14px_34px_rgba(6,10,16,0.5)] border border-[#34424E] cursor-pointer transition-transform duration-300 hover:-translate-y-1.5 hover:border-[#63E6A5]/65 focus-visible:outline-2 focus-visible:outline-[#63E6A5]"
                      >
                        {/* Background Photo with Smooth Hover Zoom */}
                        <img
                          src={bgPhoto}
                          alt={`${fx.home_short} vs ${fx.away_short}`}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1100ms] ease-out group-hover:scale-[1.07]"
                        />

                        {/* Darkening Bottom Editorial Gradient + Two-Club Floodlight Tint */}
                        <div
                          className="absolute inset-0"
                          style={{
                            background: `linear-gradient(105deg, ${cardAccents.homeAccent}26 0%, transparent 45%, ${cardAccents.awayAccent}26 100%), linear-gradient(180deg, rgba(13,19,26,0.36) 0%, rgba(13,19,26,0.28) 42%, rgba(13,19,26,0.95) 100%)`,
                          }}
                        />
                        <PremChevronBackdrop
                          leftColor={cardAccents.homeAccent}
                          rightColor={cardAccents.awayAccent}
                          className="absolute inset-0 w-full h-full pointer-events-none opacity-65"
                        />

                        {/* Top-Left Charcoal Glass Readout */}
                        <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-[#0D131A]/85 backdrop-blur-md border border-[#34424E] text-[11px] font-mono font-bold text-[#63E6A5] tabular-nums">
                          {fx.home_xg !== null && fx.away_xg !== null
                            ? `${fx.home_xg.toFixed(1)}–${fx.away_xg.toFixed(1)}`
                            : `MW ${fx.matchweek}`}
                          <span className="text-[#A5B2BD] font-normal">
                            {fx.status === 'LIVE' ? ' LIVE' : ' xG'}
                          </span>
                        </div>

                        {/* Top-Right Heart Favorite Button */}
                        <button
                          type="button"
                          onClick={(e) => toggleLike(e, fx.id)}
                          aria-label={`Bookmark ${fx.home_short} vs ${fx.away_short}`}
                          className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-[#0D131A]/85 backdrop-blur-md border border-[#34424E] flex items-center justify-center shadow-md transition-transform duration-200 ${
                            liked ? 'scale-110 border-[#F87171]/60' : 'hover:scale-110 hover:border-[#63E6A5]/60'
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 transition-transform ${
                              liked ? 'fill-[#F87171] text-[#F87171] scale-125' : 'text-[#A5B2BD]'
                            }`}
                          />
                        </button>

                        {/* Center Sculpted Kit Pair */}
                        <div className="relative z-10 h-full flex flex-col justify-between p-3.5 pt-14">
                          <div className="flex items-center justify-center gap-2.5 my-auto">
                            <ClubKitBadge
                              teamId={fx.home_team_id}
                              primaryColor={fx.home_color}
                              secondaryColor={fx.home_secondary || '#F4F7F5'}
                              tla={fx.home_tla}
                              size="sm"
                            />
                            <span className="font-mono text-xs font-bold text-[#63E6A5] bg-[#1B2732]/90 px-2 py-0.5 rounded border border-[#34424E]">
                              {fx.status === 'LIVE' || fx.status === 'FINISHED'
                                ? `${fx.home_goals ?? 0}:${fx.away_goals ?? 0}`
                                : 'VS'}
                            </span>
                            <ClubKitBadge
                              teamId={fx.away_team_id}
                              primaryColor={fx.away_color}
                              secondaryColor={fx.away_secondary || '#F4F7F5'}
                              tla={fx.away_tla}
                              size="sm"
                              isAway={cardAccents.isAwayKit}
                            />
                          </div>

                          {/* Bottom Title, Venue & Honest Model Confidence */}
                          <div>
                            <div className="font-display text-base font-bold text-[#F4F7F5] leading-tight truncate">
                              {fx.home_short} vs {fx.away_short}
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-[#A5B2BD] truncate">
                              <MapPin className="w-3 h-3 text-[#63E6A5] shrink-0" />
                              <span className="truncate">{fx.venue}</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="font-mono text-[11px] font-semibold text-[#63E6A5] tabular-nums">
                                {favProb !== null ? `${Math.round(favProb * 100)}% Max` : `MW ${fx.matchweek}`}
                                {fx.confidence_label ? ` · ${fx.confidence_label}` : ''}
                              </span>
                              <span className="font-mono text-[11px] font-bold tabular-nums">
                                <span style={{ color: cardAccents.homeAccent }}>
                                  {fx.prob_home !== null ? `${Math.round(fx.prob_home * 100)}%` : '—'}
                                </span>
                                <span className="text-[#A5B2BD] font-normal"> / </span>
                                <span style={{ color: cardAccents.awayAccent }}>
                                  {fx.prob_away !== null ? `${Math.round(fx.prob_away * 100)}%` : '—'}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Live 3D Tactical Pitch Preview + Scroll-Coordinated Chapters */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <div className="xl:col-span-7 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-[#A5B2BD]">
                  <span>
                    Focus 3D Theatre: <strong className="text-[#F4F7F5]">{teamName}</strong> ({managerName})
                  </span>
                  <Link to="/tactical-lab" className="text-[#7DD3FC] hover:text-[#63E6A5] font-medium">
                    Expand Full 3D Lab →
                  </Link>
                </div>

                {snapshots ? (
                  <TacticalTheatreStage
                    snapshots={snapshots}
                    homeColor={teamPrimaryColor}
                    phase={previewPhase}
                    onPhaseChange={onPhaseChange}
                    heightClass="h-[340px] sm:h-[400px]"
                    compact={true}
                  />
                ) : (
                  <LoadingSkeleton rows={1} height="h-[360px]" />
                )}
              </div>

              <div className="xl:col-span-5 flex flex-col gap-3">
                <h3 className="font-display text-lg font-bold text-[#F4F7F5]">
                  Phase Morphing Breakdown
                </h3>
                {[
                  {
                    title: '01. Starting Alignment & Buildup Origin',
                    body: 'Stable 11-player football identities anchor the 4-3-3 or 4-2-3-1 base before shifting with ball progression.',
                  },
                  {
                    title: '02. In-Possession Half-Spaces & Overlaps',
                    body: 'Watch fullbacks invert or overlap into a 3-2-5 attack while a faceted football moves along active passing lanes.',
                  },
                  {
                    title: '03. Pressing Traps & Block Compactness',
                    body: 'Without the ball, lines compress into a tight 4-4-2 or 5-3-2 block showing touchline pressing triggers.',
                  },
                ].map((ch, idx) => (
                  <button
                    key={ch.title}
                    type="button"
                    onClick={() => onChapterChange(idx)}
                    className={`text-left rounded-xl p-4 border transition-all ${
                      activeChapter === idx
                        ? 'bg-[#1B2732] border-[#63E6A5]/60 shadow-[0_8px_24px_rgba(99,230,165,0.12)]'
                        : 'bg-[#0D131A]/75 border-[#34424E] hover:border-[#A5B2BD]/45'
                    }`}
                  >
                    <div className="font-display text-sm font-bold text-[#F4F7F5]">{ch.title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-[#A5B2BD]">{ch.body}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Live 2026–27 Premier League Standings Table */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#F4F7F5]">
                    2026–27 Premier League Table
                  </h3>
                  <span className="text-xs text-[#A5B2BD]">
                    {isDemo
                      ? 'Synthetic Demo Standings (Fallback)'
                      : 'Synchronized Live ESPN Premier League Records · Click any club to inspect 3D tactics'}
                  </span>
                </div>
                {standings.length > 10 && (
                  <button
                    type="button"
                    onClick={() => setShowAllStandings((s) => !s)}
                    className="px-3 py-1.5 rounded-lg border border-[#34424E] text-xs font-medium text-[#7DD3FC] hover:border-[#7DD3FC]"
                  >
                    {showAllStandings ? 'Show Top 10' : `Show All ${standings.length} Clubs`}
                  </button>
                )}
              </div>

              {isLoadingStandings ? (
                <LoadingSkeleton rows={6} height="h-10" />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#34424E] bg-[#0D131A]">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm tabular-nums">
                    <thead>
                      <tr className="border-b border-[#34424E] text-[#A5B2BD] text-xs bg-[#1B2732]">
                        <th className="py-3 px-3 font-medium">#</th>
                        <th className="py-3 px-3 font-medium">Club</th>
                        <th className="py-3 px-2.5 text-right font-medium">P</th>
                        <th className="py-3 px-2.5 text-right font-medium">W</th>
                        <th className="py-3 px-2.5 text-right font-medium">D</th>
                        <th className="py-3 px-2.5 text-right font-medium">L</th>
                        <th className="py-3 px-2.5 text-right font-medium">GF</th>
                        <th className="py-3 px-2.5 text-right font-medium">GA</th>
                        <th className="py-3 px-2.5 text-right font-medium">GD</th>
                        {showXgCol && (
                          <>
                            <th className="py-3 px-2.5 text-right font-medium hidden md:table-cell">xG</th>
                            <th className="py-3 px-2.5 text-right font-medium hidden md:table-cell">xGA</th>
                          </>
                        )}
                        <th className="py-3 px-3 text-right font-semibold text-[#F4F7F5]">PTS</th>
                        <th className="py-3 px-3 hidden sm:table-cell font-medium">Form</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleStandings.map((row) => {
                        const isFocused = row.team_id === selectedTeamId;
                        const rowTheme = getClubUiTheme(row.team_id, row.primary_color, row.secondary_color);
                        const meta = CLUB_IDENTITY_META[row.team_id];
                        const zoneColor =
                          row.position <= 4
                            ? '#7DD3FC'
                            : row.position === 5
                            ? '#FBBF24'
                            : row.position >= 18
                            ? '#F87171'
                            : 'transparent';
                        const zoneTitle =
                          row.position <= 4
                            ? 'UEFA Champions League Spot'
                            : row.position === 5
                            ? 'UEFA Europa League Spot'
                            : row.position >= 18
                            ? 'Relegation Zone'
                            : 'Mid-Table';
                        const inspectClub = () => {
                          setSelectedTeamId(row.team_id);
                          navigate('/tactical-lab');
                        };
                        return (
                          <tr
                            key={row.team_id}
                            tabIndex={0}
                            aria-label={`Inspect ${row.short_name} 3D tactical system`}
                            onClick={inspectClub}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                inspectClub();
                              }
                            }}
                            title={`${row.short_name}${meta ? ` · ${meta.stadium}` : ''} — ${zoneTitle}`}
                            style={
                              isFocused
                                ? { backgroundColor: rowTheme.glowSoft }
                                : undefined
                            }
                            className={`border-b border-[#34424E]/50 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[#63E6A5] ${
                              isFocused
                                ? 'hover:bg-[#233240]'
                                : 'hover:bg-[#1B2732]/65'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-[#A5B2BD] font-mono">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-1 h-4 rounded-full shrink-0"
                                  style={{ backgroundColor: zoneColor }}
                                  title={zoneTitle}
                                />
                                <span
                                  className="font-bold"
                                  style={
                                    isFocused
                                      ? { color: rowTheme.accent }
                                      : zoneColor !== 'transparent'
                                      ? { color: zoneColor }
                                      : undefined
                                  }
                                >
                                  {row.position}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-[#F4F7F5]">
                              <div className="flex items-center gap-2.5">
                                <ClubKitBadge
                                  teamId={row.team_id}
                                  primaryColor={row.primary_color}
                                  secondaryColor={row.secondary_color}
                                  tla={row.tla}
                                  size="xs"
                                />
                                <div className="min-w-0">
                                  <span className="whitespace-nowrap font-semibold" style={isFocused ? { color: rowTheme.accent } : undefined}>
                                    {row.short_name}
                                  </span>
                                  {meta && (
                                    <span className="hidden lg:inline ml-2 text-[11px] font-normal text-[#A5B2BD]">
                                      {meta.stadium}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-2.5 text-right text-[#A5B2BD]">{row.played}</td>
                            <td className="py-2.5 px-2.5 text-right text-[#A5B2BD]">{row.won}</td>
                            <td className="py-2.5 px-2.5 text-right text-[#A5B2BD]">{row.drawn}</td>
                            <td className="py-2.5 px-2.5 text-right text-[#A5B2BD]">{row.lost}</td>
                            <td className="py-2.5 px-2.5 text-right text-[#A5B2BD]">{row.gf}</td>
                            <td className="py-2.5 px-2.5 text-right text-[#A5B2BD]">{row.ga}</td>
                            <td className="py-2.5 px-2.5 text-right font-mono">
                              {row.gd > 0 ? `+${row.gd}` : row.gd}
                            </td>
                            {showXgCol && (
                              <>
                                <td className="py-2.5 px-2.5 text-right font-mono text-[#7DD3FC] hidden md:table-cell">
                                  {row.xg_for !== null ? row.xg_for.toFixed(1) : '—'}
                                </td>
                                <td className="py-2.5 px-2.5 text-right font-mono text-[#F87171] hidden md:table-cell">
                                  {row.xg_against !== null ? row.xg_against.toFixed(1) : '—'}
                                </td>
                              </>
                            )}
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-[#63E6A5]">
                              {row.points}
                            </td>
                            <td className="py-2.5 px-3 hidden sm:table-cell">
                              <div className="flex items-center gap-1 font-mono text-[11px]">
                                {row.form.map((res, idx) => (
                                  <span
                                    key={idx}
                                    className={`w-5 h-5 rounded flex items-center justify-center ${
                                      res === 'W'
                                        ? 'bg-[#63E6A5]/20 text-[#63E6A5]'
                                        : res === 'D'
                                        ? 'bg-white/10 text-[#A5B2BD]'
                                        : 'bg-[#F87171]/20 text-[#F87171]'
                                    }`}
                                  >
                                    {res}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 py-2.5 bg-[#141E28] border-t border-[#34424E] flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#A5B2BD]">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-3 rounded-full bg-[#7DD3FC]" />
                        1–4 UEFA Champions League
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-3 rounded-full bg-[#FBBF24]" />
                        5th UEFA Europa League
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-3 rounded-full bg-[#F87171]" />
                        18–20 Relegation
                      </span>
                    </div>
                    <span className="font-mono text-[#63E6A5]">Click any row to inspect 3D tactical shape</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
