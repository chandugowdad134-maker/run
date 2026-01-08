import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, MapPin, Clock, Activity, Navigation, RotateCcw, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import LiveRunMap from '@/components/LiveRunMap';
import RunContextPanel from '@/components/RunContextPanel';
import TerritoryClickPopup from '@/components/TerritoryClickPopup';
import { calculateTotalDistance, validateRunSpeed, getTerritoriesClaimed } from '@/lib/geoutils';
import { db } from '@/lib/db';
import { validateRunSubmission, calculateTerritoryAcquisition, GPSPoint as TerritoryGPSPoint } from '@/lib/territory';

interface GPSPoint {
  lat: number;
  lng: number;
  latitude: number;
  longitude: number;
  timestamp: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

type FollowMode = 'follow' | 'explore';
type GPSStatus = 'checking' | 'ready' | 'denied' | 'timeout' | 'unsupported';

const ActiveRun = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [gpsStatus, setGpsStatus] = useState<GPSStatus>('checking');
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [gpsPoints, setGpsPoints] = useState<GPSPoint[]>([]);
  const [currentPosition, setCurrentPosition] = useState<GPSPoint | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [currentHeading, setCurrentHeading] = useState<number | null>(null);
  const [followMode, setFollowMode] = useState<FollowMode>('follow');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [pausePosition, setPausePosition] = useState<GPSPoint | null>(null);
  const [lastDistanceMilestone, setLastDistanceMilestone] = useState(0);
  const [currentZoom, setCurrentZoom] = useState(16);
  const [clickedTerritory, setClickedTerritory] = useState<any>(null);
  const [territoryDetails, setTerritoryDetails] = useState<any>(null);
  const [activityType, setActivityType] = useState<'run' | 'cycle'>('run');
  
