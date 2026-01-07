import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, MapPin, Clock, Activity, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import LiveRunMap from '@/components/LiveRunMap';
import { calculateTotalDistance, validateRunSpeed } from '@/lib/geoutils';

interface GPSPoint {
  lat: number;
  lng: number;
  latitude: number;
  longitude: number;
  timestamp: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
}

const ActiveRun = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [gpsPoints, setGpsPoints] = useState<GPSPoint[]>([]);
  const [currentPosition, setCurrentPosition] = useState<GPSPoint | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  
  const watchIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate distance between two GPS points (Haversine formula)
  const calculateDistance = (point1: GPSPoint, point2: GPSPoint): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLon = ((point2.lng - point1.lng) * Math.PI) / 180;
    const lat1 = (point1.lat * Math.PI) / 180;
    const lat2 = (point2.lat * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in km
  };

  // Start GPS tracking
  const startGPSTracking = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'GPS Not Available',
        description: 'Your device does not support GPS tracking.',
        variant: 'destructive',
      });
      return;
    }

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
        };

        setGpsAccuracy(position.coords.accuracy);
        setCurrentSpeed(position.coords.speed ? position.coords.speed * 3.6 : 0); // Convert m/s to km/h
        setCurrentPosition(newPoint);

        setGpsPoints((prev) => {
          const updated = [...prev, newPoint];
          // Recalculate distance using accurate Haversine
          const totalDist = calculateTotalDistance(updated);
          setDistance(totalDist);
          return updated;
        });
      },
      (error) => {
        console.error('GPS Error:', error);
        toast({
          title: 'GPS Error',
          description: 'Failed to get GPS location. Please check your permissions.',
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
    setIsRunning(true);
    setIsPaused(false);
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
    pausedTimeRef.current = Date.now() - startTimeRef.current;
    stopGPSTracking();

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    toast({
      title: 'Run Paused',
      description: 'GPS tracking paused.',
    });
  };

  // Resume run
  const handleResume = () => {
    setIsPaused(false);
    startTimeRef.current = Date.now() - pausedTimeRef.current;
    startGPSTracking();

    intervalRef.current = setInterval(() => {
      setElapsedTime(Date.now() - startTimeRef.current);
    }, 100);

    toast({
      title: 'Run Resumed',
      description: 'GPS tracking active again.',
    });
  };

  // Stop and save run
  const handleStop = async () => {
    stopGPSTracking();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
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
      const points = gpsPoints.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        timestamp: p.timestamp,
      }));

      const response = await api.post('/runs', {
        points,
        distanceKm: distance,
        durationSec,
      });

      toast({
        title: 'Run Saved!',
        description: `${distance.toFixed(2)}km in ${formatTime(elapsedTime)}`,
      });

      // Navigate back to home
      navigate('/');
    } catch (error) {
      console.error('Failed to save run:', error);
      toast({
        title: 'Failed to Save',
        description: 'Could not save your run. Please try again.',
        variant: 'destructive',
      });
    }

    resetRun();
  };

  // Reset run state
  const resetRun = () => {
    setIsRunning(false);
    setIsPaused(false);
    setElapsedTime(0);
    setDistance(0);
    setCurrentSpeed(0);
    setGpsPoints([]);
    setGpsAccuracy(null);
    startTimeRef.current = 0;
    pausedTimeRef.current = 0;
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopGPSTracking();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-foreground">Active Run</h1>
          <Button variant="ghost" onClick={() => navigate('/')}>
            Cancel
          </Button>
        </div>

        {/* Live GPS Map */}
        <Card className="p-0 overflow-hidden border-2 border-primary/20">
          <div className="w-full rounded-xl overflow-hidden relative" style={{ height: 'calc(100vh - 28rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))', minHeight: '280px', maxHeight: '450px' }}>
            <LiveRunMap 
              gpsPoints={gpsPoints}
              currentPosition={currentPosition}
              isTracking={isRunning && !isPaused}
            />
          </div>
        </Card>

        {/* Main Stats Card */}
        <Card className="p-8 bg-card/80 backdrop-blur-sm border-2">
          <div className="grid grid-cols-2 gap-8">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <Clock className="w-8 h-8 mx-auto mb-2 text-primary" />
              <div className="text-4xl font-display font-bold text-foreground mb-1">
                {formatTime(elapsedTime)}
              </div>
              <div className="text-sm text-muted-foreground">Time</div>
            </motion.div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <Navigation className="w-8 h-8 mx-auto mb-2 text-accent" />
              <div className="text-4xl font-display font-bold text-foreground mb-1">
                {distance.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">Kilometers</div>
            </motion.div>
          </div>
        </Card>

        {/* Secondary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center bg-card/60 backdrop-blur-sm">
            <Activity className="w-6 h-6 mx-auto mb-1 text-primary" />
            <div className="text-xl font-bold text-foreground">{calculatePace()}</div>
            <div className="text-xs text-muted-foreground">Pace (min/km)</div>
          </Card>

          <Card className="p-4 text-center bg-card/60 backdrop-blur-sm">
            <Activity className="w-6 h-6 mx-auto mb-1 text-accent" />
            <div className="text-xl font-bold text-foreground">{currentSpeed.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Speed (km/h)</div>
          </Card>

          <Card className="p-4 text-center bg-card/60 backdrop-blur-sm">
            <MapPin className="w-6 h-6 mx-auto mb-1 text-green-500" />
            <div className="text-xl font-bold text-foreground">{gpsPoints.length}</div>
            <div className="text-xs text-muted-foreground">GPS Points</div>
          </Card>
        </div>

        {/* GPS Accuracy Indicator */}
        {gpsAccuracy !== null && (
          <Card className="p-3 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">GPS Accuracy</span>
              <span
                className={`text-sm font-semibold ${
                  gpsAccuracy < 10
                    ? 'text-green-500'
                    : gpsAccuracy < 20
                    ? 'text-yellow-500'
                    : 'text-red-500'
                }`}
              >
                ±{gpsAccuracy.toFixed(0)}m
              </span>
            </div>
          </Card>
        )}

        {/* Control Buttons */}
        <div className="flex gap-4 justify-center pt-4">
          <AnimatePresence mode="wait">
            {!isRunning ? (
              <motion.div
                key="start"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Button
                  size="lg"
                  onClick={handleStart}
                  className="h-20 w-20 rounded-full shadow-lg"
                >
                  <Play className="w-8 h-8" />
                </Button>
              </motion.div>
            ) : isPaused ? (
              <motion.div
                key="resume"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="flex gap-4"
              >
                <Button
                  size="lg"
                  onClick={handleResume}
                  className="h-20 w-20 rounded-full shadow-lg bg-green-600 hover:bg-green-700"
                >
                  <Play className="w-8 h-8" />
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleStop}
                  className="h-20 w-20 rounded-full shadow-lg"
                >
                  <Square className="w-8 h-8" />
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="pause"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="flex gap-4"
              >
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={handlePause}
                  className="h-20 w-20 rounded-full shadow-lg"
                >
                  <Pause className="w-8 h-8" />
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleStop}
                  className="h-20 w-20 rounded-full shadow-lg"
                >
                  <Square className="w-8 h-8" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Instructions */}
        {!isRunning && (
          <Card className="p-4 bg-card/60 backdrop-blur-sm">
            <h3 className="font-semibold text-foreground mb-2">How to use:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Press Play to start tracking your run</li>
              <li>• GPS will track your route automatically</li>
              <li>• Pause anytime to take a break</li>
              <li>• Stop when done to save your run and claim territories!</li>
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ActiveRun;
