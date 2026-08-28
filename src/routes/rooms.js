import { Router } from 'express'
import { pool } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'

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

// ---------------------------------------------------------------------------
// Routes admin (protégées par un token JWT admin)
// ---------------------------------------------------------------------------

function slugify(text) {
  return text
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // enlève les accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// POST /api/rooms — créer une nouvelle chambre (admin)
router.post('/', requireAdmin, async (req, res) => {
  const {
    name, price, total_units, capacity_text, bed_text, guests,
    amenities = [], description = '', image_url = null, slug,
  } = req.body

  if (!name || price == null || total_units == null) {
    return res.status(400).json({ error: 'Nom, prix et nombre d\'unités sont requis' })
  }

  const finalSlug = slug ? slugify(slug) : slugify(name)

  try {
    const { rows } = await pool.query(
      `INSERT INTO rooms
        (slug, name, price, total_units, capacity_text, bed_text, guests, amenities, description, image_url, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
       RETURNING *`,
      [finalSlug, name, price, total_units, capacity_text ?? null, bed_text ?? null,
       guests ?? null, amenities, description, image_url]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') { // unique_violation sur slug
      return res.status(409).json({ error: 'Une chambre avec un slug similaire existe déjà' })
    }
    console.error(err)
    res.status(500).json({ error: 'Erreur lors de la création de la chambre' })
  }
})

// PATCH /api/rooms/:id — modifier une chambre (admin) — prix, unités, description, etc.
router.patch('/:id', requireAdmin, async (req, res) => {
  const allowedFields = [
    'name', 'price', 'total_units', 'capacity_text', 'bed_text',
    'guests', 'amenities', 'description', 'image_url', 'active',
  ]
  const updates = []
  const values = []
  let i = 1

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = $${i}`)
      values.push(req.body[field])
      i++
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' })
  }

  values.push(req.params.id)
  const { rows } = await pool.query(
    `UPDATE rooms SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  )
  if (!rows[0]) return res.status(404).json({ error: 'Chambre introuvable' })
  res.json(rows[0])
})

// DELETE /api/rooms/:id — supprimer une chambre (admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { rows: bookingRows } = await pool.query(
    `SELECT COUNT(*) FROM bookings WHERE room_id = $1 AND status IN ('confirme','en_attente')`,
    [req.params.id]
  )
  if (Number(bookingRows[0].count) > 0) {
    return res.status(409).json({
      error: 'Impossible de supprimer : des réservations actives existent pour cette chambre. Désactivez-la plutôt.',
    })
  }

  const { rows } = await pool.query('DELETE FROM rooms WHERE id = $1 RETURNING id', [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Chambre introuvable' })
  res.status(204).end()
})

export default router
