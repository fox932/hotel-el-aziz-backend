import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// GET /api/rooms — liste toutes les chambres
router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM rooms ORDER BY price ASC')
  res.json(rows)
})

// GET /api/rooms/:slug — détail d'une chambre
router.get('/:slug', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM rooms WHERE slug = $1', [req.params.slug])
  if (!rows[0]) return res.status(404).json({ error: 'Chambre introuvable' })
  res.json(rows[0])
})

// GET /api/rooms/:slug/availability?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD
// Calcule combien d'unités de ce type de chambre restent libres sur la période.
router.get('/:slug/availability', async (req, res) => {
  const { checkin, checkout } = req.query
  if (!checkin || !checkout) {
    return res.status(400).json({ error: 'checkin et checkout sont requis' })
  }

  const { rows: roomRows } = await pool.query('SELECT * FROM rooms WHERE slug = $1', [req.params.slug])
  const room = roomRows[0]
  if (!room) return res.status(404).json({ error: 'Chambre introuvable' })

  // Chambres déjà réservées qui chevauchent la période demandée
  // (chevauchement classique : existing.check_in < requested.check_out AND existing.check_out > requested.check_in)
  const { rows: overlapRows } = await pool.query(
    `SELECT COALESCE(SUM(rooms_count), 0) AS booked
     FROM bookings
     WHERE room_id = $1
       AND status IN ('confirme', 'en_attente')
       AND check_in < $3
       AND check_out > $2`,
    [room.id, checkin, checkout]
  )

  const booked = Number(overlapRows[0].booked)
  const available = Math.max(0, room.total_units - booked)

  res.json({
    slug: room.slug,
    total_units: room.total_units,
    booked,
    available,
    status: available === 0 ? 'unavailable' : available <= 2 ? 'limited' : 'available',
  })
})

export default router
