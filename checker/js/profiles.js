import fop2025 from '../../25-26/profile.js';

export const LIMITS = Object.freeze({ archiveBytes:25*1024*1024, expandedBytes:100*1024*1024, entryBytes:10*1024*1024, entries:4000, milliseconds:30000 });
const PROFILES = [
  fop2025,
  {
    id:'java-general',
    checks:['java.sources','archive.extras'],
  },
];

export function getProfile(id) {
  const profile = PROFILES.find(p=>p.id===id);
  if (!profile) throw new Error('Choose a recognised coursework profile.');
  return profile;
}
