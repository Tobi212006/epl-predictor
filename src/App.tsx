import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, ChevronRight, CircleHelp, Clock3, Goal, Menu, RefreshCw, ShieldCheck, Sparkles, Trophy, Users, X } from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { api } from "./api";
import type { Match, Standing, Team } from "./types";

type DataState = "loading" | "connected" | "setup" | "error";
type MatchTab = "Overview" | "Stats" | "Lineups" | "Shot map";
const transition = { duration: .48, ease: [0.16, 1, 0.3, 1] as const };
const previewTeams: Team[] = [
  { id: 1, name: "Arsenal", shortName: "Arsenal", tla: "ARS" }, { id: 2, name: "Chelsea", shortName: "Chelsea", tla: "CHE" },
  { id: 3, name: "Manchester City", shortName: "Man City", tla: "MCI" }, { id: 4, name: "Liverpool", shortName: "Liverpool", tla: "LIV" },
  { id: 5, name: "Tottenham Hotspur", shortName: "Tottenham", tla: "TOT" }, { id: 6, name: "Newcastle United", shortName: "Newcastle", tla: "NEW" },
];
const demoMatches: Match[] = [
  { id: 9001, utcDate: "2026-11-22T14:30:00Z", status: "SCHEDULED", matchday: 12, homeTeam: previewTeams[0], awayTeam: previewTeams[1] },
  { id: 9002, utcDate: "2026-11-22T17:00:00Z", status: "SCHEDULED", matchday: 12, homeTeam: previewTeams[2], awayTeam: previewTeams[3] },
  { id: 9003, utcDate: "2026-11-23T16:30:00Z", status: "SCHEDULED", matchday: 12, homeTeam: previewTeams[4], awayTeam: previewTeams[5] },
];
const demoTable: Standing[] = [
  { position: 1, team: previewTeams[0], playedGames: 11, won: 9, draw: 1, lost: 1, points: 28, goalsFor: 25, goalsAgainst: 9, goalDifference: 16 },
  { position: 2, team: previewTeams[2], playedGames: 11, won: 8, draw: 1, lost: 2, points: 25, goalsFor: 27, goalsAgainst: 13, goalDifference: 14 },
  { position: 3, team: previewTeams[4], playedGames: 11, won: 7, draw: 2, lost: 2, points: 23, goalsFor: 23, goalsAgainst: 11, goalDifference: 12 },
  { position: 4, team: previewTeams[3], playedGames: 11, won: 7, draw: 1, lost: 3, points: 22, goalsFor: 24, goalsAgainst: 13, goalDifference: 11 },
  { position: 5, team: { id: 7, name: "Aston Villa", shortName: "Aston Villa", tla: "AVL" }, playedGames: 11, won: 7, draw: 0, lost: 4, points: 21, goalsFor: 25, goalsAgainst: 17, goalDifference: 8 },
  { position: 6, team: previewTeams[1], playedGames: 11, won: 6, draw: 2, lost: 3, points: 20, goalsFor: 21, goalsAgainst: 14, goalDifference: 7 },
];

const homeSpots: [number, number][] = [[0, 11.2], [-6.7, 8], [-2.2, 8.3], [2.2, 8.3], [6.7, 8], [-4.3, 4.2], [0, 4.7], [4.3, 4.2], [-5.4, .4], [0, -.4], [5.4, .4]];
const awaySpots: [number, number][] = [[0, -11.2], [-6.7, -8], [-2.2, -8.3], [2.2, -8.3], [6.7, -8], [-4.3, -4.2], [0, -4.7], [4.3, -4.2], [-5.4, -.4], [0, .4], [5.4, -.4]];

