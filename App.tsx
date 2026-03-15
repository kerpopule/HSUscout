
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Team, PitData, MatchData, MatchRole, Accuracy, StartingPosition } from './types';
import { SMOKY_MOUNTAIN_TEAMS, DRIVETRAIN_TYPES, MOTOR_TYPES, ARCHETYPES, CLIMB_CAPABILITIES } from './constants';
import {
  savePitData,
  saveMatchData,
  updatePitData,
  deletePitData,
  updateMatchDataOnServer,
  deleteMatchData,
  clearAllServerData,
  fetchTbaEventsByYear,
  fetchTbaTeamsForEvent,
  fetchTbaMatchesForEvent,
  fetchTbaContext,
  saveTbaContext,
  fetchTbaRankings,
  fetchTbaOprs,
  fetchTbaAlliances,
  fetchTbaTeamEvents,
  fetchTbaTeamMatches,
  TBAEventSimple,
  TBARankings,
  TBAOprs,
  TBAAlliance,
  TBAMatch,
} from './lib/api';
import { addToSyncQueue, getSyncQueue, startSyncService } from './lib/sync';
import { encodeMatchData, encodeBulkMatchData, encodePitData, encodeBulkPitData, encodeAllData, DecodedQRData } from './lib/qr-encode';
import { pinVerify, getCachedPin, cachePin, PinType } from './lib/pin';
import { Button } from './components/Button';
import { Input, Toggle, Select, RadioGroup } from './components/Input';
import { SyncStatus } from './components/SyncStatus';
import { QRCodeModal } from './components/QRCodeModal';
import { QRScanner } from './components/QRScanner';
import { PinPad } from './components/PinPad';
import { CardMenu } from './components/CardMenu';
import {
  Trophy,
  Users,
  ClipboardCheck,
  Download,
  Settings,
  ChevronRight,
  Plus,
  Trash2,
  Activity,
  ArrowLeft,
  Search,
  CheckCircle2,
  XCircle,
  Zap,
  Weight,
  Cpu,
  Box,
  Target,
  MoveUp,
  BrainCircuit,
  Sword,
  Shield,
  Loader2,
  Timer,
  Play,
  Gamepad2,
  Flag,
  AlertTriangle,
  Star,
  MapPin,
  Flame,
  ZapOff,
  AlertCircle,
  Ruler,
  Clock,
  Layout,
  UserCheck,
  Hand,
  ScanLine,
  QrCode,
  Share2,
  Globe,
  ArrowUpDown,
  X
} from 'lucide-react';

const STORAGE_KEY_PIT = 'smoky_scout_pit_v3';
const STORAGE_KEY_MATCH = 'smoky_scout_match_v6';
const STORAGE_KEY_TBA_CONTEXT = 'smoky_scout_tba_context_v1';

