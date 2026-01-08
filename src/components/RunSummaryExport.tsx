import { useRef, useState } from 'react';
import { Share2, Download, Copy, X, Clock, Zap, Map, Route, Flag, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';

interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

type ExportType = 'route' | 'territory' | null;

interface RunSummaryExportProps {
  distance: number;
  time: string;
  pace: string;
  territoriesClaimed: number;
  speed: number;
  elevation?: number;
  activityType: 'run' | 'cycle';
  gpsPoints?: GPSPoint[];
  capturedTerritory?: any;
  onClose: () => void;
  // New prop to skip type selection (for direct access from history)
  initialExportType?: ExportType;
}

const RunSummaryExport = ({
  distance,
  time,
  pace,
  territoriesClaimed,
  speed,
  elevation,
  activityType,
  gpsPoints = [],
  capturedTerritory,
  onClose,
  initialExportType = null,
}: RunSummaryExportProps) => {
  const { toast } = useToast();
  const exportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<ExportType>(initialExportType);

  // Calculate bounds and scaling for SVG route
  const getRouteData = () => {
    if (gpsPoints.length < 2) return null;
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    gpsPoints.forEach(point => {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLng = Math.min(minLng, point.lng);
      maxLng = Math.max(maxLng, point.lng);
    });
    
    const latRange = maxLat - minLat || 0.001;
    const lngRange = maxLng - minLng || 0.001;
    const padding = 0.15;
    
    minLat -= latRange * padding;
    maxLat += latRange * padding;
    minLng -= lngRange * padding;
    maxLng += lngRange * padding;
    
    return { minLat, maxLat, minLng, maxLng, latRange: maxLat - minLat, lngRange: maxLng - minLng };
  };

  const routeData = getRouteData();

  // Convert GPS coords to SVG coordinates
  const toSvgCoords = (lat: number, lng: number, width: number, height: number) => {
    if (!routeData) return { x: 0, y: 0 };
    const x = ((lng - routeData.minLng) / routeData.lngRange) * width;
    const y = height - ((lat - routeData.minLat) / routeData.latRange) * height;
    return { x, y };
  };

  // Generate SVG path string
  const generatePathString = (width: number, height: number) => {
    if (gpsPoints.length < 2) return '';
    
    const points = gpsPoints.map(p => toSvgCoords(p.lat, p.lng, width, height));
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    
    return path;
  };

  // Generate closed territory polygon path (buffer around route)
  const generateTerritoryPath = (width: number, height: number, bufferPx: number = 25) => {
    if (gpsPoints.length < 2) return '';
    
    const points = gpsPoints.map(p => toSvgCoords(p.lat, p.lng, width, height));
    
    // Create offset polygons (simplified buffer)
    const leftPoints: { x: number; y: number }[] = [];
    const rightPoints: { x: number; y: number }[] = [];
    
    for (let i = 0; i < points.length; i++) {
      let angle: number;
      if (i === 0) {
        angle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
      } else if (i === points.length - 1) {
        angle = Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x);
      } else {
        const angle1 = Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x);
        const angle2 = Math.atan2(points[i + 1].y - points[i].y, points[i + 1].x - points[i].x);
        angle = (angle1 + angle2) / 2;
      }
      
      const perpAngle = angle + Math.PI / 2;
      leftPoints.push({
        x: points[i].x + Math.cos(perpAngle) * bufferPx,
        y: points[i].y + Math.sin(perpAngle) * bufferPx,
      });
      rightPoints.push({
        x: points[i].x - Math.cos(perpAngle) * bufferPx,
        y: points[i].y - Math.sin(perpAngle) * bufferPx,
      });
    }
    
    // Create closed polygon path
    let path = `M ${leftPoints[0].x} ${leftPoints[0].y}`;
    for (let i = 1; i < leftPoints.length; i++) {
      path += ` L ${leftPoints[i].x} ${leftPoints[i].y}`;
    }
    // Connect to right side and go back
    for (let i = rightPoints.length - 1; i >= 0; i--) {
      path += ` L ${rightPoints[i].x} ${rightPoints[i].y}`;
    }
    path += ' Z';
    
    return path;
  };

  const generateSummaryText = () => {
    const emoji = activityType === 'run' ? '🏃' : '🚴';
    let text = `${emoji} ${activityType === 'run' ? 'Run' : 'Ride'} Complete!

📏 ${distance.toFixed(2)} km
⏱️ ${time}
⚡ ${pace}/km`;

    if (exportType === 'territory' && territoriesClaimed > 0) {
      text += `\n🗺️ ${territoriesClaimed} tile${territoriesClaimed > 1 ? 's' : ''} conquered!`;
    }

    text += `\n\n#TerritoryRunner #Running #Fitness`;
    return text;
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateSummaryText());
      toast({
        title: 'Copied!',
        description: 'Summary copied to clipboard',
      });
    } catch (err) {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadScreenshot = async () => {
    if (!exportRef.current) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      const suffix = exportType === 'territory' ? 'territory' : 'route';
      link.download = `run-${distance.toFixed(1)}km-${suffix}-${new Date().toISOString().slice(0,10)}.png`;
      link.click();
      
      toast({
        title: 'Downloaded!',
        description: 'Your run image has been saved',
      });
    } catch (err) {
      console.error('Screenshot failed:', err);
      toast({
        title: 'Export Failed',
        description: 'Could not generate image',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareToStrava = () => {
    const summary = generateSummaryText();
    const intent = `https://www.strava.com/mobile/post?message=${encodeURIComponent(summary)}`;
    window.open(intent, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Run',
          text: generateSummaryText(),
        });
      } catch (err) {
        // User cancelled
      }
    }
  };

  const svgWidth = 380;
  const svgHeight = 320;
  const pathString = generatePathString(svgWidth, svgHeight);
  const territoryPath = generateTerritoryPath(svgWidth, svgHeight, 30);
  const startPoint = gpsPoints.length > 0 ? toSvgCoords(gpsPoints[0].lat, gpsPoints[0].lng, svgWidth, svgHeight) : null;
  const endPoint = gpsPoints.length > 1 ? toSvgCoords(gpsPoints[gpsPoints.length - 1].lat, gpsPoints[gpsPoints.length - 1].lng, svgWidth, svgHeight) : null;

  // Export Type Selection Screen
  if (exportType === null) {
    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[9999] p-4">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-50 bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-2">Great Run!</h2>
            <p className="text-white/60">Choose how you want to share</p>
          </div>

          {/* Quick Stats */}
          <div className="flex justify-center gap-6 py-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{distance.toFixed(2)}</div>
              <div className="text-white/50 text-sm">km</div>
            </div>
            <div className="w-px bg-white/20" />
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{time}</div>
              <div className="text-white/50 text-sm">time</div>
            </div>
            {territoriesClaimed > 0 && (
              <>
                <div className="w-px bg-white/20" />
                <div className="text-center">
                  <div className="text-3xl font-bold text-cyan-400">{territoriesClaimed}</div>
                  <div className="text-white/50 text-sm">tiles</div>
                </div>
              </>
            )}
          </div>

          {/* Export Type Options */}
          <div className="space-y-3">
            <p className="text-white/40 text-xs uppercase tracking-wider text-center mb-4">
              Choose Export Type
            </p>

            {/* Route Only Option */}
            <button
              onClick={() => setExportType('route')}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/50 rounded-2xl p-5 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Route className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold mb-1 group-hover:text-cyan-400 transition-colors">
                    Route Only
                  </div>
                  <div className="text-white/50 text-sm">
                    Clean, minimal path with transparent background. Perfect for social media.
                  </div>
                </div>
              </div>
            </button>

            {/* Territory Option */}
            <button
              onClick={() => setExportType('territory')}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 rounded-2xl p-5 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Map className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold mb-1 group-hover:text-blue-400 transition-colors">
                    Conquered Territory
                  </div>
                  <div className="text-white/50 text-sm">
                    Show your route with filled territory area. Great for flexing your gains!
                  </div>
                  {territoriesClaimed > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1 text-cyan-400 text-xs bg-cyan-500/10 px-2 py-1 rounded">
                      <Flag className="w-3 h-3" />
                      <span>{territoriesClaimed} new tiles claimed</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* Skip to Stats */}
          <div className="pt-4 border-t border-white/10">
            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full text-white/50 hover:text-white hover:bg-white/5"
            >
              Skip for now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Route Only Export View
  if (exportType === 'route') {
    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[9999] p-4 overflow-y-auto">
        {/* Back button */}
        <button
          onClick={() => setExportType(null)}
          className="absolute top-6 left-6 z-50 bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all flex items-center gap-2"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-50 bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="w-full max-w-md flex flex-col items-center gap-6">
          {/* Export Canvas - Route Only */}
          <div 
            ref={exportRef}
            className="w-full aspect-square max-w-[400px] relative flex flex-col items-center justify-center p-6"
            style={{ background: 'transparent' }}
          >
            <div className="flex-1 w-full flex items-center justify-center">
              <svg 
                width={svgWidth} 
                height={svgHeight} 
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="overflow-visible"
              >
                <defs>
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
                
                {pathString && (
                  <>
                    <path
                      d={pathString}
                      fill="none"
                      stroke="rgba(59, 130, 246, 0.3)"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#glow)"
                    />
                    <path
                      d={pathString}
                      fill="none"
                      stroke="url(#routeGradient)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                )}
                
                {startPoint && (
                  <g>
                    <circle cx={startPoint.x} cy={startPoint.y} r="14" fill="rgba(34, 197, 94, 0.2)" />
                    <circle cx={startPoint.x} cy={startPoint.y} r="8" fill="#22c55e" />
                    <circle cx={startPoint.x} cy={startPoint.y} r="4" fill="white" />
                  </g>
                )}
                
                {endPoint && (
                  <g>
                    <circle cx={endPoint.x} cy={endPoint.y} r="14" fill="rgba(249, 115, 22, 0.2)" />
                    <circle cx={endPoint.x} cy={endPoint.y} r="8" fill="#f97316" />
                    <circle cx={endPoint.x} cy={endPoint.y} r="4" fill="white" />
                  </g>
                )}
              </svg>
            </div>

            {/* Stats Overlay */}
            <div className="absolute bottom-4 left-4 right-4">
              <div 
                className="rounded-2xl p-4 backdrop-blur-md"
                style={{ 
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                <div className="flex items-baseline justify-center gap-2 mb-3">
                  <span className="text-4xl font-bold text-white tracking-tight">{distance.toFixed(2)}</span>
                  <span className="text-lg text-white/50 font-medium">km</span>
                </div>
                
                <div className="flex justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-white/40" />
                    <span className="text-white/80 font-medium">{time}</span>
                  </div>
                  <div className="w-px h-4 bg-white/20" />
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-white/40" />
                    <span className="text-white/80 font-medium">{pace}<span className="text-white/40 text-sm">/km</span></span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/5 text-center">
                  <span className="text-white/25 text-xs tracking-wider">TERRITORY RUNNER</span>
                </div>
              </div>
            </div>

            <div className="absolute top-4 left-4">
              <div 
                className="rounded-full px-3 py-1.5 flex items-center gap-2"
                style={{ 
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <span className="text-base">{activityType === 'run' ? '🏃' : '🚴'}</span>
                <span className="text-white/70 text-xs font-medium uppercase tracking-wide">
                  {activityType === 'run' ? 'Run' : 'Ride'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full max-w-[400px] space-y-3">
            <Button
              onClick={handleDownloadScreenshot}
              disabled={isExporting}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-xl py-6 transition-all flex items-center justify-center gap-2 font-semibold text-base"
            >
              <Download className="w-5 h-5" />
              {isExporting ? 'Creating Image...' : 'Download Image'}
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleShareToStrava}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl py-4 transition-all flex items-center justify-center gap-2 font-medium"
              >
                <Share2 className="w-4 h-4" />
                Strava
              </Button>
              
              <Button
                onClick={handleCopyToClipboard}
                className="bg-white/10 hover:bg-white/20 text-white border-0 rounded-xl py-4 transition-all flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy
              </Button>
            </div>

            {typeof navigator !== 'undefined' && navigator.share && (
              <Button
                onClick={handleNativeShare}
                className="w-full bg-white/5 hover:bg-white/10 text-white/60 border-0 rounded-xl py-3 transition-all text-sm"
              >
                More sharing options...
              </Button>
            )}

            <Button
              onClick={onClose}
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10 rounded-xl py-5 transition-all font-medium mt-2"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Territory Export View
  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      {/* Back button */}
      <button
        onClick={() => setExportType(null)}
        className="absolute top-6 left-6 z-50 bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all flex items-center gap-2"
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-50 bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      <div className="w-full max-w-md flex flex-col items-center gap-6">
        {/* Export Canvas - Territory View */}
        <div 
          ref={exportRef}
          className="w-full aspect-square max-w-[400px] relative flex flex-col items-center justify-center p-6"
          style={{ background: 'transparent' }}
        >
          <div className="flex-1 w-full flex items-center justify-center">
            <svg 
              width={svgWidth} 
              height={svgHeight} 
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="overflow-visible"
            >
              <defs>
                <filter id="territoryGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <linearGradient id="territoryFill" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="territoryStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              
              {/* Territory fill area */}
              {territoryPath && (
                <>
                  {/* Glow effect */}
                  <path
                    d={territoryPath}
                    fill="rgba(6, 182, 212, 0.15)"
                    stroke="none"
                    filter="url(#territoryGlow)"
                  />
                  {/* Main territory fill */}
                  <path
                    d={territoryPath}
                    fill="url(#territoryFill)"
                    stroke="url(#territoryStroke)"
                    strokeWidth="2"
                    strokeOpacity="0.6"
                  />
                </>
              )}
              
              {/* Route path on top */}
              {pathString && (
                <path
                  d={pathString}
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity="0.9"
                />
              )}
              
              {/* Start point */}
              {startPoint && (
                <g>
                  <circle cx={startPoint.x} cy={startPoint.y} r="12" fill="rgba(34, 197, 94, 0.3)" />
                  <circle cx={startPoint.x} cy={startPoint.y} r="7" fill="#22c55e" />
                  <circle cx={startPoint.x} cy={startPoint.y} r="3" fill="white" />
                </g>
              )}
              
              {/* End point */}
              {endPoint && (
                <g>
                  <circle cx={endPoint.x} cy={endPoint.y} r="12" fill="rgba(249, 115, 22, 0.3)" />
                  <circle cx={endPoint.x} cy={endPoint.y} r="7" fill="#f97316" />
                  <circle cx={endPoint.x} cy={endPoint.y} r="3" fill="white" />
                </g>
              )}
            </svg>
          </div>

          {/* Stats Overlay - Territory style */}
          <div className="absolute bottom-4 left-4 right-4">
            <div 
              className="rounded-2xl p-4 backdrop-blur-md"
              style={{ 
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(6, 182, 212, 0.2)'
              }}
            >
              {/* Distance + Territory row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white tracking-tight">{distance.toFixed(2)}</span>
                  <span className="text-sm text-white/50 font-medium">km</span>
                </div>
                {territoriesClaimed > 0 && (
                  <div className="flex items-center gap-2 bg-cyan-500/20 px-3 py-1.5 rounded-full">
                    <Flag className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-400 font-bold">{territoriesClaimed}</span>
                    <span className="text-cyan-400/70 text-xs">tiles</span>
                  </div>
                )}
              </div>
              
              {/* Time and Pace */}
              <div className="flex justify-start gap-6">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-white/40" />
                  <span className="text-white/80 font-medium">{time}</span>
                </div>
                <div className="w-px h-4 bg-white/20" />
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-white/40" />
                  <span className="text-white/80 font-medium">{pace}<span className="text-white/40 text-sm">/km</span></span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-white/5 text-center">
                <span className="text-white/25 text-xs tracking-wider">TERRITORY RUNNER</span>
              </div>
            </div>
          </div>

          {/* Activity badge with conquest label */}
          <div className="absolute top-4 left-4">
            <div 
              className="rounded-full px-3 py-1.5 flex items-center gap-2"
              style={{ 
                background: 'rgba(6, 182, 212, 0.2)',
                border: '1px solid rgba(6, 182, 212, 0.3)'
              }}
            >
              <span className="text-base">{activityType === 'run' ? '🏃' : '🚴'}</span>
              <span className="text-cyan-300 text-xs font-medium uppercase tracking-wide">
                Territory Conquered
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-[400px] space-y-3">
          <Button
            onClick={handleDownloadScreenshot}
            disabled={isExporting}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl py-6 transition-all flex items-center justify-center gap-2 font-semibold text-base"
          >
            <Download className="w-5 h-5" />
            {isExporting ? 'Creating Image...' : 'Download Territory Map'}
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleShareToStrava}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl py-4 transition-all flex items-center justify-center gap-2 font-medium"
            >
              <Share2 className="w-4 h-4" />
              Strava
            </Button>
            
            <Button
              onClick={handleCopyToClipboard}
              className="bg-white/10 hover:bg-white/20 text-white border-0 rounded-xl py-4 transition-all flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy
            </Button>
          </div>

          {typeof navigator !== 'undefined' && navigator.share && (
            <Button
              onClick={handleNativeShare}
              className="w-full bg-white/5 hover:bg-white/10 text-white/60 border-0 rounded-xl py-3 transition-all text-sm"
            >
              More sharing options...
            </Button>
          )}

          <Button
            onClick={onClose}
            variant="outline"
            className="w-full border-white/20 text-white hover:bg-white/10 rounded-xl py-5 transition-all font-medium mt-2"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RunSummaryExport;
