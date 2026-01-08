# Teams System Implementation

## Overview
The comprehensive teams system enables users to collaborate, compete, and conquer territory together. Team members' runs contribute to collective stats, challenges, and territory ownership.

**Core Philosophy**: "You don't just run for yourself — you run for your team."

## Features Implemented

### 1. Team Creation & Management
- **Create Teams**: Users can create teams with names, descriptions, and colors
- **Join Teams**: Via shareable invitation links (`/invite/:code`)
- **Member Management**: Admins can remove members, view member lists
- **Role System**: Admin vs Member roles with different permissions

### 2. Team Stats Dashboard
**Real-time Aggregation**
- Total distance (all-time, weekly, monthly)
- Total runs count
- Territories owned (linked to team_id on territories table)
- Active member count
- Member contribution percentages

**Endpoints**:
- `GET /teams/:teamId/stats` - Team overview with real-time calculation
- `GET /teams/:teamId/contributions` - Member-by-member breakdown with rankings

### 3. Team Challenges
**Challenge Types**:
- **Distance**: Run X km as a team within timeframe
- **Territory**: Capture X zones collectively
- **Consistency**: Each member runs Y times per week

**Challenge Lifecycle**:
- Admin creates challenge with target value and deadline
- Progress auto-updates when members complete runs
- Status transitions: `active` → `completed` when target reached
- Feed activity logged on completion

**Endpoints**:
- `POST /teams/:teamId/challenges` - Create (admin only)
- `GET /teams/:teamId/challenges` - List all challenges
- `PATCH /teams/:teamId/challenges/:id` - Update progress

### 4. Team Activity Feed
**Activity Types**:
- `run_completed` - Member finished a run (distance, duration, tiles captured)
- `territory_captured` - Team captured new zone
- `challenge_created` - Admin created new challenge
- `challenge_completed` - Team completed challenge
- `member_joined` - New member joined

**Auto-Logging**:
- Run submissions automatically log to team feed
- Challenge completions trigger feed entries
- All activities include timestamp and user info

**Endpoint**:
- `GET /teams/:teamId/feed` - Chronological activity stream

### 5. Team Competitions
**Multi-Team Competitions**:
- Create competitions with `is_team_based: true`
- Teams join competitions as units
- Team leaderboard aggregates member scores
- Prizes/badges awarded to winning teams

**Endpoints**:
- `POST /competitions/:id/teams/:teamId` - Join team to competition
- `GET /competitions/:id/team-leaderboard` - Rankings with scores
- `GET /competitions/:id/teams` - List participating teams

### 6. Territory Ownership
**Schema Enhancement**:
```sql
ALTER TABLE territories ADD COLUMN team_id INTEGER REFERENCES teams(id);
ALTER TABLE territories ADD COLUMN ownership_percentage NUMERIC(5,2) DEFAULT 0.0;
```

**Planned Logic** (not yet implemented):
- When team member captures territory, link to `team_id`
- Calculate `ownership_percentage` based on member contributions to that zone
- Display team colors on map for team-owned territories
- Territory disputes resolve based on team strength

### 7. Team Page UI
**Route**: `/team/:teamId`

**Tabs**:
1. **Overview**: Weekly/monthly stats, top contributors
2. **Stats**: Detailed member contributions with percentages
3. **Challenges**: Active and completed challenges with progress bars
4. **Activity**: Chronological feed of team activities

**Components**:
- `src/pages/Team.tsx` - Main team page with tabbed interface
- Real-time data fetching from multiple endpoints
- Responsive design with gradients and animations
- Role-based UI (admins see additional controls)

## Database Schema

### New Tables
```sql
-- Team challenges
CREATE TABLE team_challenges (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'distance', 'territory', 'consistency', 'runs'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_value NUMERIC(10,2) NOT NULL,
  current_value NUMERIC(10,2) DEFAULT 0.0,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team activity feed
CREATE TABLE team_feed (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  activity_type VARCHAR(50) NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cached team stats (for performance)
CREATE TABLE team_stats (
  team_id INTEGER PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  total_distance_km NUMERIC(10,2) DEFAULT 0.0,
  total_runs INTEGER DEFAULT 0,
  territories_owned INTEGER DEFAULT 0,
  weekly_distance_km NUMERIC(10,2) DEFAULT 0.0,
  monthly_distance_km NUMERIC(10,2) DEFAULT 0.0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Member contribution tracking
CREATE TABLE team_member_stats (
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  distance_km NUMERIC(10,2) DEFAULT 0.0,
  runs_count INTEGER DEFAULT 0,
  territories_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  PRIMARY KEY (team_id, user_id)
);
```