type View = 'dashboard' | 'pit' | 'match' | 'settings' | 'team_detail' | 'strategy' | 'scanner' | 'tba' | 'rankings';
type RankingsCategory = 'shooter' | 'feeder' | 'climber' | 'defense';
type TbaTeamDataMap = Record<number, {
  events: TBAEventSimple[];
  matches: TBAMatch[];
  ranking?: { rank: number; record: { wins: number; losses: number; ties: number }; matches_played: number } | null;
  opr?: number | null;
  dpr?: number | null;
  ccwm?: number | null;
  avgScore?: number | null;
} | null>;

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [pitData, setPitData] = useState<Record<number, PitData>>({});
  const [matchData, setMatchData] = useState<MatchData[]>([]);
  const [tbaEvents, setTbaEvents] = useState<TBAEventSimple[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(new Date().getFullYear());
  const [selectedEventKey, setSelectedEventKey] = useState<string>('');
  const [teamSource, setTeamSource] = useState<Team[]>(SMOKY_MOUNTAIN_TEAMS);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [pendingSync, setPendingSync] = useState(getSyncQueue().length);
  const [qrModalData, setQrModalData] = useState<string | null>(null);
  const [pinModal, setPinModal] = useState<{ onSubmit: (pin: string) => Promise<boolean | 'error'>; title?: string } | null>(null);
  const [editingMatch, setEditingMatch] = useState<MatchData | null>(null);
  const [tbaLoading, setTbaLoading] = useState({ events: false, teams: false });
  const [stratBlue, setStratBlue] = useState<number[]>([0, 0, 0]);
  const [stratRed, setStratRed] = useState<number[]>([0, 0, 0]);
  const [stratTbaData, setStratTbaData] = useState<TbaTeamDataMap>({});
  const scannerReturnView = useRef<View>('settings');
  const syncRef = useRef<{ stop: () => void; pause: () => void; resume: () => void } | null>(null);

  const requirePin = useCallback((pinType: PinType, callback: (pin: string) => void, title?: string) => {
    const cached = getCachedPin(pinType);
    if (cached) {
      callback(cached);
      return;
    }
    setPinModal({
      title: title || (pinType === 'admin' ? 'Enter Admin PIN' : 'Enter PIN'),
      onSubmit: async (pin: string): Promise<boolean | 'error'> => {
        try {
          const result = await pinVerify(pin);
          if (!result.valid || result.role !== pinType) {
            return false;
          }
          cachePin(pin, pinType);
          setTimeout(() => callback(pin), 0);
          return true;
        } catch {
          return 'error';
        }
      },
    });
  }, []);

  useEffect(() => {
    const savedPit = localStorage.getItem(STORAGE_KEY_PIT);
    const savedMatch = localStorage.getItem(STORAGE_KEY_MATCH);
    const savedContext = localStorage.getItem(STORAGE_KEY_TBA_CONTEXT);
    if (savedPit) setPitData(JSON.parse(savedPit));
    if (savedMatch) setMatchData(JSON.parse(savedMatch));
    if (savedContext) {
      try {
        const parsed = JSON.parse(savedContext) as { season?: number; eventKey?: string };
        if (typeof parsed.season === 'number') setSelectedSeason(parsed.season);
        if (typeof parsed.eventKey === 'string') {
          setSelectedEventKey(parsed.eventKey);
        }
      } catch {
        // ignore invalid cache
      }
    }

    fetchTbaContext().then((ctx) => {
      if (ctx.season) setSelectedSeason(ctx.season);
      if (ctx.eventKey) {
        setSelectedEventKey(ctx.eventKey);
      }
    }).catch(() => {
      // no server context available yet
    });
  }, []);

  useEffect(() => {
    let canceled = false;
    setTbaLoading(prev => ({ ...prev, events: true }));
    fetchTbaEventsByYear(selectedSeason)
      .then((events) => {
        if (canceled) return;
        setTbaEvents(events);
      })
      .catch(() => {
        if (!canceled) setTbaEvents([]);
      })
      .finally(() => {
        if (!canceled) setTbaLoading(prev => ({ ...prev, events: false }));
      });

    return () => {
      canceled = true;
    };
  }, [selectedSeason]);

  useEffect(() => {
    if (!selectedEventKey) return;
    if (!tbaEvents.some(event => event.key === selectedEventKey)) {
      setSelectedEventKey('');
    }
  }, [selectedEventKey, tbaEvents]);

  useEffect(() => {
    let canceled = false;
    const applyTeamList = (teams: Team[]) => {
      const deduped = new Map<number, Team>();
      for (const t of teams) {
        if (!deduped.has(t.number)) deduped.set(t.number, t);
      }
      const merged = Array.from(deduped.values()).sort((a, b) => a.number - b.number);
      setTeamSource(merged);
    };

    if (!selectedEventKey) {
      applyTeamList(SMOKY_MOUNTAIN_TEAMS);
      return;
    }

    setTbaLoading(prev => ({ ...prev, teams: true }));
    fetchTbaTeamsForEvent(selectedEventKey)
      .then((teams) => {
        if (!canceled) applyTeamList(teams);
      })
      .catch(() => {
        if (!canceled) {
          applyTeamList(SMOKY_MOUNTAIN_TEAMS);
        }
      })
      .finally(() => {
        if (!canceled) setTbaLoading(prev => ({ ...prev, teams: false }));
      });

    return () => {
      canceled = true;
    };
  }, [selectedEventKey]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TBA_CONTEXT, JSON.stringify({ season: selectedSeason, eventKey: selectedEventKey }));
  }, [selectedSeason, selectedEventKey]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PIT, JSON.stringify(pitData));
  }, [pitData]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MATCH, JSON.stringify(matchData));
  }, [matchData]);

  // Sync service
  useEffect(() => {
    const sync = startSyncService({
      onConnectionChange: setIsConnected,
      onDataRefresh: (pit, match) => {
        setPitData(pit);
        setMatchData(match);
      },
      onQueueDrained: () => setPendingSync(0),
    });
    syncRef.current = sync;
    return () => { sync.stop(); syncRef.current = null; };
  }, []);

  const exportToCSV = useCallback(() => {
    const pitHeaders = "Team#,L,W,H,Weight,RoleAssessed,Archetype,ShooterConfig,Batteries,DriveType,Motors,Ratio,Exp,Ground,Outpost,Depot,Corral,Capacity,Preload,Bump,Trench,ShootOnMove,Feed,Rate,Trajectory,Extensions,AutoAlign,ClimbLvl,AutoClimb,ClimbTime,Notes";
    const pitRows = (Object.values(pitData) as PitData[]).map((d: PitData) => [
      d.teamNumber, d.dimensions.length, d.dimensions.width, d.dimensions.height, d.weight, d.selfAssessedRole, d.archetype, d.shooterCountType, d.numBatteries,
      d.drivetrain.type, d.drivetrain.motors, d.drivetrain.swerveRatio, d.driverExperience,
      d.pickups.ground, d.pickups.outpost, d.pickups.depot, d.canCorralDrop, d.gamePieceCapacity, d.maxPreload,
      d.obstacles.crossBump, d.obstacles.crossTrench, d.scoring.shootOnMove, d.scoring.canFeed, d.scoring.scoringRate, d.scoring.changeTrajectory, d.extensions, d.scoring.autoAlign,
      d.climb.maxLevel, d.climb.canAutoClimb, d.climb.climbTime, `"${d.comments.replace(/"/g, '""')}"`
    ].join(','));

    const matchHeaders = "Match#,Team#,NoShow,StartPos,AutoRole,AutoAcc,AutoLeave,AutoClimb,TeleRole,TeleAcc,TeleCollection,EndClimb,Died,MinorFouls,MajorFouls,OffenseSkill,DefenseSkill,TransitionSpeed,PrimaryZone,Energized,Supercharged,Traversal,WonMatch,Comments";
    const matchRows = matchData.map(d => [
      d.matchNumber, d.teamNumber, d.noShow, d.startingPosition, d.autoRole, d.autoAccuracy, d.autoLeave, d.autoClimbLevel,
      d.teleopRole, d.teleopAccuracy, `"${d.teleopCollection.join('|')}"`, d.climbLevel, d.died, d.minorFouls, d.majorFouls, d.offensiveSkill, d.defensiveSkill, d.transitionQuickness, d.primaryZone, d.energized, d.supercharged, d.traversal, d.wonMatch, `"${d.comments.replace(/"/g, '""')}"`
    ].join(','));

    const csvContent = `PIT SCOUTING\n${pitHeaders}\n${pitRows.join('\n')}\n\nMATCH SCOUTING\n${matchHeaders}\n${matchRows.join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smoky_scout_export_v6.csv`;
    a.click();
  }, [pitData, matchData]);

  const handleTeamClick = (team: Team) => {
    setSelectedTeam(team);
    setView('team_detail');
  };

  const handleTbaSeasonChange = (season: number) => {
    void handleTbaEventChange(season, null);
  };

  const handleTbaEventChange = async (season: number, eventKey: string | null) => {
    setSelectedSeason(season);
    setSelectedEventKey(eventKey || '');
    setSelectedTeam(null);
    try {
      await saveTbaContext({ season, eventKey });
    } catch {
      // continue with local context if server write fails
    }
    localStorage.setItem(STORAGE_KEY_TBA_CONTEXT, JSON.stringify({ season, eventKey }));
  };

  const getRoleIcon = (role: string) => {
    switch(role) {
      case 'Shooter': return <Target className="w-3 h-3" />;
      case 'Feeder': return <Hand className="w-3 h-3" />;
      case 'Defense': return <Shield className="w-3 h-3" />;
      default: return null;
    }
  };

  const filteredTeams = teamSource.filter(t => 
    t.number.toString().includes(searchQuery) || t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedTeamSource = [...teamSource].sort((a, b) => a.number - b.number);

  return (
    <div className="min-h-screen flex flex-col pb-24 text-slate-100">
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/team-logo.png" alt="HSU Werx 8778" className="w-10 h-10 rounded-lg" />
          <h1 className="font-header text-2xl tracking-tight leading-none">HSUWERX 8778</h1>
        </div>
        <div className="flex items-center gap-3">
          <SyncStatus isConnected={isConnected} pendingCount={pendingSync} />
          <Button variant="ghost" size="sm" onClick={exportToCSV}>
            <Download className="w-5 h-5 mr-2" /> Export
          </Button>
        </div>
      </header>

      {qrModalData && <QRCodeModal data={qrModalData} onClose={() => setQrModalData(null)} />}
      {pinModal && (
        <PinPad
          title={pinModal.title}
          onSubmit={pinModal.onSubmit}
          onCancel={() => setPinModal(null)}
        />
      )}

      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full">
        {view === 'dashboard' && (
          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input 
                type="text"
                placeholder="Search team..."
                className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-slate-100 placeholder:text-slate-600 focus:border-blue-600 focus:outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              {filteredTeams.map(team => {
                const teamPit = pitData[team.number];
                const isPitComplete = !!teamPit;

                return (
                  <button
                    key={team.number}
                    onClick={() => handleTeamClick(team)}
                    className={`flex flex-col p-4 bg-slate-900 border-2 rounded-2xl active:scale-[0.98] transition-all text-left ${
                      isPitComplete ? 'border-slate-800' : 'border-amber-500/30 bg-amber-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-3">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center border font-bold text-xl leading-none transition-colors ${
                          isPitComplete ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        }`}>
                          {team.number}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-100">{team.name}</h3>
                          <p className="text-xs text-slate-500 font-mono">{team.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPitComplete ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-[10px] font-bold text-green-500 uppercase">Pit Ready</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-[10px] font-bold text-amber-500 uppercase">Missing Pit</span>
                          </div>
                        )}
                        <ChevronRight className="w-5 h-5 text-slate-700" />
                      </div>
                    </div>

                    {isPitComplete && (
                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 mt-1 py-3 px-4 bg-slate-950/40 rounded-xl border border-slate-800/50">
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Drive Type</span>
                          <span className="text-xs font-semibold text-slate-300 truncate">{teamPit.drivetrain.type}</span>
                        </div>
                        <div className="flex flex-col border-l border-slate-800/50 pl-3">
                          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Intended Role</span>
                          <div className="flex items-center gap-1 text-xs font-semibold text-blue-400">
                            {getRoleIcon(teamPit.selfAssessedRole)}
                            <span className="truncate">{teamPit.selfAssessedRole}</span>
                          </div>
                        </div>
                        <div className="flex flex-col border-t border-slate-800/50 pt-2">
                          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Fuel Rate</span>
                          <span className="text-xs font-semibold text-slate-300 truncate">
                            {teamPit.scoring.scoringRate ? `${teamPit.scoring.scoringRate} FPS` : 'N/A'}
                          </span>
                        </div>
                        <div className="flex flex-col border-t border-l border-slate-800/50 pt-2 pl-3">
                          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Climb Level</span>
                          <span className="text-xs font-semibold text-slate-300 truncate">
                            {teamPit.climb.maxLevel !== 'None' ? `${teamPit.climb.maxLevel} (${teamPit.climb.climbTime})` : 'None'}
                          </span>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {view === 'team_detail' && selectedTeam && (
          <TeamDetail
            team={selectedTeam}
            pit={pitData[selectedTeam.number]}
            matches={matchData.filter(m => m.teamNumber === selectedTeam.number)}
            onBack={() => setView('dashboard')}
            onPitClick={() => setView('pit')}
            onMatchClick={() => setView('match')}
            onShowMatchQR={(m) => setQrModalData(encodeMatchData(m))}
            onShowPitQR={(p) => setQrModalData(encodePitData(p))}
            onEditMatch={(m) => {
              requirePin('edit', (pin) => {
                setEditingMatch(m);
                setView('match');
              });
            }}
            onDeleteMatch={(m) => {
              requirePin('edit', (pin) => {
                if (!confirm(`Delete Match #${m.matchNumber}?`)) return;
                deleteMatchData(m.id, pin).catch(() => {});
                setMatchData(prev => prev.filter(x => x.id !== m.id));
              });
            }}
            onDeletePit={() => {
              requirePin('edit', (pin) => {
                if (!confirm(`Delete pit data for Team ${selectedTeam.number}?`)) return;
                deletePitData(selectedTeam.number, pin).catch(() => {});
                setPitData(prev => {
                  const next = { ...prev };
                  delete next[selectedTeam.number];
                  return next;
                });
              });
            }}
          />
        )}

        {view === 'pit' && selectedTeam && (
          <PitScoutingForm
            team={selectedTeam}
            initialData={pitData[selectedTeam.number]}
            onSave={(d) => {
              setPitData(prev => ({...prev, [d.teamNumber]: d}));
              savePitData(d).catch(() => {
                addToSyncQueue({ type: 'pit', data: d });
                setPendingSync(getSyncQueue().length);
              });
              setView('team_detail');
            }}
            onCancel={() => setView('team_detail')}
          />
        )}

        {view === 'match' && selectedTeam && (
          <MatchScoutingForm
            team={selectedTeam}
            initialData={editingMatch || undefined}
            onSave={(d) => {
              if (editingMatch) {
                const pin = getCachedPin('edit');
                setMatchData(prev => prev.map(m => m.id === d.id ? d : m));
                if (pin) updateMatchDataOnServer(d, pin).catch(() => {});
                setEditingMatch(null);
              } else {
                setMatchData(prev => [d, ...prev]);
                saveMatchData(d).catch(() => {
                  addToSyncQueue({ type: 'match', data: d });
                  setPendingSync(getSyncQueue().length);
                });
                setQrModalData(encodeMatchData(d));
              }
              setView('team_detail');
            }}
            onCancel={() => { setEditingMatch(null); setView('team_detail'); }}
          />
        )}

        {view === 'strategy' && <StrategyLab pitData={pitData} matchData={matchData} availableTeams={sortedTeamSource} selectedSeason={selectedSeason} selectedEventKey={selectedEventKey} blue={stratBlue} setBlue={setStratBlue} red={stratRed} setRed={setStratRed} tbaTeamData={stratTbaData} setTbaTeamData={setStratTbaData} isConnected={isConnected} />}

        {view === 'scanner' && (
          <QRScanner
            onImport={(decoded) => {
              if (decoded.matches.length > 0) {
                setMatchData(prev => {
                  let updated = [...prev];
                  for (const d of decoded.matches) {
                    const idx = updated.findIndex(m => m.matchNumber === d.matchNumber && m.teamNumber === d.teamNumber);
                    if (idx >= 0) {
                      if (d.timestamp > updated[idx].timestamp) {
                        updated[idx] = d;
                      }
                    } else {
                      updated = [d, ...updated];
                    }
                  }
                  return updated;
                });
                for (const d of decoded.matches) {
                  saveMatchData(d).catch(() => {
                    addToSyncQueue({ type: 'match', data: d });
                    setPendingSync(getSyncQueue().length);
                  });
                }
              }
              if (decoded.pits.length > 0) {
                setPitData(prev => {
                  const next = { ...prev };
                  for (const p of decoded.pits) {
                    if (!next[p.teamNumber] || p.lastUpdated > next[p.teamNumber].lastUpdated) {
                      next[p.teamNumber] = p;
                    }
                  }
                  return next;
                });
                for (const p of decoded.pits) {
                  savePitData(p).catch(() => {
                    addToSyncQueue({ type: 'pit', data: p });
                    setPendingSync(getSyncQueue().length);
                  });
                }
              }
            }}
            onBack={() => setView(scannerReturnView.current)}
            onViewTeam={(teamNumber) => {
              const team = teamSource.find(t => t.number === teamNumber);
              if (team) {
                setSelectedTeam(team);
                setView('team_detail');
              }
            }}
          />
        )}

        {view === 'rankings' && (
          <RankingsView matchData={matchData} pitData={pitData} availableTeams={sortedTeamSource} tbaTeamData={stratTbaData} />
        )}

        {view === 'settings' && (
          <ConfigView
            matchData={matchData}
            pitData={pitData}
            isConnected={isConnected}
            events={tbaEvents}
            selectedSeason={selectedSeason}
            selectedEventKey={selectedEventKey}
            isLoadingTba={tbaLoading}
            onSetSeason={handleTbaSeasonChange}
            onShowQR={(data) => setQrModalData(data)}
            onScanQR={() => { scannerReturnView.current = 'settings'; setView('scanner'); }}
            onClearData={() => {
              requirePin('admin', (pin) => {
                if (!isConnected) {
                  alert('Cannot clear all data while offline. Server data would remain.');
                  return;
                }
                if (!confirm('This will permanently delete ALL pit and match data from the server and this device. Are you sure?')) return;
                syncRef.current?.pause();
                clearAllServerData(pin).then(() => {
                  setPitData({});
                  setMatchData([]);
                  localStorage.removeItem(STORAGE_KEY_PIT);
                  localStorage.removeItem(STORAGE_KEY_MATCH);
                  setTimeout(() => syncRef.current?.resume(), 2000);
                }).catch(() => {
                  alert('Failed to clear server data.');
                  syncRef.current?.resume();
                });
              });
            }}
          />
        )}

        {view === 'tba' && (
          <TBAView
            eventKey={selectedEventKey}
            events={tbaEvents}
            selectedSeason={selectedSeason}
            isLoadingEvents={tbaLoading.events}
            onSetEvent={handleTbaEventChange}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800 px-6 py-4 flex justify-around items-center z-50">
        <NavButton active={view === 'dashboard' || view === 'team_detail'} onClick={() => setView('dashboard')} icon={<Users className="w-6 h-6" />} label="Teams" />
        <NavButton active={view === 'strategy'} onClick={() => setView('strategy')} icon={<BrainCircuit className="w-6 h-6" />} label="Strategy" />
        <NavButton active={view === 'tba'} onClick={() => setView('tba')} icon={<Globe className="w-6 h-6" />} label="TBA" />
        <NavButton active={view === 'rankings'} onClick={() => setView('rankings')} icon={<Trophy className="w-6 h-6" />} label="Rankings" />
        <NavButton active={view === 'settings'} onClick={() => setView('settings')} icon={<Settings className="w-6 h-6" />} label="Config" />
      </nav>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-blue-500' : 'text-slate-500'}`}>
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
  </button>
);

const TeamDetail: React.FC<{
  team: Team, pit?: PitData, matches: MatchData[], onBack: () => void, onPitClick: () => void, onMatchClick: () => void,
  onShowMatchQR: (m: MatchData) => void, onShowPitQR: (p: PitData) => void, onEditMatch: (m: MatchData) => void, onDeleteMatch: (m: MatchData) => void, onDeletePit: () => void
}> = ({ team, pit, matches, onBack, onPitClick, onMatchClick, onShowMatchQR, onShowPitQR, onEditMatch, onDeleteMatch, onDeletePit }) => (
  <div className="space-y-8 animate-in fade-in duration-300">
    <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-semibold"><ArrowLeft className="w-5 h-5" /> Dashboard</button>
    <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-8 shadow-2xl">
      <h2 className="text-4xl font-header text-white mb-2">TEAM {team.number}</h2>
      <p className="text-slate-500 font-mono">{team.name} • {team.location}</p>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Button size="lg" className="flex-col h-32 gap-3" onClick={onPitClick}>
        <ClipboardCheck className={`w-8 h-8 ${pit ? 'text-green-500' : ''}`} />
        {pit ? 'Edit Pit Data' : 'Add Pit Data'}
      </Button>
      <Button size="lg" variant="outline" className="flex-col h-32 gap-3" onClick={onMatchClick}><Plus className="w-8 h-8 text-blue-500" /> Log Match</Button>
    </div>
    {pit && (
      <div className="flex justify-between items-center">
        <button onClick={() => onShowPitQR(pit)} className="text-xs text-blue-400/60 hover:text-blue-400 transition-colors flex items-center gap-1">
          <QrCode className="w-3 h-3" /> Share Pit Data
        </button>
        <button onClick={onDeletePit} className="text-xs text-red-400/60 hover:text-red-400 transition-colors flex items-center gap-1">
          <Trash2 className="w-3 h-3" /> Delete Pit Data
        </button>
      </div>
    )}
    <div className="space-y-4">
      <h3 className="font-header text-2xl text-slate-200">History</h3>
      {matches.length === 0 ? <p className="text-slate-600 italic">No matches logged.</p> : (
        <div className="space-y-3">
          {matches.map(m => (
            <div key={m.id} className="p-4 bg-slate-900 border-2 border-slate-800 rounded-2xl flex items-center gap-3">
              <div className="flex-1">
                <p className="font-bold text-blue-400">Match #{m.matchNumber}</p>
                <p className="text-xs text-slate-500 uppercase">{m.noShow ? 'No Show' : `${m.teleopRole} | ${m.teleopAccuracy}`}</p>
              </div>
              <div className="text-right flex-1">
                <p className="font-bold text-slate-300">{m.noShow ? '-' : `Climb: ${m.climbLevel} | ${m.wonMatch ? 'Won' : 'Lost'}`}</p>
              </div>
              <button onClick={() => onShowMatchQR(m)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors">
                <QrCode className="w-5 h-5 text-blue-400" />
              </button>
              <CardMenu onEdit={() => onEditMatch(m)} onDelete={() => onDeleteMatch(m)} />
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const PitScoutingForm: React.FC<{ team: Team, initialData?: PitData, onSave: (d: PitData) => void, onCancel: () => void }> = ({ team, initialData, onSave, onCancel }) => {
  const [data, setData] = useState<PitData>(initialData || {
    teamNumber: team.number,
    dimensions: { length: '', width: '', height: '' },
    weight: '',
    archetype: 'Stationary',
    shooterCountType: 'Single',
    archetypeOther: '',
    numBatteries: '',
    drivetrain: { type: 'Swerve', motors: 'NEO', swerveRatio: '' },
    driverExperience: '',
    pickups: { ground: false, outpost: false, depot: false },
    canCorralDrop: false,
    gamePieceCapacity: '1',
    maxPreload: '1',
    obstacles: { crossBump: false, crossTrench: false },
    scoring: { 
      shootOnMove: false,
      canFeed: false, 
      minDistance: '', 
      maxDistance: '', 
      comfortableZones: [], 
      scoringRate: '', 
      autoAlign: false,
      changeTrajectory: false
    },
    extensions: false,
    autoDescription: '',
    climb: { 
      maxLevel: 'None', 
      canAutoClimb: false,
      climbTime: '' 
    },
    selfAssessedRole: 'N/A',
    comments: '',
    lastUpdated: Date.now()
  });

  return (
    <div className="space-y-12 pb-24">
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <h2 className="text-3xl font-header tracking-tight">PIT: {team.number}</h2>
        <Button variant="ghost" onClick={onCancel}>Discard</Button>
      </div>

      <Section title="Robot Intent" icon={<UserCheck className="w-4 h-4" />}>
        <RadioGroup 
          label="What role does the team believe they play?" 
          options={['Shooter', 'Feeder', 'Defense', 'N/A']} 
          value={data.selfAssessedRole} 
          onChange={v => setData({...data, selfAssessedRole: v as any})} 
        />
      </Section>

      <Section title="Drivetrain" icon={<Cpu className="w-4 h-4" />}>
        <RadioGroup label="Drive Type" options={DRIVETRAIN_TYPES} value={data.drivetrain.type} onChange={v => setData({...data, drivetrain: {...data.drivetrain, type: v}})} />
        <RadioGroup label="Motors" options={MOTOR_TYPES} value={data.drivetrain.motors} onChange={v => setData({...data, drivetrain: {...data.drivetrain, motors: v}})} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Ratio (if Swerve)" value={data.drivetrain.swerveRatio} onChange={e => setData({...data, drivetrain: {...data.drivetrain, swerveRatio: e.target.value}})} />
          <Input label="Driver Exp (Years)" type="number" value={data.driverExperience} onChange={e => setData({...data, driverExperience: e.target.value})} />
        </div>
      </Section>

      <Section title="Dimensions & Mechanical" icon={<Ruler className="w-4 h-4" />}>
        <div className="grid grid-cols-3 gap-2">
          <Input label="Length (in)" value={data.dimensions.length} onChange={e => setData({...data, dimensions: {...data.dimensions, length: e.target.value}})} />
          <Input label="Width (in)" value={data.dimensions.width} onChange={e => setData({...data, dimensions: {...data.dimensions, width: e.target.value}})} />
          <Input label="Height (in)" value={data.dimensions.height} onChange={e => setData({...data, dimensions: {...data.dimensions, height: e.target.value}})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Weight (lbs)" value={data.weight} onChange={e => setData({...data, weight: e.target.value})} />
          <Input label="# of Batteries" type="number" value={data.numBatteries} onChange={e => setData({...data, numBatteries: e.target.value})} />
        </div>
        <Toggle label="Robot Extends Out of Bumper?" checked={data.extensions} onChange={v => setData({...data, extensions: v})} />
      </Section>

      <Section title="Archetype & Config" icon={<Layout className="w-4 h-4" />}>
        <RadioGroup label="Robot Archetype" options={ARCHETYPES} value={data.archetype} onChange={v => setData({...data, archetype: v})} />
        <RadioGroup label="Shooter Config" options={['Single', 'Multi', 'N/A']} value={data.shooterCountType} onChange={v => setData({...data, shooterCountType: v as any})} />
      </Section>

      <Section title="Game Piece Handling" icon={<Target className="w-4 h-4" />}>
        <div className="grid grid-cols-1 gap-3">
          <Toggle label="Floor Pickup" checked={data.pickups.ground} onChange={v => setData({...data, pickups: {...data.pickups, ground: v}})} />
          <Toggle label="Depot Pickup" checked={data.pickups.depot} onChange={v => setData({...data, pickups: {...data.pickups, depot: v}})} />
          <Toggle label="Outpost Pickup" checked={data.pickups.outpost} onChange={v => setData({...data, pickups: {...data.pickups, outpost: v}})} />
          <Toggle label="Corral Drop Off Capability" checked={data.canCorralDrop} onChange={v => setData({...data, canCorralDrop: v})} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Input label="Scoring Rate (FPS)" value={data.scoring.scoringRate} onChange={e => setData({...data, scoring: {...data.scoring, scoringRate: e.target.value}})} />
          <Input label="Piece Capacity" type="number" value={data.gamePieceCapacity} onChange={e => setData({...data, gamePieceCapacity: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Toggle label="Shoot on Move" checked={data.scoring.shootOnMove} onChange={v => setData({...data, scoring: {...data.scoring, shootOnMove: v}})} />
          <Toggle label="Auto Align" checked={data.scoring.autoAlign} onChange={v => setData({...data, scoring: {...data.scoring, autoAlign: v}})} />
          <Toggle label="Change Trajectory" checked={data.scoring.changeTrajectory} onChange={v => setData({...data, scoring: {...data.scoring, changeTrajectory: v}})} />
          <Toggle label="Under Trench" checked={data.obstacles.crossTrench} onChange={v => setData({...data, obstacles: {...data.obstacles, crossTrench: v}})} />
        </div>
      </Section>

      <Section title="Climbing" icon={<Activity className="w-4 h-4" />}>
        <RadioGroup label="Climb Level (Manual)" options={['None', 'L1', 'L2', 'L3']} value={data.climb.maxLevel} onChange={v => setData({...data, climb: {...data.climb, maxLevel: v}})} />
        <div className="pt-4 flex flex-col gap-4">
          <Toggle label="Can Climb in Auto?" checked={data.climb.canAutoClimb} onChange={v => setData({...data, climb: {...data.climb, canAutoClimb: v}})} />
          <Input label="Climb Time to Max (seconds)" placeholder="e.g. 15s" value={data.climb.climbTime} onChange={e => setData({...data, climb: {...data.climb, climbTime: e.target.value}})} />
        </div>
      </Section>

      <div className="space-y-2">
        <label className="text-xs font-bold uppercase text-slate-500">Comments</label>
        <textarea className="w-full h-32 bg-slate-900 border-2 border-slate-800 rounded-2xl p-4 text-slate-100" placeholder="Driver notes, mechanism reliability, etc." value={data.comments} onChange={e => setData({...data, comments: e.target.value})} />
      </div>

      <div className="fixed bottom-24 left-4 right-4 z-40">
        <Button size="lg" className="w-full shadow-2xl h-16" onClick={() => onSave({...data, lastUpdated: Date.now()})}>Save Pit Data</Button>
      </div>
    </div>
  );
};

const MatchScoutingForm: React.FC<{ team: Team, initialData?: MatchData, onSave: (d: MatchData) => void, onCancel: () => void }> = ({ team, initialData, onSave, onCancel }) => {
  const [phase, setPhase] = useState<'pre' | 'auto' | 'tele' | 'post'>('pre');
  const [matchNum, setMatchNum] = useState<number>(initialData?.matchNumber ?? 1);
  const [startingPos, setStartingPos] = useState<StartingPosition>(initialData?.startingPosition ?? 'Middle');
  const [noShow, setNoShow] = useState(initialData?.noShow ?? false);

  // Auto
  const [autoRole, setAutoRole] = useState<MatchRole>(initialData?.autoRole ?? MatchRole.SHOOTER);
  const [autoAccuracy, setAutoAccuracy] = useState<Accuracy>(initialData?.autoAccuracy ?? Accuracy.BETWEEN_50_80);
  const [autoLeave, setAutoLeave] = useState(initialData?.autoLeave ?? false);
  const [autoClimbLevel, setAutoClimbLevel] = useState(initialData?.autoClimbLevel ?? 0);

  // Teleop
  const [teleopRole, setTeleopRole] = useState<MatchRole>(initialData?.teleopRole ?? MatchRole.SHOOTER);
  const [teleopAccuracy, setTeleopAccuracy] = useState<Accuracy>(initialData?.teleopAccuracy ?? Accuracy.BETWEEN_50_80);
  const [teleopCollection, setTeleopCollection] = useState<string[]>(initialData?.teleopCollection ?? []);

  // Post/Endgame
  const [offenseSkill, setOffenseSkill] = useState(initialData?.offensiveSkill ?? 3);
  const [defenseSkill, setDefenseSkill] = useState(initialData?.defensiveSkill ?? 3);
  const [transitionQuickness, setTransitionQuickness] = useState(initialData?.transitionQuickness ?? 3);
  const [primaryZone, setPrimaryZone] = useState(initialData?.primaryZone ?? 'Neutral');
  const [climbLevel, setClimbLevel] = useState(initialData?.climbLevel ?? 0);
  const [died, setDied] = useState(initialData?.died ?? false);
  const [minorFouls, setMinorFouls] = useState(initialData?.minorFouls ?? 0);
  const [majorFouls, setMajorFouls] = useState(initialData?.majorFouls ?? 0);
  const [comments, setComments] = useState(initialData?.comments ?? '');

  // Alliance Outcomes
  const [energized, setEnergized] = useState(initialData?.energized ?? false);
  const [supercharged, setSupercharged] = useState(initialData?.supercharged ?? false);
  const [traversal, setTraversal] = useState(initialData?.traversal ?? false);
  const [wonMatch, setWonMatch] = useState(initialData?.wonMatch ?? false);

  const handleSave = () => {
    onSave({
      id: initialData?.id ?? crypto.randomUUID(),
      matchNumber: matchNum,
      teamNumber: team.number,
      startingPosition: startingPos,
      noShow,
      autoRole, autoAccuracy, autoLeave, autoClimbLevel,
      teleopRole, teleopAccuracy, teleopCollection,
      climbLevel, died, minorFouls, majorFouls,
      offensiveSkill: offenseSkill,
      defensiveSkill: defenseSkill,
      transitionQuickness, primaryZone,
      energized, supercharged, traversal, wonMatch,
      comments,
      timestamp: Date.now()
    });
  };

  const toggleCollection = (type: string) => {
    setTeleopCollection(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const navStyles = "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border-b-4 transition-all";

  // Role helper for Teleop
  const handleTeleRoleChange = (role: string) => {
    const r = role as MatchRole;
    setTeleopRole(r);
    if (r === MatchRole.DEFENSE) {
      setTeleopAccuracy(Accuracy.NA);
    } else if (teleopAccuracy === Accuracy.NA) {
      setTeleopAccuracy(Accuracy.BETWEEN_50_80);
    }
  };

  const teleAccuracyLabel = teleopRole === MatchRole.SHOOTER 
    ? "Shooting Accuracy" 
    : teleopRole === MatchRole.FEEDER 
      ? "Feeding / Fuel Distribution Accuracy" 
      : "Accuracy";

  return (
    <div className="space-y-8 pb-32">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-header">{initialData ? 'EDIT' : 'LOG'} MATCH: {team.number}</h2>
        <Button variant="ghost" size="sm" onClick={onCancel}>Discard</Button>
      </div>

      <div className="flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden sticky top-[80px] z-50 shadow-xl backdrop-blur-md">
        <button onClick={() => setPhase('pre')} className={`${navStyles} ${phase === 'pre' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-transparent text-slate-500'}`}><Timer className="w-4 h-4 mx-auto mb-1" /> Pre</button>
        <button disabled={noShow} onClick={() => setPhase('auto')} className={`${navStyles} ${phase === 'auto' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-transparent text-slate-500'} ${noShow ? 'opacity-30' : ''}`}><Play className="w-4 h-4 mx-auto mb-1" /> Auto</button>
        <button disabled={noShow} onClick={() => setPhase('tele')} className={`${navStyles} ${phase === 'tele' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-transparent text-slate-500'} ${noShow ? 'opacity-30' : ''}`}><Gamepad2 className="w-4 h-4 mx-auto mb-1" /> Tele</button>
        <button onClick={() => setPhase('post')} className={`${navStyles} ${phase === 'post' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-transparent text-slate-500'}`}><Flag className="w-4 h-4 mx-auto mb-1" /> <span className="hidden sm:inline">ENDGAME</span><span className="sm:hidden">END</span></button>
      </div>

      <div className="space-y-10 animate-in fade-in duration-300">
        {phase === 'pre' && (
          <div className="space-y-8">
            <Input label="Match Number" type="number" value={matchNum} onChange={e => setMatchNum(parseInt(e.target.value) || 0)} />
            <RadioGroup label="Starting Position" options={['Outpost', 'Middle', 'Depot']} value={startingPos} onChange={v => setStartingPos(v as StartingPosition)} />
            <div className="pt-4">
              <Toggle label="No Show?" checked={noShow} onChange={(v) => {
                setNoShow(v);
                if (v) setPhase('post');
              }} />
            </div>
          </div>
        )}

        {!noShow && phase === 'auto' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-6 bg-slate-900/40 p-6 rounded-3xl border border-slate-800/50">
              <RadioGroup label="Auto Role" options={[MatchRole.SHOOTER, MatchRole.FEEDER, MatchRole.DEFENSE]} value={autoRole} onChange={v => setAutoRole(v as MatchRole)} />
              <RadioGroup label="Auto Shooting Accuracy" options={[Accuracy.BELOW_50, Accuracy.BETWEEN_50_80, Accuracy.ABOVE_80, Accuracy.NA]} value={autoAccuracy} onChange={v => setAutoAccuracy(v as Accuracy)} />
              <div className="pt-4">
                <Toggle label="Left Zone (Move?)" checked={autoLeave} onChange={setAutoLeave} />
              </div>
            </div>
            
            <Section title="Auto Climb Level" noBorder icon={<Activity className="w-4 h-4" />}>
              <RadioGroup label="Climb Lvl" options={['None', 'L1', 'L2', 'L3']} value={autoClimbLevel === 0 ? 'None' : `L${autoClimbLevel}`} onChange={v => setAutoClimbLevel(v === 'None' ? 0 : parseInt(v.split('L')[1]))} />
            </Section>
          </div>
        )}

        {!noShow && phase === 'tele' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-6 bg-slate-900/40 p-6 rounded-3xl border border-slate-800/50">
              <RadioGroup 
                label="Teleop Role" 
                options={[MatchRole.SHOOTER, MatchRole.FEEDER, MatchRole.DEFENSE]} 
                value={teleopRole} 
                onChange={handleTeleRoleChange} 
              />
              <div className={teleopRole === MatchRole.DEFENSE ? 'opacity-40 pointer-events-none' : ''}>
                <RadioGroup 
                  label={teleAccuracyLabel} 
                  options={[Accuracy.BELOW_50, Accuracy.BETWEEN_50_80, Accuracy.ABOVE_80, Accuracy.NA]} 
                  value={teleopAccuracy} 
                  onChange={v => setTeleopAccuracy(v as Accuracy)} 
                />
              </div>
            </div>
            <Section title="Fuel Collection" noBorder icon={<Flame className="w-4 h-4" />}>
              <div className="grid grid-cols-2 gap-4">
                <Toggle label="Ground Pickup" checked={teleopCollection.includes('Ground')} onChange={() => toggleCollection('Ground')} />
                <Toggle label="Player Station" checked={teleopCollection.includes('Player Station')} onChange={() => toggleCollection('Player Station')} />
              </div>
            </Section>
          </div>
        )}

        {phase === 'post' && (
          <div className="space-y-8">
            {!noShow && (
              <>
                <Section title="Endgame Climb" noBorder icon={<Flag className="w-4 h-4" />}>
                  <RadioGroup label="Endgame Climb Level" options={['None', 'Lvl 1', 'Lvl 2', 'Lvl 3']} value={climbLevel === 0 ? 'None' : `Lvl ${climbLevel}`} onChange={v => setClimbLevel(v === 'None' ? 0 : parseInt(v.split(' ')[1]))} />
                </Section>
                <Section title="Alliance Performance" noBorder icon={<Zap className="w-4 h-4" />}>
                  <div className="grid grid-cols-2 gap-4">
                    <Toggle label="Energized" checked={energized} onChange={setEnergized} />
                    <Toggle label="Supercharged" checked={supercharged} onChange={setSupercharged} />
                    <Toggle label="Traversal" checked={traversal} onChange={setTraversal} />
                    <Toggle label="Won Match" checked={wonMatch} onChange={setWonMatch} />
                  </div>
                </Section>
              </>
            )}

            <Section title="Fouls & Technicals" noBorder icon={<AlertTriangle className="w-4 h-4" />}>
              <div className="grid grid-cols-1 gap-4">
                <Counter label="# of Minors" value={minorFouls} onChange={setMinorFouls} />
                <Counter label="# of Majors" value={majorFouls} onChange={setMajorFouls} />
              </div>
            </Section>

            {!noShow && (
              <>
                <Section title="Subjective Assessment" noBorder icon={<Star className="w-4 h-4" />}>
                  <div className="grid grid-cols-1 gap-6">
                    <SkillSlider label="Offensive Skill" value={offenseSkill} onChange={setOffenseSkill} />
                    <SkillSlider label="Defensive Skill" value={defenseSkill} onChange={setDefenseSkill} />
                    <SkillSlider label="Transition Speed" value={transitionQuickness} onChange={setTransitionQuickness} />
                  </div>
                </Section>

                <Section title="Field Positioning" noBorder icon={<MapPin className="w-4 h-4" />}>
                   <RadioGroup 
                    label="Primary Operating Zone" 
                    options={['Shooting Alliance', 'Neutral', 'Defensive Alliance']} 
                    value={primaryZone} 
                    onChange={setPrimaryZone} 
                  />
                  <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mt-6">
                    <Toggle label="Robot Died / Tipped / Disabled?" checked={died} onChange={setDied} />
                  </div>
                </Section>
              </>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500">Subjective Observations</label>
              <textarea className="w-full h-32 bg-slate-900 border-2 border-slate-800 rounded-2xl p-4 text-slate-100" placeholder={noShow ? "Add reasons for No Show..." : "Notes on driver agility, mechanical failures, or specific playstyles..."} value={comments} onChange={e => setComments(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-24 left-4 right-4 z-40 flex gap-3">
        {phase === 'post' ? (
          <Button size="lg" className="w-full h-16 shadow-2xl" onClick={handleSave}>{initialData ? 'Save Changes' : 'Submit Match Report'}</Button>
        ) : (
          <Button size="lg" className="w-full h-16 shadow-2xl" onClick={() => {
            if (phase === 'pre') setPhase(noShow ? 'post' : 'auto');
            else if (phase === 'auto') setPhase('tele');
            else setPhase('post');
          }}>{phase === 'tele' ? 'Finish Match' : 'Next Phase'}</Button>
        )}
      </div>
    </div>
  );
};

const SkillSlider: React.FC<{ label: string, value: number, onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div className="space-y-3">
    <div className="flex justify-between items-center">
      <label className="text-xs font-bold uppercase text-slate-400">{label}</label>
      <span className="text-blue-400 font-bold">{value}/5</span>
    </div>
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map(v => (
        <button 
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`flex-1 h-10 rounded-lg font-bold transition-all ${value === v ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
        >
          {v}
        </button>
      ))}
    </div>
  </div>
);

const TeamPicker: React.FC<{ teams: number[], setTeams: React.Dispatch<React.SetStateAction<number[]>>, index: number, allTeams: Team[] }> = ({ teams, setTeams, index, allTeams }) => {
  const [manualInput, setManualInput] = useState('');
  const currentValue = teams[index];
  const isManual = currentValue > 0 && !allTeams.some(t => t.number === currentValue);

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <select
          className="w-full bg-slate-900 border-2 border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-sm focus:border-blue-600 focus:outline-none appearance-none"
          value={isManual ? 0 : currentValue}
          onChange={(e) => {
            const next = [...teams];
            next[index] = parseInt(e.target.value) || 0;
            setTeams(next);
            setManualInput('');
          }}
        >
          <option value={0}>{isManual ? `Manual: ${currentValue}` : 'Select Team'}</option>
          {allTeams.map(t => (
            <option key={t.number} value={t.number}>{t.number} | {t.name}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
          <ChevronRight className="w-4 h-4 rotate-90" />
        </div>
      </div>
      <input
        type="number"
        placeholder="Team #"
        className="w-20 bg-slate-900 border-2 border-slate-800 rounded-xl px-2 py-2 text-slate-100 text-sm text-center focus:border-blue-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        value={manualInput}
        onChange={(e) => {
          const val = e.target.value;
          setManualInput(val);
          const num = parseInt(val, 10);
          if (num > 0) {
            const next = [...teams];
            next[index] = num;
            setTeams(next);
          } else if (val === '') {
            const next = [...teams];
            next[index] = 0;
            setTeams(next);
          }
        }}
      />
    </div>
  );
};

const AllianceStats: React.FC<{ label: string, color: string, teamNumbers: number[], pitData: Record<number, PitData>, matchData: MatchData[], tbaTeamData?: TbaTeamDataMap }> = ({ label, color, teamNumbers, pitData, matchData, tbaTeamData }) => {
  const validTeams = teamNumbers.filter(n => n > 0);
  if (validTeams.length === 0) return null;

  const allMatches = validTeams.flatMap(n => matchData.filter(m => m.teamNumber === n));

  // TBA fallback when no local match data
  let usingTba = false;
  let tbaWinRate = 'N/A';
  let tbaMatchCount = 0;
  let tbaTeamRecords: Record<number, { wins: number; losses: number; events: number }> = {};
  if (allMatches.length === 0 && tbaTeamData) {
    for (const num of validTeams) {
      const tba = tbaTeamData[num];
      if (tba?.matches && tba.matches.length > 0) {
        const teamKey = `frc${num}`;
        let wins = 0, losses = 0;
        tba.matches.forEach(m => {
          if (m.alliances.blue.team_keys.includes(teamKey)) {
            if (m.winning_alliance === 'blue') wins++; else if (m.winning_alliance === 'red') losses++;
          } else if (m.alliances.red.team_keys.includes(teamKey)) {
            if (m.winning_alliance === 'red') wins++; else if (m.winning_alliance === 'blue') losses++;
          }
        });
        tbaTeamRecords[num] = { wins, losses, events: tba.events?.length || 0 };
        tbaMatchCount += tba.matches.length;
      }
    }
    if (tbaMatchCount > 0) {
      usingTba = true;
      const totalWins = Object.values(tbaTeamRecords).reduce((s, r) => s + r.wins, 0);
      const totalDecided = Object.values(tbaTeamRecords).reduce((s, r) => s + r.wins + r.losses, 0);
      tbaWinRate = totalDecided > 0 ? (totalWins / totalDecided * 100).toFixed(0) : 'N/A';
    }
  }

  // Compute TBA aggregate stats when in TBA mode
  let tbaAvgOpr = 'N/A';
  let tbaAvgDpr = 'N/A';
  let tbaAvgCcwm = 'N/A';
  let tbaAvgScore = 'N/A';
  let tbaAvgRank = 'N/A';
  if (usingTba && tbaTeamData) {
    let oprSum = 0, oprCount = 0, dprSum = 0, dprCount = 0, ccwmSum = 0, ccwmCount = 0;
    let scoreSum = 0, scoreCount = 0, rankSum = 0, rankCount = 0;
    for (const num of validTeams) {
      const tba = tbaTeamData[num];
      if (!tba) continue;
      if (tba.opr != null) { oprSum += tba.opr; oprCount++; }
      if (tba.dpr != null) { dprSum += tba.dpr; dprCount++; }
      if (tba.ccwm != null) { ccwmSum += tba.ccwm; ccwmCount++; }
      if (tba.avgScore != null) { scoreSum += tba.avgScore; scoreCount++; }
      if (tba.ranking?.rank != null) { rankSum += tba.ranking.rank; rankCount++; }
    }
    if (oprCount > 0) tbaAvgOpr = (oprSum / oprCount).toFixed(1);
    if (dprCount > 0) tbaAvgDpr = (dprSum / dprCount).toFixed(1);
    if (ccwmCount > 0) tbaAvgCcwm = (ccwmSum / ccwmCount).toFixed(1);
    if (scoreCount > 0) tbaAvgScore = (scoreSum / scoreCount).toFixed(0);
    if (rankCount > 0) tbaAvgRank = (rankSum / rankCount).toFixed(0);
  }

  const winRate = allMatches.length > 0 ? (allMatches.filter(m => m.wonMatch).length / allMatches.length * 100).toFixed(0) : (usingTba ? tbaWinRate : 'N/A');
  const avgOffense = allMatches.length > 0 ? (allMatches.reduce((s, m) => s + m.offensiveSkill, 0) / allMatches.length).toFixed(1) : 'N/A';
  const avgDefense = allMatches.length > 0 ? (allMatches.reduce((s, m) => s + m.defensiveSkill, 0) / allMatches.length).toFixed(1) : 'N/A';
  const avgTransition = allMatches.length > 0 ? (allMatches.reduce((s, m) => s + m.transitionQuickness, 0) / allMatches.length).toFixed(1) : 'N/A';
  const foulRate = allMatches.length > 0 ? ((allMatches.reduce((s, m) => s + m.minorFouls + m.majorFouls, 0) / allMatches.length)).toFixed(1) : 'N/A';

  const climbLevels = allMatches.filter(m => !m.noShow).map(m => m.climbLevel);
  const avgClimb = climbLevels.length > 0 ? (climbLevels.reduce((s, c) => s + c, 0) / climbLevels.length).toFixed(1) : 'N/A';

  const roleCount = { Shooter: 0, Feeder: 0, Defense: 0 };
  allMatches.forEach(m => { if (roleCount[m.teleopRole as keyof typeof roleCount] !== undefined) roleCount[m.teleopRole as keyof typeof roleCount]++; });

  const accCount = { '<50%': 0, '50-80%': 0, '>80%': 0, 'N/A': 0 };
  allMatches.forEach(m => { if (accCount[m.teleopAccuracy as keyof typeof accCount] !== undefined) accCount[m.teleopAccuracy as keyof typeof accCount]++; });

  const borderColor = color === 'blue' ? 'border-blue-500/30' : 'border-red-500/30';
  const bgColor = color === 'blue' ? 'bg-blue-500/5' : 'bg-red-500/5';
  const textColor = color === 'blue' ? 'text-blue-400' : 'text-red-400';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-2xl p-4 space-y-4`}>
      <h4 className={`text-xs font-bold uppercase ${textColor}`}>{label} Alliance Stats ({usingTba ? `${tbaMatchCount} TBA matches` : `${allMatches.length} matches`})</h4>
      {usingTba ? (
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="Win Rate" value={winRate === 'N/A' ? winRate : `${winRate}%`} source="tba" />
          <StatBox label="Avg Rank" value={tbaAvgRank === 'N/A' ? tbaAvgRank : `#${tbaAvgRank}`} source="tba" />
          <StatBox label="OPR" value={tbaAvgOpr} source="tba" />
          <StatBox label="DPR" value={tbaAvgDpr} source="tba" />
          <StatBox label="CCWM" value={tbaAvgCcwm} source="tba" />
          <StatBox label="Avg Score" value={tbaAvgScore} source="tba" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="Win Rate" value={winRate === 'N/A' ? winRate : `${winRate}%`} />
          <StatBox label="Avg Climb" value={avgClimb === 'N/A' ? avgClimb : `L${avgClimb}`} />
          <StatBox label="Fouls/Match" value={foulRate} />
          <StatBox label="Offense" value={`${avgOffense}/5`} />
          <StatBox label="Defense" value={`${avgDefense}/5`} />
          <StatBox label="Transition" value={`${avgTransition}/5`} />
        </div>
      )}
      {allMatches.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950/40 rounded-xl p-3">
            <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Role Breakdown</span>
            <div className="text-xs space-y-0.5">
              <div className="flex justify-between"><span className="text-slate-400">Shooter</span><span className="text-slate-300 font-bold">{roleCount.Shooter}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Feeder</span><span className="text-slate-300 font-bold">{roleCount.Feeder}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Defense</span><span className="text-slate-300 font-bold">{roleCount.Defense}</span></div>
            </div>
          </div>
          <div className="bg-slate-950/40 rounded-xl p-3">
            <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Accuracy Dist.</span>
            <div className="text-xs space-y-0.5">
              <div className="flex justify-between"><span className="text-slate-400">&gt;80%</span><span className="text-green-400 font-bold">{accCount['>80%']}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">50-80%</span><span className="text-yellow-400 font-bold">{accCount['50-80%']}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">&lt;50%</span><span className="text-red-400 font-bold">{accCount['<50%']}</span></div>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {validTeams.map(num => {
          const pit = pitData[num];
          const tm = matchData.filter(m => m.teamNumber === num);
          const tba = tbaTeamData?.[num];
          return (
            <div key={num} className="bg-slate-950/40 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-200">
                  Team {num}
                  {tba?.ranking && <span className="text-blue-400 text-xs font-normal ml-2">Rank #{tba.ranking.rank}</span>}
                </span>
                <span className="text-[10px] text-slate-500">
                  {tm.length > 0 ? `${tm.length} matches` : tba?.ranking ? `${tba.ranking.matches_played} TBA matches` : ''}
                </span>
              </div>
              <div className="text-xs text-slate-400 space-y-0.5">
                {pit && <div>Drive: {pit.drivetrain.type} | Role: {pit.selfAssessedRole} | Climb: {pit.climb.maxLevel} | Rate: {pit.scoring.scoringRate || 'N/A'} FPS</div>}
                {!pit && !tbaTeamRecords[num] && !tba?.opr && <div className="text-amber-400">No pit data</div>}
                {tm.length === 0 && tba?.opr != null && (
                  <div className="text-blue-400">
                    OPR: {tba.opr.toFixed(1)} | DPR: {tba.dpr?.toFixed(1) ?? 'N/A'} | CCWM: {tba.ccwm?.toFixed(1) ?? 'N/A'}
                  </div>
                )}
                {tm.length === 0 && tbaTeamRecords[num] && (
                  <div className="text-blue-400">TBA: {tbaTeamRecords[num].wins}W-{tbaTeamRecords[num].losses}L across {tbaTeamRecords[num].events} event{tbaTeamRecords[num].events !== 1 ? 's' : ''}{tba?.avgScore != null ? ` | Avg Score: ${tba.avgScore.toFixed(0)}` : ''}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatBox: React.FC<{ label: string, value: string, source?: 'tba' }> = ({ label, value, source }) => (
  <div className="bg-slate-950/40 rounded-xl p-2 text-center">
    <span className="text-[9px] uppercase font-bold text-slate-500 block">{label}{source === 'tba' && <span className="text-blue-500 ml-1">TBA</span>}</span>
    <span className={`text-sm font-bold ${source === 'tba' ? 'text-blue-300' : 'text-slate-200'}`}>{value}</span>
  </div>
);

function computeAllianceAnalysis(teamNumbers: number[], pitData: Record<number, PitData>, matchData: MatchData[], tbaTeamData: TbaTeamDataMap) {
  const validTeams = teamNumbers.filter(n => n > 0);

  const roleAssignments: { team: number; recommended: string; reason: string }[] = [];
  const weaknesses: string[] = [];
  let totalOffense = 0;
  let totalDefense = 0;
  let offenseCount = 0;
  let defenseCount = 0;

  for (const num of validTeams) {
    const pit = pitData[num];
    const tm = matchData.filter(m => m.teamNumber === num);
    const roleCounts: Record<string, number> = { Shooter: 0, Feeder: 0, Defense: 0 };
    tm.forEach(m => { if (roleCounts[m.teleopRole] !== undefined) roleCounts[m.teleopRole]++; });
    const topRole = Object.entries(roleCounts).sort((a, b) => b[1] - a[1])[0];
    const selfRole = pit?.selfAssessedRole || 'N/A';
    const recommended = topRole && topRole[1] > 0 ? topRole[0] : (selfRole !== 'N/A' ? selfRole : 'Shooter');
    roleAssignments.push({ team: num, recommended, reason: topRole && topRole[1] > 0 ? `${topRole[1]}/${tm.length} matches as ${topRole[0]}` : `Pit: ${selfRole}` });

    if (tm.length > 0) {
      const avgOff = tm.reduce((s, m) => s + m.offensiveSkill, 0) / tm.length;
      const avgDef = tm.reduce((s, m) => s + m.defensiveSkill, 0) / tm.length;
      totalOffense += avgOff;
      totalDefense += avgDef;
      offenseCount++;
      defenseCount++;

      const fouls = tm.reduce((s, m) => s + m.minorFouls + m.majorFouls, 0) / tm.length;
      if (fouls > 1.5) weaknesses.push(`Team ${num}: High foul rate (${fouls.toFixed(1)}/match)`);
      const noShows = tm.filter(m => m.noShow).length;
      if (noShows > 0) weaknesses.push(`Team ${num}: ${noShows} no-show(s)`);
      const died = tm.filter(m => m.died).length;
      if (died > 0) weaknesses.push(`Team ${num}: Died on field ${died} time(s)`);
      const lowAcc = tm.filter(m => m.teleopAccuracy === '<50%').length;
      if (lowAcc > tm.length * 0.5 && tm.length >= 2) weaknesses.push(`Team ${num}: Low accuracy (${lowAcc}/${tm.length} matches <50%)`);
    } else {
      // Use OPR/DPR as fallback when no local match data
      const tba = tbaTeamData[num];
      if (tba?.opr != null) {
        const oprMapped = Math.min(tba.opr / 20, 5);
        totalOffense += oprMapped;
        offenseCount++;
      }
      if (tba?.dpr != null) {
        const dprMapped = Math.min(tba.dpr / 20, 5);
        totalDefense += dprMapped;
        defenseCount++;
      }
      if (!tba?.opr && !tba?.matches?.length) {
        weaknesses.push(`Team ${num}: No match data`);
      } else if (!tba?.opr) {
        weaknesses.push(`Team ${num}: No local scouting data (TBA W-L only)`);
      }
    }

    // TBA cross-event context
    const tba = tbaTeamData[num];
    if (tba?.matches && tba.matches.length > 0) {
      const teamKey = `frc${num}`;
      let wins = 0, losses = 0;
      tba.matches.forEach(m => {
        if (m.alliances.blue.team_keys.includes(teamKey)) {
          if (m.winning_alliance === 'blue') wins++; else if (m.winning_alliance === 'red') losses++;
        } else if (m.alliances.red.team_keys.includes(teamKey)) {
          if (m.winning_alliance === 'red') wins++; else if (m.winning_alliance === 'blue') losses++;
        }
      });
      roleAssignments[roleAssignments.length - 1].reason += ` | TBA: ${wins}W-${losses}L across ${tba.events?.length || '?'} events`;
    }
  }

  const avgOffense = offenseCount > 0 ? (totalOffense / offenseCount).toFixed(1) : 'N/A';
  const avgDefense = defenseCount > 0 ? (totalDefense / defenseCount).toFixed(1) : 'N/A';

  // Climb reliability
  const climbInfo: { team: number; maxLevel: string; consistency: string; canAutoClimb: boolean }[] = [];
  for (const num of validTeams) {
    const pit = pitData[num];
    const tm = matchData.filter(m => m.teamNumber === num && !m.noShow);
    const climbMatches = tm.filter(m => m.climbLevel > 0);
    const consistency = tm.length > 0 ? `${climbMatches.length}/${tm.length}` : 'N/A';
    climbInfo.push({
      team: num,
      maxLevel: pit?.climb.maxLevel || 'Unknown',
      consistency,
      canAutoClimb: pit?.climb.canAutoClimb || false,
    });
  }

  return { roleAssignments, avgOffense, avgDefense, weaknesses, climbInfo };
}

function computeRpAnalysis(teamNumbers: number[], pitData: Record<number, PitData>, matchData: MatchData[]) {
  const validTeams = teamNumbers.filter(n => n > 0);

  // Energized RP (100 Fuel)
  const shooters = validTeams.filter(n => {
    const pit = pitData[n];
    return pit?.selfAssessedRole === 'Shooter' || pit?.selfAssessedRole === 'N/A';
  });
  let totalRate = 0;
  let rateCount = 0;
  shooters.forEach(n => {
    const pit = pitData[n];
    const rate = parseFloat(pit?.scoring.scoringRate || '0');
    if (rate > 0) { totalRate += rate; rateCount++; }
  });
  const avgRate = rateCount > 0 ? totalRate / rateCount : 0;
  const estFuelOutput = shooters.length * avgRate * 120; // ~120 seconds of teleop shooting time
  const energizedVerdict = estFuelOutput >= 130 ? 'Likely' : estFuelOutput >= 80 ? 'Possible' : 'Unlikely';

  // Supercharged RP (360 Fuel)
  const superchargedVerdict = estFuelOutput >= 400 ? 'Likely' : estFuelOutput >= 250 ? 'Possible' : 'Unlikely';

  // Traversal RP (2 bots L1+ auto climb AND 2 bots L1+ endgame climb)
  let autoClimbers = 0;
  let endgameClimbers = 0;
  validTeams.forEach(n => {
    const pit = pitData[n];
    const tm = matchData.filter(m => m.teamNumber === n && !m.noShow);
    if (pit?.climb.canAutoClimb) autoClimbers++;
    else if (tm.length > 0 && tm.filter(m => m.autoClimbLevel > 0).length > tm.length * 0.5) autoClimbers++;

    const maxLevel = pit?.climb.maxLevel || 'None';
    if (maxLevel !== 'None') endgameClimbers++;
    else if (tm.length > 0 && tm.filter(m => m.climbLevel > 0).length > tm.length * 0.5) endgameClimbers++;
  });
  const traversalVerdict = (autoClimbers >= 2 && endgameClimbers >= 2) ? 'Likely' : (autoClimbers >= 1 && endgameClimbers >= 2) ? 'Possible' : 'Unlikely';

  return {
    energized: { verdict: energizedVerdict, detail: `~${Math.round(estFuelOutput)} est. fuel (${shooters.length} shooters, ${avgRate.toFixed(1)} avg FPS)` },
    supercharged: { verdict: superchargedVerdict, detail: `Need 360 fuel — ${estFuelOutput >= 250 ? 'stretch goal' : 'very difficult'} at current rates` },
    traversal: { verdict: traversalVerdict, detail: `${autoClimbers} auto climbers, ${endgameClimbers} endgame climbers` },
  };
}

const VerdictBadge: React.FC<{ verdict: string }> = ({ verdict }) => {
  const color = verdict === 'Likely' ? 'text-green-400 bg-green-400/10' : verdict === 'Possible' ? 'text-yellow-400 bg-yellow-400/10' : 'text-red-400 bg-red-400/10';
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${color}`}>{verdict}</span>;
};

const StrategyRecommendation: React.FC<{
  blueTeams: number[];
  redTeams: number[];
  pitData: Record<number, PitData>;
  matchData: MatchData[];
  tbaTeamData: TbaTeamDataMap;
}> = ({ blueTeams, redTeams, pitData, matchData, tbaTeamData }) => {
  const blueValid = blueTeams.filter(n => n > 0);
  const redValid = redTeams.filter(n => n > 0);
  if (blueValid.length === 0 && redValid.length === 0) return null;

  const blueAnalysis = computeAllianceAnalysis(blueTeams, pitData, matchData, tbaTeamData);
  const redAnalysis = computeAllianceAnalysis(redTeams, pitData, matchData, tbaTeamData);
  const blueRp = computeRpAnalysis(blueTeams, pitData, matchData);
  const redRp = computeRpAnalysis(redTeams, pitData, matchData);

  const renderAnalysis = (label: string, color: string, analysis: ReturnType<typeof computeAllianceAnalysis>, rp: ReturnType<typeof computeRpAnalysis>, teams: number[]) => {
    const borderColor = color === 'blue' ? 'border-blue-500/30' : 'border-red-500/30';
    const bgColor = color === 'blue' ? 'bg-blue-500/5' : 'bg-red-500/5';
    const textColor = color === 'blue' ? 'text-blue-400' : 'text-red-400';
    const validTeams = teams.filter(n => n > 0);
    if (validTeams.length === 0) return null;

    return (
      <div className={`${bgColor} border ${borderColor} rounded-2xl p-4 space-y-4`}>
        <h4 className={`text-xs font-bold uppercase ${textColor}`}>{label} Alliance Strategy</h4>

        {/* Role Assignments */}
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Role Assignments</span>
          {analysis.roleAssignments.map(r => (
            <div key={r.team} className="bg-slate-950/40 rounded-xl p-2 flex items-center justify-between">
              <span className="text-xs text-slate-300 font-bold">Team {r.team}</span>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-200">{r.recommended}</span>
                <span className="text-[10px] text-slate-500 block">{r.reason}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Strength Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-950/40 rounded-xl p-2 text-center">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Offense</span>
            <span className="text-sm font-bold text-slate-200">{analysis.avgOffense}/5</span>
          </div>
          <div className="bg-slate-950/40 rounded-xl p-2 text-center">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Defense</span>
            <span className="text-sm font-bold text-slate-200">{analysis.avgDefense}/5</span>
          </div>
        </div>

        {/* Climb Reliability */}
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Climb Reliability</span>
          {analysis.climbInfo.map(c => (
            <div key={c.team} className="text-xs text-slate-400 flex justify-between">
              <span>Team {c.team}</span>
              <span className="text-slate-300">Max: {c.maxLevel} | {c.consistency} climbed{c.canAutoClimb ? ' | Auto-climb' : ''}</span>
            </div>
          ))}
        </div>

        {/* Weaknesses */}
        {analysis.weaknesses.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-400 block">Weakness Flags</span>
            {analysis.weaknesses.map((w, i) => (
              <div key={i} className="text-xs text-amber-300/70 flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* RP Analysis */}
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">RP Pathways</span>
          <div className="bg-slate-950/40 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Energized RP (100 fuel)</span>
              <VerdictBadge verdict={rp.energized.verdict} />
            </div>
            <p className="text-[10px] text-slate-500">{rp.energized.detail}</p>
          </div>
          <div className="bg-slate-950/40 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Supercharged RP (360 fuel)</span>
              <VerdictBadge verdict={rp.supercharged.verdict} />
            </div>
            <p className="text-[10px] text-slate-500">{rp.supercharged.detail}</p>
          </div>
          <div className="bg-slate-950/40 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Traversal RP (2 auto + 2 endgame)</span>
              <VerdictBadge verdict={rp.traversal.verdict} />
            </div>
            <p className="text-[10px] text-slate-500">{rp.traversal.detail}</p>
          </div>
        </div>
      </div>
    );
  };

  // Build recommended strategy card
  const buildStrategyCard = () => {
    if (blueValid.length === 0 || redValid.length === 0) return null;

    const isOurAlliance = (teams: number[]) => teams.includes(8778);
    const ourAlliance = isOurAlliance(blueTeams) ? 'blue' : isOurAlliance(redTeams) ? 'red' : null;
    const ourAnalysis = ourAlliance === 'blue' ? blueAnalysis : ourAlliance === 'red' ? redAnalysis : blueAnalysis;
    const ourTeams = ourAlliance === 'blue' ? blueTeams : ourAlliance === 'red' ? redTeams : blueTeams;
    const oppAnalysis = ourAlliance === 'blue' ? redAnalysis : ourAlliance === 'red' ? blueAnalysis : redAnalysis;
    const oppTeams = ourAlliance === 'blue' ? redTeams : ourAlliance === 'red' ? blueTeams : redTeams;
    const ourRp = ourAlliance === 'blue' ? blueRp : ourAlliance === 'red' ? redRp : blueRp;

    const autoClimbers = ourAnalysis.climbInfo.filter(c => c.canAutoClimb).map(c => c.team);
    const shooterTeams = ourAnalysis.roleAssignments.filter(r => r.recommended === 'Shooter').map(r => r.team);
    const feederTeams = ourAnalysis.roleAssignments.filter(r => r.recommended === 'Feeder').map(r => r.team);
    const defenseTeams = ourAnalysis.roleAssignments.filter(r => r.recommended === 'Defense').map(r => r.team);

    // Get effective offense score: local data first, OPR fallback, win-rate fallback, then unknown
    const getTeamOffense = (num: number): number => {
      const tm = matchData.filter(m => m.teamNumber === num);
      if (tm.length > 0) return tm.reduce((s, m) => s + m.offensiveSkill, 0) / tm.length;
      const tba = tbaTeamData[num];
      // Prefer OPR — it's a direct offensive contribution measure
      if (tba?.opr != null) return Math.min(tba.opr / 20, 5);
      // Fall back to win rate
      if (tba?.matches && tba.matches.length > 0) {
        const teamKey = `frc${num}`;
        let wins = 0, total = 0;
        tba.matches.forEach(m => {
          if (m.alliances.blue.team_keys.includes(teamKey)) {
            total++; if (m.winning_alliance === 'blue') wins++;
          } else if (m.alliances.red.team_keys.includes(teamKey)) {
            total++; if (m.winning_alliance === 'red') wins++;
          }
        });
        if (total > 0) return 1 + (wins / total) * 4;
      }
      return 3; // True unknown
    };

    // Find opponent's weakest team (most weaknesses or lowest offense)
    const oppValid = oppTeams.filter(n => n > 0);
    const oppWeakest = oppValid.length > 0 ? oppValid.reduce((best, num) => {
      return getTeamOffense(num) < getTeamOffense(best) ? num : best;
    }, oppValid[0]) : null;

    // Find opponent's best scorer to defend
    const oppBestScorer = oppValid.length > 0 ? oppValid.reduce((best, num) => {
      return getTeamOffense(num) > getTeamOffense(best) ? num : best;
    }, oppValid[0]) : null;

    const labelColor = ourAlliance === 'red' ? 'text-red-400' : 'text-blue-400';

    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700/50 rounded-2xl p-5 space-y-5">
        <h4 className="text-sm font-bold uppercase text-slate-200 flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-purple-400" />
          Recommended Strategy {ourAlliance && <span className={`text-[10px] ${labelColor}`}>({ourAlliance} alliance{ourAlliance ? ' — our team' : ''})</span>}
        </h4>

        {/* Auto */}
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-purple-400 block">Auto Phase</span>
          <div className="text-xs text-slate-300 space-y-0.5">
            {shooterTeams.length > 0 && <div>Shoot fuel: {shooterTeams.map(t => `Team ${t}`).join(', ')}</div>}
            {autoClimbers.length > 0 && <div>Auto-climb (for Traversal RP): {autoClimbers.map(t => `Team ${t}`).join(', ')}</div>}
            {autoClimbers.length < 2 && <div className="text-amber-400">Warning: Only {autoClimbers.length} auto-climber(s) — Traversal RP auto requirement at risk</div>}
          </div>
        </div>

        {/* Teleop */}
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-blue-400 block">Teleop Phase</span>
          <div className="text-xs text-slate-300 space-y-0.5">
            {shooterTeams.length > 0 && <div>Shooters: {shooterTeams.map(t => `Team ${t}`).join(', ')}</div>}
            {feederTeams.length > 0 && <div>Feeders: {feederTeams.map(t => `Team ${t}`).join(', ')}</div>}
            {defenseTeams.length > 0 && <div>Defense: {defenseTeams.map(t => `Team ${t}`).join(', ')}</div>}
            {ourRp.energized.verdict !== 'Unlikely' && <div className="text-green-400">Push for Energized RP — focus fuel output</div>}
          </div>
        </div>

        {/* Endgame */}
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-400 block">Endgame</span>
          <div className="text-xs text-slate-300 space-y-0.5">
            {ourAnalysis.climbInfo.filter(c => c.maxLevel !== 'None' && c.maxLevel !== 'Unknown').map(c => (
              <div key={c.team}>Team {c.team}: Climb to {c.maxLevel} ({c.consistency} reliability)</div>
            ))}
            {ourAnalysis.climbInfo.filter(c => c.maxLevel === 'None' || c.maxLevel === 'Unknown').map(c => (
              <div key={c.team} className="text-slate-500">Team {c.team}: No climb — continue scoring</div>
            ))}
          </div>
        </div>

        {/* Key Risks */}
        {ourAnalysis.weaknesses.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-red-400 block">Key Risks</span>
            <div className="text-xs text-red-300/70 space-y-0.5">
              {ourAnalysis.weaknesses.slice(0, 3).map((w, i) => <div key={i}>{w}</div>)}
            </div>
          </div>
        )}

        {/* Counter-strategy */}
        {oppValid.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-cyan-400 block">Counter-Strategy (vs. Opponent)</span>
            <div className="text-xs text-slate-300 space-y-0.5">
              {oppBestScorer && <div>Defend Team {oppBestScorer} — their top scorer{matchData.filter(m => m.teamNumber === oppBestScorer).length === 0 && ' (based on TBA record)'}</div>}
              {oppAnalysis.weaknesses.length > 0 && <div className="text-cyan-300/70">Exploit: {oppAnalysis.weaknesses[0]}</div>}
              {oppAnalysis.climbInfo.filter(c => c.maxLevel !== 'None' && c.maxLevel !== 'Unknown').length >= 2 && (
                <div>Opponents have strong climbers — deny Traversal RP by disrupting their climb setup</div>
              )}
              {oppAnalysis.climbInfo.filter(c => c.maxLevel !== 'None' && c.maxLevel !== 'Unknown').length < 2 && (
                <div className="text-green-400">Opponents likely can't get Traversal RP — focus on denying Energized RP</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
        <Target className="w-4 h-4" />
        Strategy Recommendations
      </h3>
      <div className="grid grid-cols-1 gap-6">
        {renderAnalysis('Blue', 'blue', blueAnalysis, blueRp, blueTeams)}
        {renderAnalysis('Red', 'red', redAnalysis, redRp, redTeams)}
      </div>
      {buildStrategyCard()}
    </div>
  );
};

const StrategyLab: React.FC<{
  pitData: Record<number, PitData>, matchData: MatchData[], availableTeams: Team[], selectedSeason: number,
  selectedEventKey: string,
  blue: number[], setBlue: React.Dispatch<React.SetStateAction<number[]>>,
  red: number[], setRed: React.Dispatch<React.SetStateAction<number[]>>,
  tbaTeamData: TbaTeamDataMap, setTbaTeamData: React.Dispatch<React.SetStateAction<TbaTeamDataMap>>,
  isConnected: boolean,
}> = ({ pitData, matchData, availableTeams, selectedSeason, selectedEventKey, blue, setBlue, red, setRed, tbaTeamData, setTbaTeamData, isConnected }) => {
  const [tbaFetchLoading, setTbaFetchLoading] = useState<Record<number, boolean>>({});
  const eventDataRef = useRef<{ key: string; rankings: TBARankings | null; oprs: TBAOprs | null } | null>(null);

  // Fetch per-team events/matches
  useEffect(() => {
    const allTeamNums = [...blue, ...red].filter(n => n > 0);
    const newTeams = allTeamNums.filter(n => tbaTeamData[n] === undefined && !tbaFetchLoading[n]);
    if (newTeams.length === 0) return;

    if (!isConnected) {
      const updates: TbaTeamDataMap = {};
      for (const num of newTeams) updates[num] = null;
      setTbaTeamData(prev => ({ ...prev, ...updates }));
      return;
    }

    for (const num of newTeams) {
      setTbaFetchLoading(prev => ({ ...prev, [num]: true }));
      Promise.all([
        fetchTbaTeamEvents(num, selectedSeason),
        fetchTbaTeamMatches(num, selectedSeason),
      ]).then(([events, matches]) => {
        const teamKey = `frc${num}`;
        let totalScore = 0, scoreCount = 0;
        matches.forEach(m => {
          if (m.alliances.blue.team_keys.includes(teamKey) && m.alliances.blue.score >= 0) {
            totalScore += m.alliances.blue.score; scoreCount++;
          } else if (m.alliances.red.team_keys.includes(teamKey) && m.alliances.red.score >= 0) {
            totalScore += m.alliances.red.score; scoreCount++;
          }
        });
        const avgScore = scoreCount > 0 ? totalScore / scoreCount : null;
        setTbaTeamData(prev => ({ ...prev, [num]: { events, matches, avgScore } }));
      }).catch(() => {
        setTbaTeamData(prev => ({ ...prev, [num]: null }));
      }).finally(() => {
        setTbaFetchLoading(prev => ({ ...prev, [num]: false }));
      });
    }
  }, [blue, red, selectedSeason, tbaTeamData, tbaFetchLoading, isConnected]);

  // Fetch event-level rankings + OPRs once per event
  useEffect(() => {
    if (!isConnected || !selectedEventKey) return;
    if (eventDataRef.current?.key === selectedEventKey) return;
    const allTeamNums = [...blue, ...red].filter(n => n > 0);
    if (allTeamNums.length === 0) return;

    Promise.all([
      fetchTbaRankings(selectedEventKey).catch(() => null),
      fetchTbaOprs(selectedEventKey).catch(() => null),
    ]).then(([rankings, oprs]) => {
      eventDataRef.current = { key: selectedEventKey, rankings, oprs };
      setTbaTeamData(prev => {
        const next = { ...prev };
        for (const numStr of Object.keys(next)) {
          const num = Number(numStr);
          const existing = next[num];
          if (!existing) continue;
          const teamKey = `frc${num}`;
          const ranking = rankings?.rankings?.find(r => r.team_key === teamKey) || null;
          const oprVal = oprs?.oprs?.[teamKey] ?? null;
          const dprVal = oprs?.dprs?.[teamKey] ?? null;
          const ccwmVal = oprs?.ccwms?.[teamKey] ?? null;
          next[num] = { ...existing, ranking: ranking ? { rank: ranking.rank, record: ranking.record, matches_played: ranking.matches_played } : null, opr: oprVal, dpr: dprVal, ccwm: ccwmVal };
        }
        return next;
      });
    });
  }, [isConnected, selectedEventKey, blue, red]);

  const anyLoading = [...blue, ...red].some(n => n > 0 && tbaFetchLoading[n]);
  const hasTeams = blue.some(n => n > 0) || red.some(n => n > 0);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-header text-blue-500">STRATEGY LAB</h2>
        {(blue.some(n => n > 0) || red.some(n => n > 0)) && (
          <button onClick={() => { setBlue([0,0,0]); setRed([0,0,0]); setTbaTeamData({}); }}
            className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-blue-400 uppercase">Blue</h3>
          {[0, 1, 2].map(i => <TeamPicker key={i} teams={blue} setTeams={setBlue} index={i} allTeams={availableTeams} />)}
        </div>
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-red-400 uppercase">Red</h3>
          {[0, 1, 2].map(i => <TeamPicker key={i} teams={red} setTeams={setRed} index={i} allTeams={availableTeams} />)}
        </div>
      </div>
      {anyLoading && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading TBA data for selected teams...
        </div>
      )}
      {!isConnected && hasTeams && (
        <div className="flex items-center gap-2 text-xs text-amber-400/70">
          Offline — using local scouting data only. TBA stats unavailable.
        </div>
      )}
      <AllianceStats label="Blue" color="blue" teamNumbers={blue} pitData={pitData} matchData={matchData} tbaTeamData={tbaTeamData} />
      <AllianceStats label="Red" color="red" teamNumbers={red} pitData={pitData} matchData={matchData} tbaTeamData={tbaTeamData} />
      {hasTeams && (
        <StrategyRecommendation
          blueTeams={blue}
          redTeams={red}
          pitData={pitData}
          matchData={matchData}
          tbaTeamData={tbaTeamData}
        />
      )}
    </div>
  );
};

const Section: React.FC<{ title: string, children: React.ReactNode, noBorder?: boolean, icon?: React.ReactNode }> = ({ title, children, noBorder, icon }) => (
  <div className={`space-y-4 ${noBorder ? '' : 'pt-8 border-t border-slate-800/30'}`}>
    <div className="flex items-center gap-2 mb-2">
      {icon && <div className="text-blue-500">{icon}</div>}
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</h3>
    </div>
    {children}
  </div>
);

const Counter: React.FC<{ label: string, value: number, onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div className="bg-slate-900 p-5 rounded-3xl border-2 border-slate-800 flex items-center justify-between">
    <span className="font-bold text-slate-400 text-xs uppercase tracking-wider">{label}</span>
    <div className="flex items-center gap-6">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl font-bold border border-slate-700">-</button>
      <span className="text-4xl font-header w-10 text-center text-blue-400">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-900/20">+</button>
    </div>
  </div>
);

const ConfigView: React.FC<{
  matchData: MatchData[];
  pitData: Record<number, PitData>;
  isConnected: boolean;
  events: TBAEventSimple[];
  selectedSeason: number;
  selectedEventKey: string;
  isLoadingTba: { events: boolean; teams: boolean };
  onSetSeason: (season: number) => void;
  onShowQR: (data: string) => void;
  onScanQR: () => void;
  onClearData: () => void;
}> = ({ matchData, pitData, isConnected, events, selectedSeason, selectedEventKey, isLoadingTba, onSetSeason, onShowQR, onScanQR, onClearData }) => {
  const selectedEventName = events.find(event => event.key === selectedEventKey)?.name || 'Static Smoky Mountain team list';

  return (
    <div className="space-y-8 pb-12">
      <h2 className="text-3xl font-header text-white">CONFIG</h2>

      <button onClick={onScanQR}
        className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all">
        <ScanLine className="w-5 h-5" /> Scan QR Code
      </button>

      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Competition Teams (Blue Alliance)</h3>
        <div className="grid grid-cols-1 gap-4">
          <label className="space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-500">Season</span>
            <input
              type="number"
              min="2016"
              max={new Date().getFullYear()}
              className="w-full bg-slate-900 border-2 border-slate-800 rounded-xl px-4 py-3 text-slate-100 text-sm focus:border-blue-600 focus:outline-none"
              value={selectedSeason}
              onChange={(e) => {
                const next = parseInt(e.target.value, 10);
                if (Number.isFinite(next)) onSetSeason(next);
              }}
            />
          </label>
          <p className="text-xs text-slate-400">
            Current event: <span className="text-slate-200">{selectedEventName}</span>
          </p>
          <p className="text-[10px] text-slate-600">Change event in the TBA tab.</p>
          {isLoadingTba.teams && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" />Loading teams for selected event...</p>}
          {!isLoadingTba.teams && (
            <p className="text-xs text-slate-500">
              Teams are pulled from TBA when an event is selected, otherwise fallback to the built-in team list.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Share Data</h3>
        <Button
          size="lg"
          className="w-full h-16"
          onClick={() => {
            if (matchData.length === 0) return;
            onShowQR(encodeBulkMatchData(matchData));
          }}
          disabled={matchData.length === 0}
        >
          <Share2 className="w-5 h-5 mr-2" />
          Share All Matches ({matchData.length})
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full h-16"
          onClick={() => {
            const pits = Object.values(pitData) as PitData[];
            if (pits.length === 0) return;
            onShowQR(encodeBulkPitData(pits));
          }}
          disabled={Object.keys(pitData).length === 0}
        >
          <Share2 className="w-5 h-5 mr-2" />
          Share All Pit Data ({Object.keys(pitData).length})
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full h-16"
          onClick={() => {
            const pits = Object.values(pitData) as PitData[];
            if (matchData.length === 0 && pits.length === 0) return;
            onShowQR(encodeAllData(pits, matchData));
          }}
          disabled={matchData.length === 0 && Object.keys(pitData).length === 0}
        >
          <Share2 className="w-5 h-5 mr-2" />
          Share All Data ({matchData.length + Object.keys(pitData).length})
        </Button>
        <p className="text-xs text-slate-500">
          Generates QR codes with your data. Any scout can scan to import. Newer data automatically overwrites older data.
        </p>
      </div>

      <div className="space-y-4 pt-6 border-t border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">App Info</h3>
        <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Version</span><span className="text-slate-300">1.0.0</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Matches Stored</span><span className="text-slate-300">{matchData.length}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Pit Records</span><span className="text-slate-300">{Object.keys(pitData).length}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Device ID</span><span className="text-slate-400 font-mono text-xs truncate max-w-[180px]">{localStorage.getItem('smoky_scout_device_id') || 'N/A'}</span></div>
        </div>
      </div>

      <div className="space-y-4 pt-6 border-t border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-widest text-red-400">Danger Zone</h3>
        <Button variant="danger" size="lg" className="w-full" onClick={onClearData} disabled={!isConnected}>
          <Trash2 className="w-5 h-5 mr-2" />
          Clear All Data
        </Button>
        <p className="text-xs text-slate-500">
          {isConnected
            ? 'Deletes all pit and match data from the server and all devices. Requires PIN.'
            : 'Must be online to clear all data (server data would remain).'}
        </p>
      </div>
    </div>
  );
};

// --- Rankings View ---

const RankingsView: React.FC<{
  matchData: MatchData[];
  pitData: Record<number, PitData>;
  availableTeams: Team[];
  tbaTeamData: TbaTeamDataMap;
}> = ({ matchData, pitData, availableTeams, tbaTeamData }) => {
  const [category, setCategory] = useState<RankingsCategory>('shooter');
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [foulTooltip, setFoulTooltip] = useState<number | null>(null);

  const handleCategoryChange = (cat: RankingsCategory) => {
    setCategory(cat);
    setExpandedTeam(null);
    setFoulTooltip(null);
  };

  const rankedTeams = React.useMemo(() => {
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

    const results: {
      team: Team;
      score: number;
      hasData: boolean;
      details: Record<string, string | number | boolean>;
    }[] = [];

    if (category === 'shooter') {
      for (const team of availableTeams) {
        const tm = matchData.filter(m => m.teamNumber === team.number);
        const shooterMatches = tm.filter(m => m.teleopRole === 'Shooter');
        const relevantMatches = shooterMatches.length > 0 ? shooterMatches : tm;
        if (relevantMatches.length === 0) {
          results.push({ team, score: 0, hasData: false, details: {} });
          continue;
        }
        const avgOffense = relevantMatches.reduce((s, m) => s + m.offensiveSkill, 0) / relevantMatches.length;
        const highAccCount = relevantMatches.filter(m => m.teleopAccuracy === '>80%').length;
        const lowAccCount = relevantMatches.filter(m => m.teleopAccuracy === '<50%').length;
        let accuracyBoost = 0;
        if (highAccCount > relevantMatches.length / 2) accuracyBoost = 0.5;
        else if (lowAccCount > relevantMatches.length / 2) accuracyBoost = -0.5;
        const score = clamp(avgOffense + accuracyBoost, 0, 5);
        const avgDef = tm.reduce((s, m) => s + m.defensiveSkill, 0) / tm.length;
        const winRate = tm.filter(m => m.wonMatch).length / tm.length;
        const topAcc = highAccCount > relevantMatches.length / 2 ? '>80%' : lowAccCount > relevantMatches.length / 2 ? '<50%' : '50-80%';
        results.push({
          team, score, hasData: true,
          details: { avgOffense: +avgOffense.toFixed(1), avgDefense: +avgDef.toFixed(1), winRate: +(winRate * 100).toFixed(0), accuracy: topAcc, matches: tm.length }
        });
      }
    } else if (category === 'feeder') {
      // First pass: find max feeder count
      let maxFeederCount = 0;
      const feederCounts: Record<number, { count: number; matches: MatchData[] }> = {};
      for (const team of availableTeams) {
        const fm = matchData.filter(m => m.teamNumber === team.number && m.teleopRole === 'Feeder');
        feederCounts[team.number] = { count: fm.length, matches: fm };
        if (fm.length > maxFeederCount) maxFeederCount = fm.length;
      }
      for (const team of availableTeams) {
        const { count, matches: fm } = feederCounts[team.number];
        const tm = matchData.filter(m => m.teamNumber === team.number);
        if (count === 0) {
          results.push({ team, score: 0, hasData: false, details: {} });
          continue;
        }
        const avgTransition = fm.reduce((s, m) => s + m.transitionQuickness, 0) / fm.length;
        const winRate = fm.filter(m => m.wonMatch).length / fm.length;
        const score = maxFeederCount === 0 ? 0 : clamp((count / maxFeederCount) * 2 + (avgTransition / 5) * 2 + winRate * 1, 0, 5);
        results.push({
          team, score, hasData: true,
          details: { feederMatches: count, totalMatches: tm.length, avgTransition: +avgTransition.toFixed(1), winRate: +(winRate * 100).toFixed(0) }
        });
      }
    } else if (category === 'climber') {
      for (const team of availableTeams) {
        const tm = matchData.filter(m => m.teamNumber === team.number);
        const pit = pitData[team.number];
        const pitMaxLevel = pit?.climb?.maxLevel === 'L3' ? 3 : pit?.climb?.maxLevel === 'L2' ? 2 : pit?.climb?.maxLevel === 'L1' ? 1 : 0;
        if (tm.length === 0 && !pit?.climb) {
          results.push({ team, score: 0, hasData: false, details: {} });
          continue;
        }
        const maxClimbFromMatches = tm.length > 0 ? Math.max(...tm.map(m => m.climbLevel)) : 0;
        const maxClimb = Math.max(maxClimbFromMatches, pitMaxLevel);
        const autoClimbFromMatches = tm.length > 0 && tm.filter(m => m.autoClimbLevel > 0).length > tm.length / 2;
        const canAutoClimb = pit?.climb?.canAutoClimb || autoClimbFromMatches;
        const autoBonus = canAutoClimb ? 2 : 0;
        const score = clamp(autoBonus + maxClimb, 0, 5);
        const nonNoShow = tm.filter(m => !m.noShow);
        const consistency = nonNoShow.length > 0 ? nonNoShow.filter(m => m.climbLevel > 0).length / nonNoShow.length : 0;
        results.push({
          team, score, hasData: true,
          details: { maxClimb: `L${maxClimb}`, canAutoClimb, consistency: +(consistency * 100).toFixed(0), matches: tm.length }
        });
      }
    } else if (category === 'defense') {
      for (const team of availableTeams) {
        const tm = matchData.filter(m => m.teamNumber === team.number);
        if (tm.length === 0) {
          results.push({ team, score: 0, hasData: false, details: {} });
          continue;
        }
        const avgDefense = tm.reduce((s, m) => s + m.defensiveSkill, 0) / tm.length;
        const avgMinorFouls = tm.reduce((s, m) => s + m.minorFouls, 0) / tm.length;
        const avgMajorFouls = tm.reduce((s, m) => s + m.majorFouls, 0) / tm.length;
        const hasFoulFlag = (avgMinorFouls + avgMajorFouls) > 0.5;
        results.push({
          team, score: +avgDefense.toFixed(1), hasData: true,
          details: { avgDefense: +avgDefense.toFixed(1), avgMinorFouls: +avgMinorFouls.toFixed(1), avgMajorFouls: +avgMajorFouls.toFixed(1), hasFoulFlag, matches: tm.length }
        });
      }
    }

    // Sort: hasData teams by score desc, then no-data teams at bottom
    results.sort((a, b) => {
      if (a.hasData && !b.hasData) return -1;
      if (!a.hasData && b.hasData) return 1;
      if (a.score !== b.score) return b.score - a.score;
      // Tiebreak for climber: consistency
      if (category === 'climber' && a.hasData && b.hasData) {
        return (b.details.consistency as number || 0) - (a.details.consistency as number || 0);
      }
      return a.team.number - b.team.number;
    });

    return results;
  }, [matchData, pitData, availableTeams, category]);

  const pills: { key: RankingsCategory; label: string }[] = [
    { key: 'shooter', label: 'Shooter' },
    { key: 'feeder', label: 'Feeder' },
    { key: 'climber', label: 'Climber' },
    { key: 'defense', label: 'Defense' },
  ];

  let dataRank = 0;

  return (
    <div className="space-y-6 pb-12">
      <h2 className="text-3xl font-header text-white">RANKINGS</h2>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {pills.map(p => (
          <button key={p.key} onClick={() => handleCategoryChange(p.key)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              category === p.key
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-slate-600'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {rankedTeams.map(({ team, score, hasData, details }) => {
          if (hasData) dataRank++;
          const isExpanded = expandedTeam === team.number;
          const teamMatches = matchData.filter(m => m.teamNumber === team.number);
          const pit = pitData[team.number];
          const tba = tbaTeamData[team.number];

          // Compute common expanded stats
          const avgOff = teamMatches.length > 0 ? (teamMatches.reduce((s, m) => s + m.offensiveSkill, 0) / teamMatches.length).toFixed(1) : 'N/A';
          const avgDef = teamMatches.length > 0 ? (teamMatches.reduce((s, m) => s + m.defensiveSkill, 0) / teamMatches.length).toFixed(1) : 'N/A';
          const winPct = teamMatches.length > 0 ? Math.round(teamMatches.filter(m => m.wonMatch).length / teamMatches.length * 100) + '%' : 'N/A';
          const maxClimb = teamMatches.length > 0 ? 'L' + Math.max(...teamMatches.map(m => m.climbLevel)) : (pit?.climb?.maxLevel || 'N/A');
          const driveType = pit?.drivetrain?.type || 'N/A';
          const topRole = teamMatches.length > 0
            ? (['Shooter', 'Feeder', 'Defense'] as const).reduce((best, role) => {
                const c = teamMatches.filter(m => m.teleopRole === role).length;
                return c > best.count ? { role, count: c } : best;
              }, { role: 'N/A' as string, count: 0 }).role
            : (pit?.selfAssessedRole || 'N/A');
          const fps = pit?.scoring?.scoringRate || 'N/A';
          const topAcc = teamMatches.length > 0
            ? (['> 80%', '50-80%', '<50%'] as const).reduce((best, acc) => {
                const c = teamMatches.filter(m => m.teleopAccuracy === acc).length;
                return c > best.count ? { acc, count: c } : best;
              }, { acc: 'N/A' as string, count: 0 }).acc
            : 'N/A';

          return (
            <div key={team.number}>
              <button
                onClick={() => hasData && setExpandedTeam(isExpanded ? null : team.number)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                  hasData
                    ? 'bg-slate-900 border border-slate-800 hover:border-slate-700 active:scale-[0.99]'
                    : 'bg-slate-900/40 border border-slate-800/50'
                }`}>
                {hasData ? (
                  <span className="text-blue-400 font-bold text-sm w-8 text-right">#{dataRank}</span>
                ) : (
                  <span className="w-8" />
                )}
                <div className="flex-1 text-left">
                  <span className={`font-bold ${hasData ? 'text-slate-200' : 'text-slate-600'}`}>
                    {team.number}
                  </span>
                  <span className={`ml-2 text-sm ${hasData ? 'text-slate-400' : 'text-slate-600'}`}>
                    {team.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {hasData && category === 'defense' && details.hasFoulFlag && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setFoulTooltip(foulTooltip === team.number ? null : team.number); }}
                      className="relative text-amber-400 hover:text-amber-300">
                      <AlertTriangle className="w-4 h-4" />
                      {foulTooltip === team.number && (
                        <div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 whitespace-nowrap z-10 shadow-xl">
                          Minor: {details.avgMinorFouls}/match | Major: {details.avgMajorFouls}/match
                        </div>
                      )}
                    </button>
                  )}
                  <span className={`text-sm font-bold ${hasData ? 'text-slate-200' : 'text-slate-600'}`}>
                    {hasData ? `${score}/5` : 'No data'}
                  </span>
                  {hasData && (
                    <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  )}
                </div>
              </button>

              {isExpanded && hasData && (
                <div className="mx-2 mt-1 mb-2 bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-4 gap-2">
                    <StatBox label="Off" value={avgOff} />
                    <StatBox label="Def" value={avgDef} />
                    <StatBox label="Win%" value={winPct} />
                    <StatBox label="Climb" value={maxClimb} />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <StatBox label="Drive" value={driveType} />
                    <StatBox label="Role" value={topRole} />
                    <StatBox label="FPS" value={fps} />
                    <StatBox label="Acc" value={topAcc} />
                  </div>
                  {tba && (tba.opr != null || tba.dpr != null || tba.ranking) && (
                    <div className="grid grid-cols-3 gap-2">
                      <StatBox label="OPR" value={tba.opr != null ? tba.opr.toFixed(1) : 'N/A'} source="tba" />
                      <StatBox label="DPR" value={tba.dpr != null ? tba.dpr.toFixed(1) : 'N/A'} source="tba" />
                      <StatBox label="W-L" value={tba.ranking ? `${tba.ranking.record.wins}-${tba.ranking.record.losses}` : 'N/A'} source="tba" />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- TBA View ---

type TBATab = 'rankings' | 'matches' | 'stats' | 'alliances';

const TBAView: React.FC<{
  eventKey: string;
  events: TBAEventSimple[];
  selectedSeason: number;
  isLoadingEvents: boolean;
  onSetEvent: (season: number, eventKey: string | null) => void | Promise<void>;
}> = ({ eventKey, events, selectedSeason, isLoadingEvents, onSetEvent }) => {
  const [tab, setTab] = useState<TBATab>('rankings');
  const [rankings, setRankings] = useState<TBARankings | null>(null);
  const [sortCol, setSortCol] = useState<string>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [tbaMatches, setTbaMatches] = useState<TBAMatch[]>([]);
  const [oprs, setOprs] = useState<TBAOprs | null>(null);
  const [alliances, setAlliances] = useState<TBAAlliance[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentEvent = events.find(e => e.key === eventKey);

  const fetchAllTbaData = useCallback(async () => {
    if (!eventKey) return;
    setLoading(true);
    setError('');
    try {
      const [r, m, o, a] = await Promise.all([
        fetchTbaRankings(eventKey).catch(() => null),
        fetchTbaMatchesForEvent(eventKey).catch(() => []),
        fetchTbaOprs(eventKey).catch(() => null),
        fetchTbaAlliances(eventKey).catch(() => []),
      ]);
      setRankings(r);
      setTbaMatches(m as TBAMatch[]);
      setOprs(o);
      setAlliances(a);
      setLastUpdated(Date.now());
    } catch (err: any) {
      setError(err.message || 'Failed to load TBA data');
    } finally {
      setLoading(false);
    }
  }, [eventKey]);

  useEffect(() => {
    fetchAllTbaData();
    pollRef.current = setInterval(fetchAllTbaData, 60000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAllTbaData]);

  const teamNum = (key: string) => key.replace('frc', '');
  const TbaTeamLink: React.FC<{ teamKey: string }> = ({ teamKey }) => {
    const num = teamKey.replace('frc', '');
    return (
      <a href={`https://www.thebluealliance.com/team/${num}`}
         target="_blank" rel="noopener noreferrer"
         className="text-blue-400 hover:text-blue-300 hover:underline">
        {num}
      </a>
    );
  };
  const today = new Date().toISOString().split('T')[0];
  const seasonEvents = events.filter(e => e.year === selectedSeason && e.start_date <= today).sort((a, b) => a.start_date.localeCompare(b.start_date));

  if (!eventKey) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <h2 className="text-3xl font-header text-white">TBA EVENT DATA</h2>
        <label className="space-y-2 block">
          <span className="text-[10px] uppercase font-bold text-slate-500">
            Event ({seasonEvents.length} found)
          </span>
          <select
            className="w-full bg-slate-900 border-2 border-slate-800 rounded-xl px-3 py-3 text-slate-100 text-sm focus:border-blue-600 focus:outline-none appearance-none"
            value={eventKey}
            onChange={(e) => onSetEvent(selectedSeason, e.target.value || null)}
          >
            <option value="">Select an event...</option>
            {seasonEvents.map(event => (
              <option key={event.key} value={event.key}>
                {event.start_date} • {event.name} ({event.event_code})
              </option>
            ))}
          </select>
          {isLoadingEvents && (
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading events...
            </p>
          )}
        </label>
        <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-8 text-center">
          <Globe className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No event selected.</p>
          <p className="text-xs text-slate-500 mt-2">Choose an event above to see live data.</p>
        </div>
      </div>
    );
  }

  const tabStyles = "flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider border-b-2 transition-colors";

  const sortedMatches = [...tbaMatches].sort((a, b) => {
    const compOrder: Record<string, number> = { qm: 0, ef: 1, qf: 2, sf: 3, f: 4 };
    const aOrder = compOrder[a.comp_level] ?? 5;
    const bOrder = compOrder[b.comp_level] ?? 5;
    if (aOrder !== bOrder) return aOrder - bOrder;
    if (a.set_number !== b.set_number) return a.set_number - b.set_number;
    return a.match_number - b.match_number;
  });
  const playedMatches = sortedMatches.filter(m => m.actual_time != null && m.actual_time > 0);

  const oprEntries: [string, number][] = oprs?.oprs
    ? (Object.entries(oprs.oprs) as [string, number][]).sort((a, b) => b[1] - a[1])
    : [];

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedRankings = rankings?.rankings ? [...rankings.rankings].sort((a, b) => {
    let cmp = 0;
    if (sortCol === 'rank') {
      cmp = a.rank - b.rank;
    } else if (sortCol === 'team') {
      cmp = parseInt(a.team_key.replace('frc', '')) - parseInt(b.team_key.replace('frc', ''));
    } else if (sortCol === 'wlt') {
      cmp = a.record.wins - b.record.wins;
      if (cmp === 0) cmp = a.record.losses - b.record.losses;
    } else if (sortCol.startsWith('sort_')) {
      const idx = parseInt(sortCol.replace('sort_', ''));
      cmp = (a.sort_orders?.[idx] ?? 0) - (b.sort_orders?.[idx] ?? 0);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  }) : [];

  const sortArrow = (col: string) => sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h2 className="text-3xl font-header text-white">TBA EVENT DATA</h2>
      <label className="space-y-2 block">
        <span className="text-[10px] uppercase font-bold text-slate-500">
          Event ({seasonEvents.length} found)
        </span>
        <select
          className="w-full bg-slate-900 border-2 border-slate-800 rounded-xl px-3 py-3 text-slate-100 text-sm focus:border-blue-600 focus:outline-none appearance-none"
          value={eventKey}
          onChange={(e) => onSetEvent(selectedSeason, e.target.value || null)}
        >
          <option value="">Use local teams (no TBA event)</option>
          {seasonEvents.map(event => (
            <option key={event.key} value={event.key}>
              {event.start_date} • {event.name} ({event.event_code})
            </option>
          ))}
        </select>
        {isLoadingEvents && (
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading events...
          </p>
        )}
      </label>
      {currentEvent && (
        <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-4">
          <p className="font-bold text-slate-200">{currentEvent.name}</p>
          <p className="text-xs text-slate-500">{currentEvent.start_date} — {currentEvent.end_date} • {[currentEvent.city, currentEvent.state_prov].filter(Boolean).join(', ')}</p>
        </div>
      )}

      {lastUpdated && (
        <p className="text-[10px] text-slate-600 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Last updated: {new Date(lastUpdated).toLocaleTimeString()}
          {loading && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <button onClick={() => setTab('rankings')} className={`${tabStyles} ${tab === 'rankings' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500'}`}>Rankings</button>
        <button onClick={() => setTab('matches')} className={`${tabStyles} ${tab === 'matches' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500'}`}>Matches</button>
        <button onClick={() => setTab('stats')} className={`${tabStyles} ${tab === 'stats' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500'}`}>Stats</button>
        <button onClick={() => setTab('alliances')} className={`${tabStyles} ${tab === 'alliances' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500'}`}>Alliances</button>
      </div>

      {loading && !lastUpdated && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}

      {tab === 'rankings' && rankings?.rankings && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <th className="text-left py-2 px-2 cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort('rank')}>Rank{sortArrow('rank')}</th>
                <th className="text-left py-2 px-2 cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort('team')}>Team{sortArrow('team')}</th>
                <th className="text-center py-2 px-2 cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort('wlt')}>W-L-T{sortArrow('wlt')}</th>
                {rankings.sort_order_info?.map((info, i) => (
                  <th key={i} className="text-center py-2 px-2 cursor-pointer hover:text-slate-300 select-none" onClick={() => toggleSort(`sort_${i}`)}>{info.name}{sortArrow(`sort_${i}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRankings.map(r => (
                <tr key={r.team_key} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                  <td className="py-2 px-2 font-bold text-slate-300">{r.rank}</td>
                  <td className="py-2 px-2 font-bold"><TbaTeamLink teamKey={r.team_key} /></td>
                  <td className="py-2 px-2 text-center text-slate-400">{r.record.wins}-{r.record.losses}-{r.record.ties}</td>
                  {r.sort_orders?.map((val, i) => (
                    <td key={i} className="py-2 px-2 text-center text-slate-400">{typeof val === 'number' ? val.toFixed(rankings.sort_order_info?.[i]?.precision ?? 2) : val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'rankings' && !rankings?.rankings && !loading && (
        <p className="text-slate-500 text-sm text-center py-8">No rankings available yet.</p>
      )}

      {tab === 'matches' && (
        <div className="space-y-2">
          {playedMatches.length === 0 && !loading && (
            <p className="text-slate-500 text-sm text-center py-8">No played matches available yet.</p>
          )}
          {playedMatches.map(m => {
            const label = m.comp_level === 'qm' ? `Q${m.match_number}` : `${m.comp_level.toUpperCase()}${m.set_number}-${m.match_number}`;
            const hasScore = m.alliances.red.score >= 0 && m.alliances.blue.score >= 0;
            return (
              <div key={m.key} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                <span className="font-bold text-slate-300 w-16 text-sm">{label}</span>
                <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
                  <div className={`rounded-lg p-2 ${m.winning_alliance === 'red' ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-800/50'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-red-400 font-bold">Red</span>
                      {hasScore && <span className="font-bold text-slate-200">{m.alliances.red.score}</span>}
                    </div>
                    <p className="text-slate-400 truncate">{m.alliances.red.team_keys.map((k, i) => (<span key={k}>{i > 0 && ', '}<TbaTeamLink teamKey={k} /></span>))}</p>
                  </div>
                  <div className={`rounded-lg p-2 ${m.winning_alliance === 'blue' ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-slate-800/50'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400 font-bold">Blue</span>
                      {hasScore && <span className="font-bold text-slate-200">{m.alliances.blue.score}</span>}
                    </div>
                    <p className="text-slate-400 truncate">{m.alliances.blue.team_keys.map((k, i) => (<span key={k}>{i > 0 && ', '}<TbaTeamLink teamKey={k} /></span>))}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'stats' && (
        <div className="overflow-x-auto">
          {oprEntries.length === 0 && !loading ? (
            <p className="text-slate-500 text-sm text-center py-8">No OPR/DPR data available yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                  <th className="text-left py-2 px-2">#</th>
                  <th className="text-left py-2 px-2">Team</th>
                  <th className="text-center py-2 px-2">OPR</th>
                  <th className="text-center py-2 px-2">DPR</th>
                  <th className="text-center py-2 px-2">CCWM</th>
                </tr>
              </thead>
              <tbody>
                {oprEntries.map(([teamKey, opr], i) => (
                  <tr key={teamKey} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                    <td className="py-2 px-2 text-slate-500">{i + 1}</td>
                    <td className="py-2 px-2 font-bold"><TbaTeamLink teamKey={teamKey} /></td>
                    <td className="py-2 px-2 text-center text-green-400">{opr.toFixed(2)}</td>
                    <td className="py-2 px-2 text-center text-red-400">{(oprs?.dprs?.[teamKey] ?? 0).toFixed(2)}</td>
                    <td className="py-2 px-2 text-center text-slate-300">{(oprs?.ccwms?.[teamKey] ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'alliances' && (
        <div className="space-y-3">
          {alliances.length === 0 && !loading ? (
            <p className="text-slate-500 text-sm text-center py-8">No alliance selections available yet.</p>
          ) : (
            alliances.map((a, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="font-bold text-slate-200 mb-2">{a.name || `Alliance ${i + 1}`}</p>
                <div className="flex flex-wrap gap-2">
                  {a.picks.map((pick, j) => (
                    <span key={j} className={`px-3 py-1 rounded-lg text-sm font-bold ${j === 0 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800 text-slate-300'}`}>
                      <TbaTeamLink teamKey={pick} />
                    </span>
                  ))}
                </div>
                {a.status && (
                  <p className="text-xs text-slate-500 mt-2">{a.status.level} — {a.status.status}{a.status.record ? ` (${a.status.record.wins}-${a.status.record.losses}-${a.status.record.ties})` : ''}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default App;
