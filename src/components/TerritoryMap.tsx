import { useEffect, useMemo, useState } from 'react';
import { motion } from "framer-motion";
import { apiFetch } from '@/lib/api';

type Territory = {
  tile_id: string;
  owner_id: number;
  strength: number;
  geojson: { type: string; coordinates: number[][][] };
};

const TerritoryMap = () => {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiFetch('/territories?limit=300');
        if (!mounted) return;
        setTerritories(res.territories || []);
      } catch (err: any) {
        if (!mounted) return;
        setError(err.message || 'Failed to load territories');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const bbox = useMemo(() => {
    const lats: number[] = [];
    const lngs: number[] = [];
    territories.forEach((t) => {
      const coords = t.geojson?.coordinates?.[0] || [];
      coords.forEach(([lng, lat]) => {
        lats.push(lat);
        lngs.push(lng);
      });
    });
    if (!lats.length || !lngs.length) return null;
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [territories]);

  const project = (lng: number, lat: number) => {
    if (!bbox) return { x: 0, y: 0 };
    const { minLat, maxLat, minLng, maxLng } = bbox;
    const w = maxLng - minLng || 1;
    const h = maxLat - minLat || 1;
    const x = ((lng - minLng) / w) * 800;
    const y = (1 - (lat - minLat) / h) * 600;
    return { x, y };
  };

  const territoryPolys = territories.map((t) => {
    const coords = t.geojson?.coordinates?.[0] || [];
    const pts = coords.map(([lng, lat]) => project(lng, lat));
    return { tileId: t.tile_id, owner: t.owner_id, strength: t.strength, pts };
  });

  const colorFor = (ownerId: number) => {
    const palette = ['#22d3ee', '#f97316', '#a855f7', '#10b981', '#f43f5e'];
    return palette[ownerId % palette.length] || '#22d3ee';
  };

  return (
    <div className="relative w-full h-[600px] rounded-2xl overflow-hidden border-glow">
      <div className="absolute inset-0 bg-gradient-hero bg-grid-pattern" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          Loading territories...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && bbox && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 600">
          {territoryPolys.map((poly, idx) => (
            <motion.polygon
              key={poly.tileId}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 0.55, scale: 1 }}
              transition={{ duration: 0.5, delay: idx * 0.01 }}
              points={poly.pts.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={colorFor(poly.owner)}
              stroke={colorFor(poly.owner)}
              strokeWidth="1.5"
              className="animate-territory-pulse"
            />
          ))}
        </svg>
      )}

      <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-4">
        <div className="bg-card/80 backdrop-blur-md px-4 py-3 rounded-xl border-glow">
          <p className="text-muted-foreground text-xs uppercase tracking-wider">Tiles Shown</p>
          <p className="text-primary font-display text-2xl glow-text">{territories.length}</p>
        </div>
        <div className="bg-card/80 backdrop-blur-md px-4 py-3 rounded-xl border-glow">
          <p className="text-muted-foreground text-xs uppercase tracking-wider">Owners</p>
          <p className="text-accent font-display text-2xl glow-territory">
            {new Set(territories.map((t) => t.owner_id)).size}
          </p>
        </div>
        <div className="bg-card/80 backdrop-blur-md px-4 py-3 rounded-xl border-glow">
          <p className="text-muted-foreground text-xs uppercase tracking-wider">Strength Avg</p>
          <p className="text-territory-pink font-display text-2xl">
            {territories.length
              ? (territories.reduce((s, t) => s + (t.strength || 0), 0) / territories.length).toFixed(1)
              : 0}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TerritoryMap;