### Enhanced Columns
```sql
-- Teams table enhancements
ALTER TABLE teams ADD COLUMN team_color VARCHAR(7) DEFAULT '#7C3AED';
ALTER TABLE teams ADD COLUMN team_avatar TEXT;
ALTER TABLE teams ADD COLUMN rules JSONB;

-- Territory team ownership
ALTER TABLE territories ADD COLUMN team_id INTEGER REFERENCES teams(id);
ALTER TABLE territories ADD COLUMN ownership_percentage NUMERIC(5,2) DEFAULT 0.0;
```

## Backend Routes

### Team Management (`teamRoutes.js`)
- `POST /teams` - Create team
- `GET /teams/:id/members` - List members with roles
- `POST /teams/:id/invitations` - Generate shareable invite link
- `POST /teams/join/:code` - Join via invitation code
- `DELETE /teams/:id/members/:userId` - Remove member (admin)

### Team Stats (`teamRoutes.js`)
- `GET /teams/:id/stats` - Real-time aggregated stats
- `GET /teams/:id/contributions` - Member contribution breakdown

### Team Challenges (`teamRoutes.js`)
- `POST /teams/:id/challenges` - Create challenge (admin)
- `GET /teams/:id/challenges` - List challenges
- `PATCH /teams/:id/challenges/:id` - Update progress

### Team Feed (`teamRoutes.js`)
- `GET /teams/:id/feed` - Activity stream
- `addTeamActivity(client, teamId, userId, type, data)` - Helper function

### Competitions (`competitionRoutes.js`)
- `POST /competitions/:id/teams/:teamId` - Join team
- `GET /competitions/:id/team-leaderboard` - Team rankings
- `GET /competitions/:id/teams` - List participating teams

## Frontend Components

### Pages
- `src/pages/Team.tsx` - Main team dashboard
- `src/pages/Social.tsx` - Enhanced with team management
- `src/pages/Competitions.tsx` - Team competition support
- `src/pages/Invite.tsx` - Invitation landing page

### Routes (`App.tsx`)
```tsx
<Route path="/team/:teamId" element={<Team />} />
<Route path="/invite/:code" element={<Invite />} />
```

## Usage Examples

### Create a Challenge (Admin)
```javascript
const response = await api.post(`/teams/${teamId}/challenges`, {
  type: 'distance',
  title: 'Marathon Month',
  description: 'Run 100km together this month',
  target_value: 100,
  ends_at: '2025-01-31T23:59:59Z'
});
```

### View Team Stats
```javascript
const stats = await api.get(`/teams/${teamId}/stats`);
// Returns: { total_distance, total_runs, territories_owned, member_count, weekly_distance, monthly_distance }
```

### Get Member Contributions
```javascript
const contributions = await api.get(`/teams/${teamId}/contributions`);
// Returns: [{ username, distance_contributed, contribution_percentage, runs_contributed, ... }]
```

## Integration with Runs

When a user completes a run (`POST /runs`), the backend automatically:

1. **Updates Team Member Stats**:
   - Adds distance to `team_member_stats`
   - Increments runs count
   - Updates territories count

2. **Logs to Team Feed**:
   ```javascript
   await addTeamActivity(client, teamId, userId, 'run_completed', {
     distance_km: 5.2,
     duration_sec: 1800,
     tiles_captured: 3
   });
   ```

3. **Updates Active Challenges**:
   - Increments `current_value` for distance challenges
   - Changes status to `completed` when target reached
   - Logs completion to feed

4. **Checks for Completions**:
   - Detects newly completed challenges
   - Logs `challenge_completed` activity

## Anti-Cheat Measures (Planned)

### Speed Validation
- Already implemented: `MAX_SPEED_M_S = 10 m/s` in `runRoutes.js`
- Rejects runs with segments exceeding limit

### GPS Accuracy
- Frontend uses `enableHighAccuracy: true` for geolocation
- Backend validates point sequence and timestamp gaps

### Future Enhancements
- Team contribution caps (configurable via `rules` JSONB)
- Decay mechanics for inactive members
- Anomaly detection for suspicious patterns

