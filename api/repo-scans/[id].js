import { getScanById } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id } = req.query || {};

  if (!id) {
    return res.status(400).json({ error: 'Scan ID parameter is required' });
  }

  try {
    const record = await getScanById(id);
    if (!record) {
      return res.status(404).json({ error: 'Scan result not found.' });
    }
    return res.status(200).json(record);
  } catch (err) {
    console.error('[Vercel API Error /api/repo-scans/[id]]:', err);
    return res.status(500).json({ error: 'Internal server error fetching scan record.' });
  }
}