export default function App() {
  const [fixtures, setFixtures] = useState<Match[]>(demoMatches);
  const [table, setTable] = useState<Standing[]>(demoTable);
  const [dataState, setDataState] = useState<DataState>("loading");
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(demoMatches[0].id);
  const [activeTab, setActiveTab] = useState<MatchTab>("Overview");
  const [filter, setFilter] = useState("All matches");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    setRefreshing(true); setError("");
    try {
      const [fixtureResult, tableResult] = await Promise.allSettled([api.fixtures(), api.standings()]);
      const gotFixtures = fixtureResult.status === "fulfilled";
      const gotTable = tableResult.status === "fulfilled";
      if (gotFixtures) setFixtures(fixtureResult.value.matches.length ? fixtureResult.value.matches : []);
      if (gotTable) setTable(tableResult.value.standings);
      if (gotFixtures || gotTable) setDataState("connected");
      else {
        const firstError = fixtureResult.status === "rejected" ? fixtureResult.reason : tableResult.status === "rejected" ? tableResult.reason : null;
        const message = firstError instanceof Error ? firstError.message : "Football data is unavailable.";
        setError(message); setDataState(message.includes("Add your free") ? "setup" : "error");
      }
    } finally { setRefreshing(false); }
  }
  useEffect(() => { void loadData(); }, []);

  const shownFixtures = useMemo(() => {
    const active = fixtures.filter((m) => filter === "All matches" || (filter === "Live" ? ["IN_PLAY", "PAUSED", "LIVE"].includes(m.status) : filter === "Upcoming" ? ["SCHEDULED", "TIMED"].includes(m.status) : m.status === "FINISHED"));
    return active.slice(0, 6);
  }, [fixtures, filter]);
  const selectedMatch = fixtures.find((m) => m.id === selectedId) || fixtures[0];
  const isDemo = dataState !== "connected";
  const selectedHome = table.find((r) => r.team.id === selectedMatch?.homeTeam.id);
  const selectedAway = table.find((r) => r.team.id === selectedMatch?.awayTeam.id);
  const estimate = selectedHome && selectedAway ? Math.max(24, Math.min(72, 45 + (selectedHome.points - selectedAway.points) * .65 + (selectedHome.goalDifference - selectedAway.goalDifference) * .15)) : 48;

  return <div className="site-shell">
    <div className="floodlight floodlight-a"/><div className="floodlight floodlight-b"/><div className="grain"/>
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <a className="brand" href="#top" aria-label="Touchline home"><img src="/logo.svg"/><span><b>TOUCHLINE</b><small>TACTICAL INTELLIGENCE</small></span></a>
      <div className="nav-caption">YOUR MATCHDAY</div>
      <nav className="side-nav">
        <a className="active" href="#top" onClick={() => setMobileMenu(false)}><Activity size={17}/> Overview</a>
        <a href="#fixtures" onClick={() => setMobileMenu(false)}><CalendarDays size={17}/> Fixtures <span className="nav-count">{fixtures.length}</span></a>
        <a href="#match-centre" onClick={() => setMobileMenu(false)}><Goal size={17}/> Match centre</a>
        <a href="#standings" onClick={() => setMobileMenu(false)}><Trophy size={17}/> Standings</a>
        <a href="#tactical" onClick={() => setMobileMenu(false)}><Sparkles size={17}/> Tactical lab</a>
      </nav>
      <div className="side-bottom"><div className="league-select"><span className="live-dot"/><span><b>Premier League</b><small>2026 / 27 season</small></span><ChevronRight size={15}/></div><div className="side-note">Football intelligence, in motion.</div></div>
    </aside>

    <main className="main" id="top">
      <header className="topbar"><button className="icon-btn menu-btn" aria-label="Open navigation" onClick={() => setMobileMenu(true)}><Menu size={20}/></button><div className="crumb">ENGLAND <span>/</span> <b>PREMIER LEAGUE</b></div><div className="topbar-right"><span className={`source-pill ${isDemo ? "preview-pill" : ""}`}><i/> {isDemo ? "PREVIEW DATA" : "FOOTBALL DATA CONNECTED"}</span><button className="refresh-btn" onClick={() => void loadData()} disabled={refreshing}><RefreshCw size={14} className={refreshing?"spin":""}/><span>Refresh</span></button><img className="mini-logo" src="/logo.svg"/></div></header>

      <section className="hero">
        <div className="hero-bg-ring ring-one"/><div className="hero-bg-ring ring-two"/>
        <div className="hero-copy"><div className="eyebrow"><span/> MATCHDAY INTELLIGENCE <span/></div><h1>Read the game.<br/><em>See what comes next.</em></h1><p>Scores, form and tactical context, brought together on one animated touchline.</p><div className="hero-actions"><a href="#match-centre" className="primary-cta">Open match centre <ChevronRight size={16}/></a><a className="quiet-link" href="#tactical">Explore the tactical lab <ArrowDownRight size={15}/></a></div></div>
        <div className="hero-orbit"><div className="orbit-track orbit-track-outer"/><div className="orbit-track orbit-track-inner"/><span className="orbit-ball">⚽</span><div className="orbit-center"><img src="/logo.svg"/><b>PL</b><small>26 / 27</small></div><span className="orbit-label label-top">FORM</span><span className="orbit-label label-right">TACTICS</span><span className="orbit-label label-bottom">MOMENTUM</span></div>
        <div className="hero-footer"><span><i className="pulse-dot"/> SEASON 2026 — 2027</span><span>20 CLUBS <b>·</b> ONE LEAGUE</span><span>SCROLL TO EXPLORE <span className="scroll-arrow">↓</span></span></div>
      </section>

      {error && <motion.div className={`data-banner ${dataState === "setup" ? "setup-banner" : ""}`} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}><CircleHelp size={17}/><div><b>{dataState === "setup" ? "Connect your free data source" : "Using preview mode"}</b><p>{error} {dataState === "setup" && <a href="https://www.football-data.org/client/register" target="_blank" rel="noreferrer">Get a free token ↗</a>}</p></div></motion.div>}
      {isDemo && <div className="sample-ribbon"><Sparkles size={13}/> SAMPLE FIGURES FOR DESIGN PREVIEW <span>Real data appears after adding your API token.</span></div>}

      <section className="snapshot-grid" aria-label="League snapshot">
        <Snapshot icon={<CalendarDays/>} label="UP NEXT" value={fixtures.length ? String(fixtures.length).padStart(2,"0") : "—"} detail="fixtures in the radar" accent="lime"/>
        <Snapshot icon={<Trophy/>} label="TABLE LEADER" value={table[0]?.team.shortName || table[0]?.team.name || "—"} detail={table[0] ? `${table[0].points} pts · ${table[0].playedGames} played` : "waiting for data"} accent="violet"/>
        <Snapshot icon={<Activity/>} label="MATCH CENTRE" value="4 views" detail="stats · timeline · lineups · shots" accent="cyan"/>
        <Snapshot icon={<ShieldCheck/>} label="MODEL STATUS" value={isDemo ? "Preview" : "Data ready"} detail={isDemo ? "no invented live stats" : "provider data loaded"} accent="gold"/>
      </section>

      <section className="section-block" id="fixtures">
        <div className="section-head"><div><div className="section-kicker">FIXTURE RADAR <span className="kicker-line"/></div><h2>The next ninety.</h2></div><div className="filter-tabs">{["All matches","Live","Upcoming","Results"].map((item)=><button key={item} className={filter===item?"selected":""} onClick={()=>setFilter(item)}>{item}</button>)}</div></div>
        <div className="match-shelf" role="list">
          {shownFixtures.length ? shownFixtures.map((match,index)=><motion.button layout key={match.id} role="listitem" className={`fixture-card ${selectedMatch?.id===match.id?"fixture-selected":""}`} onClick={()=>{setSelectedId(match.id);setActiveTab("Overview");document.getElementById("match-centre")?.scrollIntoView({behavior:"smooth",block:"start"})}} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{...transition,delay:index*.05}}>
            <div className="fixture-card-top"><span>{match.matchday ? `MATCHWEEK ${String(match.matchday).padStart(2,"0")}` : "PREMIER LEAGUE"}</span><span className={match.status==="IN_PLAY"?"live-tag":"fixture-date"}>{match.status==="IN_PLAY"?"● LIVE":formatMatch(match.utcDate)}</span></div>
            <div className="fixture-team-row"><TeamBadge team={match.homeTeam}/><b>{score(match.score?.fullTime?.home, match.status)}</b></div>
            <div className="fixture-team-row"><TeamBadge team={match.awayTeam}/><b>{score(match.score?.fullTime?.away, match.status)}</b></div>
            <div className="fixture-card-foot"><span>{match.status==="SCHEDULED"||match.status==="TIMED"?formatTime(match.utcDate):match.status.replaceAll("_"," ")}</span><span>VIEW MATCH <ChevronRight size={13}/></span></div>
          </motion.button>) : <div className="empty-card"><CalendarDays/><b>No fixtures in this view</b><span>Choose another filter or refresh the schedule.</span></div>}
        </div>
      </section>

      <section className="section-block match-section" id="match-centre">
        <div className="section-head"><div><div className="section-kicker">MATCH CENTRE <span className="kicker-line"/></div><h2>Every angle. One match.</h2></div><span className="section-badge"><Activity size={13}/> {selectedMatch?.status?.replaceAll("_"," ") || "NO MATCH"}</span></div>
        {selectedMatch ? <div className="match-layout">
          <article className="panel match-panel">
            <div className="match-panel-top"><span className="match-league">PREMIER LEAGUE <b>·</b> MATCHWEEK {selectedMatch.matchday || "—"}</span><span className={isDemo?"demo-tag":"fresh-tag"}>{isDemo?"PREVIEW MATCH":"PROVIDER DATA"}</span></div>
            <div className="scoreboard"><div className="score-side"><TeamBadge team={selectedMatch.homeTeam}/><span className="score-club">{selectedMatch.homeTeam.name}</span></div><div className="score-center"><span className="score-numbers">{score(selectedMatch.score?.fullTime?.home,selectedMatch.status)} <i>:</i> {score(selectedMatch.score?.fullTime?.away,selectedMatch.status)}</span><span className="match-status">{selectedMatch.status==="SCHEDULED"||selectedMatch.status==="TIMED"?formatMatch(selectedMatch.utcDate):selectedMatch.status.replaceAll("_"," ")}</span></div><div className="score-side score-side-away"><TeamBadge team={selectedMatch.awayTeam}/><span className="score-club">{selectedMatch.awayTeam.name}</span></div></div>
            <div className="match-tabs" role="tablist">{(["Overview","Stats","Lineups","Shot map"] as MatchTab[]).map((tab)=><button key={tab} role="tab" aria-selected={activeTab===tab} className={activeTab===tab?"active-tab":""} onClick={()=>setActiveTab(tab)}>{tab}</button>)}</div>
            <AnimatePresence mode="wait"><motion.div key={activeTab} className="match-tab-content" initial={{opacity:0,y:7}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} transition={{duration:.22}}>
              {activeTab==="Overview" && <OverviewTab match={selectedMatch} isDemo={isDemo}/>}
              {activeTab==="Stats" && <StatsTab isDemo={isDemo}/>}
              {activeTab==="Lineups" && <LineupsTab isDemo={isDemo} home={selectedMatch.homeTeam} away={selectedMatch.awayTeam}/>}
              {activeTab==="Shot map" && <ShotMapTab isDemo={isDemo}/>}
            </motion.div></AnimatePresence>
          </article>
          <aside className="side-stack">
            <article className="panel projection-card"><div className="panel-topline"><span>TABLE FORM SIGNAL</span><span className="info-dot" title="Illustrative standings-based signal, not a calibrated model">i</span></div><h3>Home-side edge</h3><p>Table position and goal difference create a quick comparison, not a match forecast.</p><div className="projection-bar"><span style={{width:`${estimate}%`}}/><span style={{width:`${Math.max(18,100-estimate-20)}%`}}/><span style={{flex:1}}/></div><div className="projection-legend"><span><i className="home-key"/>HOME <b>{Math.round(estimate)}%</b></span><span><i className="draw-key"/>DRAW <b>—</b></span><span><i className="away-key"/>AWAY <b>—</b></span></div><div className="disclaimer"><ShieldCheck size={13}/> Exploratory signal only. No betting advice.</div></article>
            <article className="panel insight-card"><div className="panel-topline"><span>TACTICAL THEATRE</span><span className="insight-live"><i/> MOTION ON</span></div><h3>Shape tells a story.</h3><p>Watch the teams shift through phases. Exact player positions need a lineup feed.</p><div className="formation-chips"><span>4—3—3</span><span className="phase-arrow">→</span><span>4—2—3—1</span></div><a href="#tactical">Open tactical lab <ChevronRight size={14}/></a></article>
          </aside>
        </div> : <div className="panel no-match"><CalendarDays/><b>No match selected</b><p>Choose a fixture above to open the match centre.</p></div>}
      </section>

      <section className="section-block standings-section" id="standings">
        <div className="section-head"><div><div className="section-kicker">THE TABLE <span className="kicker-line"/></div><h2>Pressure builds here.</h2></div><a className="all-link" href="#standings">Full standings <ChevronRight size={14}/></a></div>
        <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>#</th><th>CLUB</th><th>PL</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>PTS</th></tr></thead><tbody>{table.slice(0,8).map((row,index)=><motion.tr key={row.team.id} initial={{opacity:0,x:-8}} whileInView={{opacity:1,x:0}} viewport={{once:true}} transition={{...transition,delay:index*.035}}><td><span className={`rank ${row.position<=4?"rank-top":""}`}>{String(row.position).padStart(2,"0")}</span></td><td><TeamBadge team={row.team}/></td><td>{row.playedGames}</td><td>{row.won}</td><td>{row.draw}</td><td>{row.lost}</td><td className={row.goalDifference>0?"positive":""}>{row.goalDifference>0?"+":""}{row.goalDifference}</td><td className="points">{row.points}</td></motion.tr>)}</tbody></table></div><div className="table-foot"><span className="qualification-dot"/> Top-four places <span>·</span> {isDemo?"sample preview values":"latest available provider table"}</div></div>
      </section>

      <section className="section-block tactical-section" id="tactical">
        <div className="section-head"><div><div className="section-kicker">TACTICAL LAB <span className="kicker-line"/></div><h2>Put the shape in motion.</h2></div><span className="section-badge"><Sparkles size={13}/> 3D PITCH PREVIEW</span></div>
        <div className="tactical-layout"><article className="panel theatre-panel"><div className="panel-topline"><span>FORMATION THEATRE</span><span className="motion-status"><i/> SPRING TRANSITIONS</span></div><div className="pitch-stage"><Canvas camera={{position:[0,20,7],fov:38}} dpr={[1,1.4]} gl={{antialias:true,alpha:true}} fallback={<PitchFallback/>}><color attach="background" args={["#12251d"]}/><ambientLight intensity={1.9}/><directionalLight position={[5,12,6]} intensity={2.1}/><PitchScene/></Canvas><div className="pitch-overlay"><span>HOME · MINT</span><span>AWAY · CORAL</span></div></div><div className="phase-row">{["Base","In possession","Out of possession","Transition"].map((phase,i)=><button key={phase} className={i===1?"phase-active":""}>{phase}</button>)}</div></article><aside className="panel theatre-notes"><span className="panel-topline">MATCHUP NOTE</span><div className="note-icon"><Activity size={17}/></div><h3>Build the picture.</h3><p>This pitch is animated to preview the tactical experience. Real formations and player names appear only when a verified lineup feed is connected.</p><div className="lineup-state"><Users size={14}/><span>LINEUPS <b>NOT IN FREE FEED</b></span></div><div className="lineup-state"><BarChart3 size={14}/><span>MODEL <b>PREVIEW MODE</b></span></div></aside></div>
      </section>

      <div className="closing-strip"><div className="closing-ball">⚽</div><div><span>READ THE GAME</span><b>Numbers for the curious.<br/><em>Motion for the matchday.</em></b></div><div className="closing-words">FORM <i>·</i> STRUCTURE <i>·</i> EVIDENCE</div></div>
      <footer className="footer"><a className="brand footer-brand" href="#top"><img src="/logo.svg"/><span><b>TOUCHLINE</b><small>TACTICAL INTELLIGENCE</small></span></a><span>Football data for curious fans.</span><span>Demo values are labelled. No data is invented as live.</span></footer>
    </main>
    <AnimatePresence>{mobileMenu&&<motion.button className="scrim" aria-label="Close navigation" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setMobileMenu(false)}/>}</AnimatePresence>
  </div>;
}

