import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Compass, FlaskConical, MapPin, Swords } from 'lucide-react';
import stadiumSunsetImg from '../../assets/images/epl_stadium_sunset_1794865362280.jpg';
import tunnelFloodlightsImg from '../../assets/images/epl_tunnel_floodlights_1794865362748.jpg';
import {
  CLUB_IDENTITY_META,
  ClubKitBadge,
  PremChevronBackdrop,
  SoccerBallEmblem,
  resolveMatchupUiAccents,
} from './FootballMotifs';

interface TeamCorner {
  id: string;
  name: string;
  shortName: string;
  tla: string;
  primaryColor: string;
  secondaryColor?: string;
  managerName?: string;
  formation?: string;
  xg?: number | null;
}

interface StadiumBattleBannerProps {
  home: TeamCorner;
  away: TeamCorner;
  venue: string;
  matchweek?: number;
  status?: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED';
  liveClock?: string | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
  probHome?: number | null;
  probDraw?: number | null;
  probAway?: number | null;
  fixtureId?: string;
  mode?: 'match' | 'clash' | 'flow' | 'whatif';
}

export const StadiumBattleBanner: React.FC<StadiumBattleBannerProps> = ({
  home,
  away,
  venue,
  matchweek,
  status = 'SCHEDULED',
  liveClock,
  homeGoals,
  awayGoals,
  probHome,
  probDraw,
  probAway,
  fixtureId,
  mode = 'match',
}) => {
  const { homeAccent, awayAccent, isAwayKit: clashColors } = resolveMatchupUiAccents(
    { teamId: home.id, primaryColor: home.primaryColor, secondaryColor: home.secondaryColor },
    { teamId: away.id, primaryColor: away.primaryColor, secondaryColor: away.secondaryColor },
  );
  const bgImg = mode === 'clash' ? tunnelFloodlightsImg : stadiumSunsetImg;

  const pH = probHome !== null && probHome !== undefined ? Math.round(probHome * 100) : null;
  const pD = probDraw !== null && probDraw !== undefined ? Math.round(probDraw * 100) : null;
  const pA = probAway !== null && probAway !== undefined ? Math.round(probAway * 100) : null;

  return (
    <section
      aria-label={`${home.shortName} vs ${away.shortName} Stadium Battle`}
      className="relative rounded-2xl overflow-hidden border border-[#34424E] shadow-[0_20px_55px_rgba(6,10,16,0.55)]"
    >
      {/* Stadium Background Photo */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-[1.03]"
        style={{ backgroundImage: `url(${bgImg})` }}
      />

      {/* Charcoal + Slate Floodlit Scrim */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(105deg, rgba(13,19,26,0.92) 0%, rgba(20,30,40,0.84) 50%, rgba(13,19,26,0.92) 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 18% 50%, ${homeAccent}33, transparent 48%), radial-gradient(circle at 82% 50%, ${awayAccent}33, transparent 48%)`,
        }}
      />
      <PremChevronBackdrop
        leftColor={homeAccent}
        rightColor={awayAccent}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Top Stadium Bar */}
      <div className="relative z-10 px-5 pt-4 pb-2 flex flex-wrap items-center justify-between gap-3 border-b border-[#34424E]/80 text-xs">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[#A5B2BD]">
          <MapPin className="w-3.5 h-3.5 text-[#63E6A5]" />
          <span className="font-semibold text-[#F4F7F5]">{venue}</span>
          {CLUB_IDENTITY_META[home.id]?.capacity && (
            <>
              <span className="text-[#34424E]">·</span>
              <span>Cap. {CLUB_IDENTITY_META[home.id].capacity.toLocaleString()}</span>
            </>
          )}
          {matchweek && (
            <>
              <span className="text-[#34424E]">·</span>
              <span>Matchweek {matchweek}</span>
            </>
          )}
          <span className="text-[#34424E]">·</span>
          <span style={{ color: homeAccent }} className="font-semibold">
            {CLUB_IDENTITY_META[home.id]?.nickname || 'Home Advantage'}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          {status === 'LIVE' ? (
            <span className="px-2.5 py-0.5 rounded bg-[#F87171] text-[#0D131A] font-bold tracking-wider">
              LIVE {liveClock || ''}
            </span>
          ) : status === 'FINISHED' ? (
            <span className="px-2.5 py-0.5 rounded bg-[#1B2732] border border-[#34424E] text-[#63E6A5] font-semibold">
              FULL TIME
            </span>
          ) : (
            <span className="text-[#63E6A5] font-semibold">2026–27 MATCHDAY CARD</span>
          )}
        </div>
      </div>

      {/* Main Home vs Away Stadium Duel Stage */}
      <div className="relative z-10 px-5 sm:px-8 py-6 grid grid-cols-1 md:grid-cols-11 gap-6 items-center">
        {/* HOME SIDE */}
        <div className="md:col-span-4 flex items-center gap-4 justify-start">
          <div className="relative shrink-0">
            <ClubKitBadge
              teamId={home.id}
              primaryColor={home.primaryColor}
              secondaryColor={home.secondaryColor}
              tla={home.tla}
              size="lg"
            />
            <span
              className="block mt-1 text-center font-mono text-[10px] font-bold tracking-widest"
              style={{ color: homeAccent }}
            >
              HOME XI
            </span>
          </div>

          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#F4F7F5] leading-tight truncate">
              {home.name}
            </h2>
            {home.managerName && (
              <div className="mt-1 text-xs text-[#A5B2BD] truncate">
                {home.managerName}
                {home.formation ? ` · ${home.formation}` : ''}
              </div>
            )}
            {home.xg !== undefined && home.xg !== null && (
              <div className="mt-1.5 font-mono text-sm font-bold tabular-nums" style={{ color: homeAccent }}>
                {home.xg.toFixed(2)} <span className="text-[11px] font-normal text-[#A5B2BD]">proj xG</span>
              </div>
            )}
          </div>
        </div>

        {/* CENTER SHIELD & 1X2 PROBABILITY BAR */}
        <div className="md:col-span-3 flex flex-col items-center text-center gap-2.5">
          <div className="flex items-center gap-3">
            <SoccerBallEmblem size={24} />
            <div className="px-4 py-1.5 rounded-xl bg-[#1B2732] border border-[#63E6A5]/45 shadow-lg font-mono text-base sm:text-lg font-extrabold text-[#F4F7F5] tabular-nums">
              {status === 'LIVE' || status === 'FINISHED'
                ? `${homeGoals ?? 0} – ${awayGoals ?? 0}`
                : 'VS'}
            </div>
            <SoccerBallEmblem size={24} />
          </div>

          {pH !== null && pD !== null && pA !== null && (
            <div className="w-full max-w-[230px]">
              <div className="flex justify-between text-[11px] font-mono tabular-nums mb-1">
                <span className="font-bold" style={{ color: homeAccent }}>{home.tla} {pH}%</span>
                <span className="text-[#A5B2BD]">D {pD}%</span>
                <span className="font-bold" style={{ color: awayAccent }}>{away.tla} {pA}%</span>
              </div>
              <div className="h-2.5 rounded-sm overflow-hidden flex bg-[#0D131A] border border-[#34424E]">
                <div style={{ width: `${pH}%`, backgroundColor: homeAccent }} />
                <div style={{ width: `${pD}%` }} className="bg-[#64748B]" />
                <div style={{ width: `${pA}%`, backgroundColor: awayAccent }} />
              </div>
            </div>
          )}
        </div>

        {/* AWAY SIDE */}
        <div className="md:col-span-4 flex items-center gap-4 justify-start md:justify-end md:flex-row-reverse text-left md:text-right">
          <div className="relative shrink-0">
            <ClubKitBadge
              teamId={away.id}
              primaryColor={away.primaryColor}
              secondaryColor={away.secondaryColor}
              tla={away.tla}
              size="lg"
              isAway={clashColors}
            />
            <span
              className="block mt-1 text-center font-mono text-[10px] font-bold tracking-widest"
              style={{ color: awayAccent }}
            >
              {clashColors ? 'AWAY ALT' : 'AWAY XI'}
            </span>
          </div>

          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#F4F7F5] leading-tight truncate">
              {away.name}
            </h2>
            {away.managerName && (
              <div className="mt-1 text-xs text-[#A5B2BD] truncate">
                {away.managerName}
                {away.formation ? ` · ${away.formation}` : ''}
              </div>
            )}
            {away.xg !== undefined && away.xg !== null && (
              <div className="mt-1.5 font-mono text-sm font-bold tabular-nums" style={{ color: awayAccent }}>
                {away.xg.toFixed(2)} <span className="text-[11px] font-normal text-[#A5B2BD]">proj xG</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Connected Studio Deep-Link Strip */}
      <div className="relative z-10 px-5 py-3 bg-[#141E28]/95 border-t border-[#34424E] flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-[#A5B2BD] font-mono text-[11px]">
          Connected Tactical Modules for {home.shortName} vs {away.shortName}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {mode !== 'match' && fixtureId && (
            <Link
              to={`/match-center/${fixtureId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B2732] border border-[#34424E] text-[#F4F7F5] hover:border-[#63E6A5] hover:text-[#63E6A5] font-medium transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
              Match Center
            </Link>
          )}
          {mode !== 'clash' && (
            <Link
              to={`/manager-clash?home=${home.id}&away=${away.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B2732] border border-[#34424E] text-[#F4F7F5] hover:border-[#7DD3FC] hover:text-[#7DD3FC] font-medium transition-colors"
            >
              <Swords className="w-3.5 h-3.5" />
              Manager Clash
            </Link>
          )}
          {mode !== 'flow' && fixtureId && (
            <Link
              to={`/match-flow?fixture=${fixtureId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B2732] border border-[#34424E] text-[#F4F7F5] hover:border-[#63E6A5] hover:text-[#63E6A5] font-medium transition-colors"
            >
              <Activity className="w-3.5 h-3.5" />
              Match Flow
            </Link>
          )}
          {mode !== 'whatif' && (
            <Link
              to={`/what-if?home=${home.id}&away=${away.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#63E6A5] text-[#0D131A] font-bold hover:opacity-90 transition-opacity"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              What-If Lab
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};