  const watchIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const zoomDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);

  // Calculate smart zoom based on speed
  const getSmartZoom = (speedKmh: number): number => {
    if (speedKmh < 5) return 17; // Walking - closest
    if (speedKmh < 10) return 16; // Slow jogging
    if (speedKmh < 15) return 15; // Moderate running
    return 14; // Fast running - wider view
  };

  // Dynamic zoom update based on speed changes
  useEffect(() => {
    if (isRunning && !isPaused && followMode === 'follow') {
      // Clear existing debounce
      if (zoomDebounceRef.current) {
        clearTimeout(zoomDebounceRef.current);
      }
      
      // Debounce zoom changes to avoid jitter
      zoomDebounceRef.current = setTimeout(() => {
        const newZoom = getSmartZoom(currentSpeed);
        if (Math.abs(newZoom - currentZoom) >= 1) {
          setCurrentZoom(newZoom);
        }
      }, 500); // 500ms debounce
    }
    
    return () => {
      if (zoomDebounceRef.current) {
        clearTimeout(zoomDebounceRef.current);
      }
    };
  }, [currentSpeed, isRunning, isPaused, followMode, currentZoom]);

  // Initialize GPS on mount (single position to check permission and get initial location)
  const initializeGPS = () => {
    if (!navigator.geolocation) {
      setGpsStatus('unsupported');
      toast({
        title: 'GPS Not Available',
        description: 'Your device does not support GPS tracking.',
        variant: 'destructive',
      });
      return;
    }

    setGpsStatus('checking');

    // Get initial position to verify permission and acquire GPS lock
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const initialPoint: GPSPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
          altitude: position.coords.altitude || undefined,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || undefined,
          heading: position.coords.heading !== null ? position.coords.heading : undefined,
        };

        setCurrentPosition(initialPoint);
        setGpsAccuracy(position.coords.accuracy);
        setGpsStatus('ready');

        toast({
          title: 'GPS Ready',
          description: `Location acquired with ±${position.coords.accuracy.toFixed(0)}m accuracy`,
        });
      },
      (error) => {
        console.error('GPS Error:', error);
        
        if (error.code === error.PERMISSION_DENIED) {
          setGpsStatus('denied');
          toast({
            title: 'Permission Denied',
            description: 'Please enable location access in your browser settings.',
            variant: 'destructive',
          });
        } else if (error.code === error.TIMEOUT) {
          setGpsStatus('timeout');
          toast({
            title: 'GPS Timeout',
            description: 'Could not acquire GPS signal. Make sure you\'re outdoors.',
            variant: 'destructive',
          });
        } else {
          setGpsStatus('timeout');
          toast({
            title: 'GPS Error',
            description: error.message || 'Failed to get GPS location.',
            variant: 'destructive',
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // 15 seconds for initial fix
        maximumAge: 0,
      }
    );
  };

  // Start continuous GPS tracking during run
  const startGPSTracking = () => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newPoint: GPSPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
          altitude: position.coords.altitude || undefined,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || undefined,
          heading: position.coords.heading !== null ? position.coords.heading : undefined,
        };

        setGpsAccuracy(position.coords.accuracy);
        setCurrentSpeed(position.coords.speed ? position.coords.speed * 3.6 : 0);
        setCurrentPosition(newPoint);
        
        // Update heading if available
        if (position.coords.heading !== null) {
          setCurrentHeading(position.coords.heading);
        }

        // Only add points if running and not paused
        if (isRunningRef.current && !isPausedRef.current) {
          setGpsPoints((prev) => {
            const updated = [...prev, newPoint];
            const totalDist = calculateTotalDistance(updated);
            setDistance(totalDist);
            return updated;
          });
        } else if (isPausedRef.current) {
          // Check for movement while paused (anti-cheat)
          if (pausePosition && calculateDistance(pausePosition, newPoint) > 0.015) {
            setShowResumePrompt(true);
          }
        }
      },
      (error) => {
        console.error('GPS Tracking Error:', error);
        toast({
          title: 'GPS Tracking Error',
          description: 'Lost GPS signal. Check your connection.',
          variant: 'destructive',
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      }
    );

    watchIdRef.current = watchId;
  };

  // Stop GPS tracking
  const stopGPSTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  // Start run
  const handleStart = () => {
    console.log('🏃 Starting run...', { gpsStatus, gpsAccuracy, currentPosition });
    
    setIsRunning(true);
    setIsPaused(false);
    isRunningRef.current = true;
    isPausedRef.current = false;
    startTimeRef.current = Date.now() - pausedTimeRef.current;
    startGPSTracking();

    intervalRef.current = setInterval(() => {
      setElapsedTime(Date.now() - startTimeRef.current);
    }, 100);

    toast({
      title: 'Run Started',
      description: 'GPS tracking is active. Good luck!',
    });
  };

  // Pause run
  const handlePause = () => {
    setIsPaused(true);
    isPausedRef.current = true;
    setPausePosition(currentPosition);
    pausedTimeRef.current = Date.now() - startTimeRef.current;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Set 2-minute pause reminder
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    pauseTimeoutRef.current = setTimeout(() => {
      toast({
        title: 'Still Paused?',
        description: "You've been paused for 2 minutes. Ready to resume your run?",
      });
    }, 120000);

    toast({
      title: 'Run Paused',
      description: 'GPS tracking paused.',
    });
  };

  // Resume run
  const handleResume = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    setPausePosition(null);
    setShowResumePrompt(false);
    startTimeRef.current = Date.now() - pausedTimeRef.current;

    intervalRef.current = setInterval(() => {
      setElapsedTime(Date.now() - startTimeRef.current);
    }, 100);

    // Clear pause timeout
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }

    toast({
      title: 'Run Resumed',
      description: 'GPS tracking active again.',
    });
  };

  // Confirm and save run (single click)
  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    stopGPSTracking();
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }

    if (gpsPoints.length < 2) {
      toast({
        title: 'Run Too Short',
        description: 'Not enough GPS data to save this run.',
        variant: 'destructive',
      });
      resetRun();
      return;
    }

    try {
      const durationSec = Math.floor(elapsedTime / 1000);
      const points: TerritoryGPSPoint[] = gpsPoints.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        timestamp: p.timestamp,
        accuracy: p.accuracy,
      }));

      // Local validation
      const validation = validateRunSubmission(points, activityType);
      if (!validation.valid) {
        toast({
          title: 'Run Validation Failed',
          description: validation.errors.join('. '),
          variant: 'destructive',
        });
        resetRun();
        return;
      }

      // Calculate territory acquisition locally
      const localTerritories = new Map(
        (await db.territories.toArray()).map(t => [t.tileId, { ownerId: t.ownerId, strength: t.strength }])
      );
      const { touchedTiles, updatedTiles } = calculateTerritoryAcquisition(points, user!.id.toString(), localTerritories);

      // Update local territories
      for (const update of updatedTiles) {
        await db.territories.put({
          tileId: update.tileId,
          ownerId: update.ownerId,
          strength: update.strength,
          geometry: null, // We'll compute on demand
          lastUpdated: Date.now()
        });
      }

      // Store run locally
      const runId = await db.runs.add({
        gpsPoints: points,
        distance: distance,
        duration: durationSec,
        activityType,
        timestamp: Date.now(),
        synced: false
      });

      // Add to sync queue
      await db.syncQueue.add({
        type: 'run',
        data: { runId, points, distance, durationSec, activityType, updatedTiles },
        timestamp: Date.now()
      });

      toast({
        title: 'Run Saved Locally!',
        description: `${distance.toFixed(2)}km in ${formatTime(elapsedTime)}`,
      });

      // Show territory conquest notification
      const conqueredTiles = updatedTiles.filter(tile => tile.flipped);
      if (conqueredTiles.length > 0) {
        toast({
          title: 'Territory Conquered! 🗺️',
          description: `You claimed ${conqueredTiles.length} new tile${conqueredTiles.length > 1 ? 's' : ''}!`,
        });
      }

      // Navigate back to home
      navigate('/');
    } catch (error) {
      console.error('Failed to save run locally:', error);
      toast({
        title: 'Failed to Save',
        description: 'Could not save your run. Please try again.',
        variant: 'destructive',
      });
    }

    resetRun();
  };

  // Show stop confirmation
  const handleStop = () => {
    setShowConfirmModal(true);
  };

  // Reset run state
  const resetRun = () => {
    setIsRunning(false);
    setIsPaused(false);
    isRunningRef.current = false;
    isPausedRef.current = false;
    setElapsedTime(0);
    setDistance(0);
    setCurrentSpeed(0);
    setGpsPoints([]);
    setGpsAccuracy(null);
    setCurrentHeading(null);
    setPausePosition(null);
    setShowResumePrompt(false);
    setShowConfirmModal(false);
    setLastDistanceMilestone(0);
    setFollowMode('follow');
    startTimeRef.current = 0;
    pausedTimeRef.current = 0;
    
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
  };

  // Format time
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate pace (min/km)
  const calculatePace = (): string => {
    if (distance === 0 || elapsedTime === 0) return '--:--';
    const paceMinPerKm = elapsedTime / 1000 / 60 / distance;
    const minutes = Math.floor(paceMinPerKm);
    const seconds = Math.floor((paceMinPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Calculate distance between two GPS points
  const calculateDistance = (point1: GPSPoint, point2: GPSPoint): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lng - point1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // Toggle follow mode
  const toggleFollowMode = () => {
    setFollowMode(prev => prev === 'follow' ? 'explore' : 'follow');
  };
  
  // Handle follow mode change from map (drag detection)
  const handleFollowModeChange = (mode: FollowMode) => {
    setFollowMode(mode);
    if (mode === 'explore') {
      toast({
        title: 'Manual Control',
        description: 'Map following disabled. Tap re-center to resume.',
      });
    }
  };

  // Handle territory click on map
  const handleTerritoryClick = async (territory: any) => {
    // For offline, just show basic territory info
    setTerritoryDetails(territory);
  };

  // Distance milestone notifications
  useEffect(() => {
    if (distance > 0 && isRunning && !isPaused) {
      const nextMilestone = Math.floor(distance / 0.5) * 0.5 + 0.5;
      if (distance >= nextMilestone && nextMilestone > lastDistanceMilestone) {
        toast({
          title: `Milestone Reached! 🏁`,
          description: `${nextMilestone.toFixed(1)} km completed! Territory expanded!`,
        });
        setLastDistanceMilestone(nextMilestone);
      }
    }
  }, [distance, lastDistanceMilestone, isRunning, isPaused, toast]);

  // Initialize GPS on mount
  useEffect(() => {
    initializeGPS();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopGPSTracking();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  const territoriesClaimed = getTerritoriesClaimed(gpsPoints);

  return (
    <div 
      className="fixed inset-0 bg-black"
      style={{ 
        paddingTop: 'env(safe-area-inset-top)', 
        paddingBottom: 'env(safe-area-inset-bottom)' 
      }}
    >
      {/* FULLSCREEN MAP - Only render when GPS position exists */}
      <div className="absolute inset-0">
        {currentPosition ? (
          <LiveRunMap 
            gpsPoints={gpsPoints}
            currentPosition={currentPosition}
            isTracking={isRunning && !isPaused}
            heading={currentHeading}
            followMode={followMode}
            smartZoom={currentZoom}
            onFollowModeChange={handleFollowModeChange}
            onTerritoryClick={handleTerritoryClick}
            showTerritories={isRunning}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-white text-lg font-semibold">Acquiring GPS Signal...</p>
              <p className="text-white/60 text-sm">Make sure location is enabled</p>
            </div>
          </div>
        )}
      </div>

      {/* TOP FLOATING HUD - Minimal Stats Bar */}
      {isRunning && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute top-0 left-0 right-0 z-[500] pt-safe"
        >
          <div className="mx-4 mt-4 bg-black/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl">
            <div className="px-4 py-3 grid grid-cols-3 divide-x divide-white/10">
              {/* Time */}
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-white">
                  {formatTime(elapsedTime)}
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wide">Time</div>
              </div>
              
              {/* Distance */}
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-cyan-400">
                  {distance.toFixed(2)}
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wide">Km</div>
              </div>
              
              {/* Pace */}
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-green-400">
                  {calculatePace()}
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wide">Pace</div>
              </div>
            </div>
            
            {/* Secondary stats row */}
            <div className="px-4 pb-3 flex justify-around text-xs">
              <div className="text-white/70">
                <span className="text-white/90 font-semibold">{currentSpeed.toFixed(1)}</span> km/h
              </div>
              <div className="text-white/70">
                <span className="text-white/90 font-semibold">{gpsPoints.length}</span> GPS pts
              </div>
              {gpsAccuracy !== null && (
                <div className={`font-semibold ${
                  gpsAccuracy < 10 ? 'text-green-400' : gpsAccuracy < 20 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  ±{gpsAccuracy.toFixed(0)}m
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* BOTTOM CONTROL PANEL - Big Buttons */}
      <div className="absolute bottom-0 left-0 right-0 z-[500] pb-safe">
        <div className="mx-4 mb-4">
          {!isRunning ? (
            /* BEFORE RUN - Start Button */
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col gap-4"
            >
              <div className="bg-black/80 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                <h2 className="text-2xl font-bold text-white mb-2">Ready to Run?</h2>
                <div className="mb-4">
                  {gpsStatus === 'checking' && (
                    <div className="text-yellow-400 text-sm flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                      Acquiring GPS signal...
                    </div>
                  )}
                  {gpsStatus === 'ready' && gpsAccuracy !== null && (
                    <p className={`text-sm ${
                      gpsAccuracy < 10 ? 'text-green-400' : 
                      gpsAccuracy < 20 ? 'text-yellow-400' : 'text-orange-400'
                    }`}>
                      ✓ GPS Ready: ±{gpsAccuracy.toFixed(0)}m accuracy
                    </p>
                  )}
                  {gpsStatus === 'denied' && (
                    <p className="text-red-400 text-sm">
                      ✗ Location permission denied. Enable in browser settings.
                    </p>
                  )}
                  {gpsStatus === 'timeout' && (
                    <p className="text-orange-400 text-sm">
                      ⚠ GPS timeout. Move outdoors or try again.
                    </p>
                  )}
                  {gpsStatus === 'unsupported' && (
                    <p className="text-red-400 text-sm">
                      ✗ GPS not supported on this device.
                    </p>
                  )}
                </div>
                
                {/* Activity Type Selector */}
                {gpsStatus === 'ready' && (
                  <div className="mb-4 space-y-3">
                    <p className="text-white/80 text-sm font-semibold">Select Activity:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setActivityType('run')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          activityType === 'run'
                            ? 'bg-cyan-500/20 border-cyan-400 shadow-lg shadow-cyan-500/20'
                            : 'bg-white/5 border-white/20 hover:border-white/40'
                        }`}
                      >
                        <div className="text-3xl mb-2">🏃</div>
                        <div className="text-white font-semibold">Run/Walk</div>
                        <div className="text-white/60 text-xs mt-1">2-20 km/h</div>
                      </button>
                      
                      <button
                        onClick={() => setActivityType('cycle')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          activityType === 'cycle'
                            ? 'bg-cyan-500/20 border-cyan-400 shadow-lg shadow-cyan-500/20'
                            : 'bg-white/5 border-white/20 hover:border-white/40'
                        }`}
                      >
                        <div className="text-3xl mb-2">🚴</div>
                        <div className="text-white font-semibold">Cycle</div>
                        <div className="text-white/60 text-xs mt-1">10-40 km/h</div>
                      </button>
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={handleStart}
                  className="w-full h-14 text-base font-bold bg-green-500 hover:bg-green-600 disabled:opacity-50"
                  disabled={gpsStatus !== 'ready' || !gpsAccuracy || gpsAccuracy > 50}
                >
                  <Play className="w-5 h-5 mr-2" />
                  {gpsStatus === 'ready' ? `Start ${activityType === 'run' ? 'Run' : 'Cycle'}` : 'Waiting for GPS...'}
                </Button>
                {gpsStatus === 'denied' || gpsStatus === 'timeout' ? (
                  <Button
                    variant="outline"
                    className="w-full mt-3 text-white border-white/20"
                    onClick={initializeGPS}
                  >
                    🔄 Retry GPS
                  </Button>
                ) : null}
              </div>
              
              {/* Cancel button - only visible before run starts */}
              <Button
                variant="outline"
                size="sm"
                className="text-white border-white/30 hover:bg-white/20 hover:border-white"
                onClick={() => navigate('/')}
              >
                Cancel
              </Button>
            </motion.div>
          ) : (
            /* DURING RUN - Control Buttons */
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-black/80 backdrop-blur-xl rounded-2xl p-4 border border-white/20"
            >
              <div className="flex gap-3 justify-center">
                <AnimatePresence mode="wait">
                  {isPaused ? (
                    <motion.div
                      key="paused"
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.8 }}
                      className="flex gap-3"
                    >
                      <Button
                        onClick={handleResume}
                        className="h-12 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold"
                      >
                        <Play className="w-5 h-5 mr-2" />
                        Resume
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleStop}
                        className="h-12 px-6 font-semibold"
                      >
                        <Square className="w-5 h-5 mr-2" />
                        Stop
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="running"
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.8 }}
                      className="flex gap-3"
                    >
                      <Button
                        onClick={handlePause}
                        className="h-12 px-6 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold"
                      >
                        <Pause className="w-5 h-5 mr-2" />
                        Pause
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleStop}
                        className="h-12 px-6 font-semibold"
                      >
                        <Square className="w-5 h-5 mr-2" />
                        Stop
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* RE-CENTER BUTTON (when in explore mode) */}
      {isRunning && followMode === 'explore' && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute bottom-28 right-4 z-[500]"
        >
          <Button
            onClick={toggleFollowMode}
            className="h-12 w-12 rounded-full shadow-2xl bg-blue-600 hover:bg-blue-700 p-0"
          >
            <Navigation className="w-5 h-5" />
          </Button>
        </motion.div>
      )}

      {/* DIMMED OVERLAY (when paused) */}
      {isPaused && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[400] flex items-center justify-center"
        >
          <div className="bg-yellow-500 text-black px-8 py-4 rounded-full font-bold text-xl shadow-2xl">
            ⏸ PAUSED
          </div>
        </motion.div>
      )}

      {/* STOP CONFIRMATION MODAL */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="bg-black/95 backdrop-blur-xl border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl">End Run?</DialogTitle>
            <DialogDescription className="text-white/70">
              Review your run summary before saving. This will claim territories based on your route.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center p-4 bg-white/5 rounded-lg">
              <span className="text-white/70">⏱ Time:</span>
              <span className="font-mono font-bold text-2xl">{formatTime(elapsedTime)}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-white/5 rounded-lg">
              <span className="text-white/70">📏 Distance:</span>
              <span className="font-mono font-bold text-2xl text-cyan-400">{distance.toFixed(2)} km</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-white/5 rounded-lg">
              <span className="text-white/70">🗺️ Territories:</span>
              <span className="font-mono font-bold text-2xl text-green-400">{territoriesClaimed}</span>
            </div>
          </div>
          <DialogFooter className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmModal(false)}
              className="flex-1"
            >
              Continue Running
            </Button>
            <Button 
              onClick={handleConfirmSave}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              ✅ Save Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MOVEMENT DETECTED MODAL */}
      <Dialog open={showResumePrompt} onOpenChange={setShowResumePrompt}>
        <DialogContent className="bg-yellow-500 text-black border-yellow-600">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              ⚠️ Movement Detected
            </DialogTitle>
            <DialogDescription className="text-black/80 font-medium">
              You're moving while paused. Would you like to resume your run?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowResumePrompt(false)}
              className="flex-1 border-black/20 text-black hover:bg-black/10"
            >
              Stay Paused
            </Button>
            <Button 
              onClick={handleResume}
              className="flex-1 bg-black hover:bg-black/90 text-yellow-400"
            >
              ▶️ Resume Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Context Panel - Slide up to see territory history */}
      <RunContextPanel
        currentPosition={currentPosition}
        isRunning={isRunning}
        isPaused={isPaused}
        currentUserId={user?.id}
      />

      {/* Territory Click Popup */}
      {territoryDetails && (
        <TerritoryClickPopup
          territory={territoryDetails}
          onClose={() => setTerritoryDetails(null)}
          currentUserId={user?.id}
        />
      )}
    </div>
  );
};

export default ActiveRun;