function Snapshot({icon,label,value,detail,accent}:{icon:ReactNode;label:string;value:string;detail:string;accent:string}){return <motion.article className="snapshot-card" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={transition}><div className="snapshot-head"><span>{label}</span><i className={`snapshot-icon ${accent}`}>{icon}</i></div><b>{value}</b><small>{detail}</small><span className="snapshot-spark"/></motion.article>}
function TeamBadge({team}:{team:Team}){return <span className="team-badge">{team.crest?<img src={team.crest} alt="" loading="lazy"/>:<i>{team.tla||team.shortName?.slice(0,3)||team.name.slice(0,3)}</i>}</span>}
function formatMatch(iso:string){return new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"short",timeZone:"Asia/Kolkata"}).format(new Date(iso))}
function formatTime(iso:string){return new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"}).format(new Date(iso))+" IST"}
function score(value:number|undefined|null,status:string){return value==null?(status==="SCHEDULED"||status==="TIMED"?"—": "·"):value}

function OverviewTab({match,isDemo}:{match:Match;isDemo:boolean}){
  return <div className="overview-tab"><div className="overview-grid"><div className="momentum-card"><div className="subpanel-head"><span>MOMENTUM FLOW</span><span className="sample-flag">{isDemo?"SAMPLE CURVE":"NOT IN FREE FEED"}</span></div>{isDemo?<MomentumChart/>:<Unavailable text="Match momentum needs event-by-event data, which this free feed does not provide."/>}<div className="chart-axis"><span>0′</span><span>30′</span><span>HT</span><span>60′</span><span>90′</span></div></div><div className="key-events"><div className="subpanel-head"><span>KEY MOMENTS</span><span className="sample-flag">{isDemo?"PREVIEW":"WAITING"}</span></div>{isDemo?<><Event minute="18′" title="Opening pressure" detail={`${match.homeTeam.shortName||"Home"} push into the final third`} color="mint"/><Event minute="42′" title="Shot on target" detail="Goalkeeper makes the save" color="coral"/><Event minute="67′" title="Shape change" detail="Midfield line steps higher" color="violet"/></>:<Unavailable text="Event timeline appears when the connected provider includes match events."/>}</div></div><div className="data-source-line"><ShieldCheck size={13}/>{isDemo?"Sample preview only. Figures are illustrative, not match facts.":"Fixture and score from football-data.org. Advanced event data not supplied."}</div></div>
}
function StatsTab({isDemo}:{isDemo:boolean}){const rows=[["Possession",54,46],["Shots",14,9],["Shots on target",6,3],["Corners",7,4],["Pass accuracy",88,82]];return <div className="stats-tab">{isDemo?<><div className="stats-note"><BarChart3 size={15}/> SAMPLE MATCH STATS <span>illustrative values</span></div>{rows.map(([name,h,a])=><div className="stat-row" key={name}><div className="stat-numbers"><b>{h}{name==="Possession"||name==="Pass accuracy"?"%":""}</b><span>{name}</span><b>{a}{name==="Possession"||name==="Pass accuracy"?"%":""}</b></div><div className="stat-track"><i style={{width:`${Number(h)/(Number(h)+Number(a))*100}%`}}/><i style={{width:`${Number(a)/(Number(h)+Number(a))*100}%`}}/></div></div>)}<p className="sample-caption">These numbers exist only to preview the interface. They are not from a real fixture.</p></>:<Unavailable text="The free football-data.org plan supplies fixtures, results and tables, but not possession, shots or xG. Add a licensed match-statistics provider to enable this panel."/>}</div>}
function LineupsTab({isDemo,home,away}:{isDemo:boolean;home:Team;away:Team}){return <div className="lineups-tab">{isDemo?<><div className="lineup-headers"><span><TeamBadge team={home}/>{home.shortName||home.name}</span><b>4—3—3</b><span><TeamBadge team={away}/>{away.shortName||away.name}</span></div><div className="mini-pitch"><PitchPlayers color="mint"/><PitchPlayers color="coral" away/><div className="mini-half"/><div className="mini-circle"/><span className="mini-ball"/></div><p className="sample-caption">Formation markers are illustrative. No actual lineup is being reported.</p></>:<Unavailable text="Starting lineups and player ratings are not included in the free fixture feed."/>}</div>}
function ShotMapTab({isDemo}:{isDemo:boolean}){return <div className="shot-tab">{isDemo?<><div className="subpanel-head"><span>SHOT MAP PREVIEW</span><span className="sample-flag">ILLUSTRATIVE</span></div><div className="shot-pitch"><div className="shot-box"/><div className="shot-net"/><i className="shot-dot shot-a"/><i className="shot-dot shot-b"/><i className="shot-dot shot-c"/><i className="shot-dot shot-d"/><i className="shot-dot shot-e"/><i className="shot-dot shot-f"/></div><p className="sample-caption">Shot locations and xG require event data; these markers are placeholders.</p></>:<Unavailable text="Shot locations and xG require event-level coverage from a connected data provider."/>}</div>}
function Unavailable({text}:{text:string}){return <div className="unavailable"><CircleHelp size={16}/><span>{text}</span></div>}
function Event({minute,title,detail,color}:{minute:string;title:string;detail:string;color:string}){return <div className="event-row"><span className="event-minute">{minute}</span><i className={`event-dot ${color}`}/><div><b>{title}</b><small>{detail}</small></div></div>}
function MomentumChart(){return <svg className="momentum-chart" viewBox="0 0 440 120" preserveAspectRatio="none" aria-label="Illustrative match momentum line chart"><defs><linearGradient id="mintArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#70edb7" stopOpacity=".3"/><stop offset="1" stopColor="#70edb7" stopOpacity="0"/></linearGradient><linearGradient id="coralArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ff8273" stopOpacity=".24"/><stop offset="1" stopColor="#ff8273" stopOpacity="0"/></linearGradient></defs><path className="chart-area home-area" d="M0 92 C24 86 25 54 50 65 S82 93 103 69 S139 37 157 50 S185 78 211 62 S249 42 270 47 S308 71 328 49 S366 38 381 30 S416 37 440 14 V120 H0Z"/><path className="chart-area away-area" d="M0 98 C28 92 39 104 58 91 S91 67 110 86 S148 98 164 77 S194 65 211 82 S244 93 264 71 S302 90 318 74 S354 76 370 58 S414 77 440 63 V120 H0Z"/><path className="chart-line home-line" pathLength="1" d="M0 92 C24 86 25 54 50 65 S82 93 103 69 S139 37 157 50 S185 78 211 62 S249 42 270 47 S308 71 328 49 S366 38 381 30 S416 37 440 14"/><path className="chart-line away-line" pathLength="1" d="M0 98 C28 92 39 104 58 91 S91 67 110 86 S148 98 164 77 S194 65 211 82 S244 93 264 71 S302 90 318 74 S354 76 370 58 S414 77 440 63"/><circle cx="381" cy="30" r="4" fill="#70edb7" className="chart-ping"/></svg>}
function PitchPlayers({color,away=false}:{color:string;away?:boolean}){const spots=away?[[50,16],[24,31],[42,29],[58,29],[76,31],[37,45],[63,45],[23,60],[43,64],[57,64],[77,60]]:[[50,84],[24,69],[42,71],[58,71],[76,69],[37,55],[63,55],[23,40],[43,36],[57,36],[77,40]];return <>{spots.map(([x,y],i)=><span key={`${color}-${i}`} className={`mini-player ${color} ${away?"away-player":""}`} style={{left:`${x}%`,top:`${y}%`,animationDelay:`${i*65}ms`}}>{i===0?"GK":String(i+1).padStart(2,"0")}</span>)}</>}
function PitchFallback(){return <div className="css-pitch"><PitchPlayers color="mint"/><PitchPlayers color="coral" away/><div className="mini-half"/><div className="mini-circle"/><span className="mini-ball"/></div>}
function PitchScene(){const ball=useRef<Mesh>(null!);useFrame(({clock})=>{if(ball.current){const t=clock.getElapsedTime();ball.current.position.x=Math.sin(t*.62)*4.1;ball.current.position.z=Math.cos(t*.62)*3.3}});return <group><mesh rotation={[-Math.PI/2,0,0]} position={[0,-.12,0]}><planeGeometry args={[18,28]}/><meshStandardMaterial color="#1b5b42"/></mesh>{Array.from({length:7},(_,i)=><mesh key={`stripe-${i}`} rotation={[-Math.PI/2,0,0]} position={[-7.8+i*2.6,-.1,0]}><planeGeometry args={[1.3,27.8]}/><meshBasicMaterial color={i%2?"#2a704f":"#236645"} transparent opacity={.32}/></mesh>)}<PitchLine position={[0,.02,0]} args={[17.7,.035,.035]}/><PitchLine position={[0,.02,13.8]} args={[17.7,.035,.035]}/><PitchLine position={[0,.02,-13.8]} args={[17.7,.035,.035]}/><PitchLine position={[-8.85,.02,0]} args={[.035,.035,27.6]}/><PitchLine position={[8.85,.02,0]} args={[.035,.035,27.6]}/><PitchLine position={[0,.02,0]} args={[17.7,.035,.035]}/><mesh rotation={[Math.PI/2,0,0]} position={[0,.025,0]}><torusGeometry args={[3.1,.035,8,56]}/><meshBasicMaterial color="#d7f1dc" transparent opacity={.72}/></mesh><PitchLine position={[0,.03,10.6]} args={[8,.035,.035]}/><PitchLine position={[0,.03,-10.6]} args={[8,.035,.035]}/>{homeSpots.map(([x,z],i)=><PlayerToken key={`h${i}`} x={x} z={z} color="#70edb7" number={i+1}/>)}{awaySpots.map(([x,z],i)=><PlayerToken key={`a${i}`} x={x} z={z} color="#ff8273" number={i+1}/>)}<mesh ref={ball} position={[0,.46,0]}><icosahedronGeometry args={[.33,1]}/><meshStandardMaterial color="#f6f5eb" roughness={.35}/></mesh><fog attach="fog" args={["#12251d",20,42]}/></group>}
function PitchLine({position,args}:{position:[number,number,number];args:[number,number,number]}){return <mesh position={position}><boxGeometry args={args}/><meshBasicMaterial color="#d7f1dc" transparent opacity={.7}/></mesh>}
function PlayerToken({x,z,color,number}:{x:number;z:number;color:string;number:number}){return <group position={[x,.12,z]}><mesh position={[0,.22,0]}><cylinderGeometry args={[.37,.43,.38,24]}/><meshStandardMaterial color={color} roughness={.38} emissive={color} emissiveIntensity={.12}/></mesh><mesh position={[0,.43,0]}><cylinderGeometry args={[.22,.22,.035,20]}/><meshBasicMaterial color="#eaf5ed"/></mesh></group>}
