import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { api, getApiErrorMessage } from '@/lib/api';
import BottomNavigation from '@/components/BottomNavigation';

type PrivacyZone = {
  id: number;
  user_id: number;
  name: string;
  geojson: unknown;
  created_at: string;
};

function safeJsonPreview(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

const PrivacyZones = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [zones, setZones] = useState<PrivacyZone[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [geojsonText, setGeojsonText] = useState('');
  const [creating, setCreating] = useState(false);

  const canCreate = useMemo(() => name.trim().length > 0 && geojsonText.trim().length > 0, [name, geojsonText]);

  const fetchZones = async () => {
    try {
      setLoading(true);
      const res = await api.get('/privacy/zones');
      setZones(res.zones || []);
    } catch (err) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to load privacy zones'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const handleCreate = async () => {
    if (!canCreate) return;

    let geojson: unknown;
    try {
      geojson = JSON.parse(geojsonText);
    } catch {
      toast({
        title: 'Invalid GeoJSON',
        description: 'GeoJSON must be valid JSON.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCreating(true);
      await api.post('/privacy/zones', { name: name.trim(), geojson });
      toast({
        title: 'Created',
        description: 'Privacy zone created',
      });
      setName('');
      setGeojsonText('');
      fetchZones();
    } catch (err) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to create privacy zone'),
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (zoneId: number) => {
    try {
      await api.delete(`/privacy/zones/${zoneId}`);
      setZones((prev) => prev.filter((z) => z.id !== zoneId));
      toast({
        title: 'Deleted',
        description: 'Privacy zone deleted',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: getApiErrorMessage(err, 'Failed to delete privacy zone'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display font-semibold text-foreground">Privacy Zones</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Zone</CardTitle>
            <CardDescription>
              Zones are stored as GeoJSON polygons and can be used to hide sensitive areas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="zone-name">Name</Label>
              <Input
                id="zone-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Home, Office, ..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zone-geojson">GeoJSON</Label>
              <Textarea
                id="zone-geojson"
                value={geojsonText}
                onChange={(e) => setGeojsonText(e.target.value)}
                placeholder='{"type":"Polygon","coordinates":[[[lng,lat],[lng,lat],[lng,lat],[lng,lat]]]}'
                className="min-h-[140px] font-mono"
              />
            </div>

            <Button onClick={handleCreate} disabled={!canCreate || creating} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              {creating ? 'Creating…' : 'Create Privacy Zone'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Zones</CardTitle>
            <CardDescription>
              {loading ? 'Loading…' : `${zones.length} zone${zones.length === 1 ? '' : 's'}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="text-muted-foreground">Loading privacy zones…</div>
            ) : zones.length === 0 ? (
              <div className="text-muted-foreground">No privacy zones yet.</div>
            ) : (
              zones.map((zone) => (
                <div key={zone.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{zone.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(zone.created_at).toLocaleString()}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(zone.id)}
                      title="Delete zone"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <details className="mt-3">
                    <summary className="text-sm text-muted-foreground cursor-pointer">View GeoJSON</summary>
                    <pre className="mt-2 text-xs bg-muted/30 rounded-md p-3 overflow-auto">
                      {safeJsonPreview(zone.geojson)}
                    </pre>
                  </details>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default PrivacyZones;