## Next Steps

### Priority 1: Territory Team Ownership
- Implement logic to link territories to `team_id` when member captures
- Calculate `ownership_percentage` based on member contributions
- Display team colors on map for team territories

### Priority 2: Challenge UI Enhancements
- Add admin challenge creation dialog in Team page
- Progress bars with animations
- Completion celebrations/notifications

### Priority 3: Map Visualization
- Team territory overlay on map
- Color-coded zones (team color vs rival colors)
- Territory dispute indicators

### Priority 4: Real-time Updates
- WebSocket integration for live feed updates
- Push notifications for challenge completions
- Live leaderboard updates during competitions

### Priority 5: Advanced Anti-Cheat
- Machine learning anomaly detection
- Peer review system for suspicious runs
- Automatic flagging and manual review queue

## API Response Examples

### Team Stats Response
```json
{
  "ok": true,
  "stats": {
    "total_distance": 247.3,
    "total_runs": 45,
    "territories_owned": 12,
    "member_count": 6,
    "weekly_distance": 32.1,
    "monthly_distance": 128.4
  }
}
```

### Contributions Response
```json
{
  "ok": true,
  "contributions": [
    {
      "id": 1,
      "username": "alex_runner",
      "role": "admin",
      "distance_contributed": 98.2,
      "runs_contributed": 18,
      "territories_contributed": 5,
      "contribution_percentage": 39.7,
      "last_run_at": "2025-01-15T14:30:00Z"
    }
  ]
}
```

### Feed Response
```json
{
  "ok": true,
  "feed": [
    {
      "id": 123,
      "user_id": 1,
      "username": "alex_runner",
      "activity_type": "run_completed",
      "data": {
        "distance_km": 5.2,
        "duration_sec": 1800,
        "tiles_captured": 2
      },
      "created_at": "2025-01-15T14:35:00Z"
    }
  ]
}
```

## Configuration

### Environment Variables
No additional variables needed - uses existing:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Token signing for auth

### Team Rules (JSONB)
Stored in `teams.rules` column:
```json
{
  "daily_max_distance_km": 50,
  "contribution_cap_percentage": 40,
  "territory_decay_days": 30,
  "min_active_days_per_week": 3
}
```

## Testing

### Manual Test Flow
1. Create team → Generate invite link → Share with friend
2. Both users complete runs → Check stats update
3. Admin creates challenge → Members run → Watch progress
4. View team feed → Verify activities logged
5. Navigate to `/team/:id` → Explore tabs

### Curl Examples
```bash
# Get team stats
curl http://localhost:4000/teams/1/stats \
  -H "Authorization: Bearer YOUR_JWT"

# Create challenge
curl -X POST http://localhost:4000/teams/1/challenges \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "distance",
    "title": "Weekly Sprint",
    "target_value": 50,
    "ends_at": "2025-01-22T23:59:59Z"
  }'
```

## Performance Considerations

### Database Indexes
```sql
CREATE INDEX idx_team_members_team_user ON team_members(team_id, user_id);
CREATE INDEX idx_team_feed_team_created ON team_feed(team_id, created_at DESC);
CREATE INDEX idx_team_challenges_team_status ON team_challenges(team_id, status);
CREATE INDEX idx_territories_team ON territories(team_id) WHERE team_id IS NOT NULL;
```

### Caching Strategy
- Consider Redis for frequently accessed team stats
- Cache invalidation on run completion
- Pre-aggregate weekly/monthly stats in `team_stats` table

### Query Optimization
- Use `EXPLAIN ANALYZE` on stats endpoints
- Limit feed queries to last 100 items
- Paginate member contributions for large teams

## Known Limitations

1. **Territory Ownership**: Schema ready, logic not yet implemented
2. **Real-time Updates**: Uses polling, not WebSocket
3. **Challenge Progress**: Only distance challenges auto-update
4. **Feed Pagination**: Returns all items (no pagination yet)
5. **Team Colors on Map**: UI components not yet linked to map rendering

## Conclusion

The teams system is fully functional for core collaboration features:
- ✅ Team creation and management
- ✅ Invitation system
- ✅ Stats aggregation and contribution tracking
- ✅ Challenge creation and progress tracking
- ✅ Activity feed logging
- ✅ Team competitions
- ✅ Comprehensive UI dashboard

**Next major milestone**: Territory ownership visualization and anti-cheat enhancements.
