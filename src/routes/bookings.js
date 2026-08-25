import { Router } from 'express'
import { pool } from '../db.js'
import { requireAdmin, requireCustomer } from '../middleware/auth.js'

const router = Router()

function generateReservationNumber() {
  const n = Math.floor(100000 + Math.random() * 900000)
  return `ELAZIZ-${n}`
}

function nightsBetween(checkin, checkout) {
  const d = Math.round((new Date(checkout) - new Date(checkin)) / 86400000)
  return Math.max(1, d)
}

// POST /api/bookings — créer une réservation (public, avec ou sans compte client)
router.post('/', async (req, res) => {
  const {
    room_slug, check_in, check_out, adults = 1, children = 0, rooms_count = 1,
    guest_name, guest_email, guest_phone, customer_id = null,
  } = req.body

  if (!room_slug || !check_in || !check_out || !guest_name || !guest_email) {
    return res.status(400).json({ error: 'Champs requis manquants' })
  }
  if (new Date(check_out) <= new Date(check_in)) {
    return res.status(400).json({ error: 'La date de départ doit être après la date d’arrivée' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: roomRows } = await client.query(
      'SELECT * FROM rooms WHERE slug = $1 FOR UPDATE', [room_slug]
    )
    const room = roomRows[0]
    if (!room) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Chambre introuvable' })
    }

    const { rows: overlapRows } = await client.query(
      `SELECT COALESCE(SUM(rooms_count), 0) AS booked
       FROM bookings
       WHERE room_id = $1 AND status IN ('confirme', 'en_attente')
         AND check_in < $3 AND check_out > $2`,
      [room.id, check_in, check_out]
    )
    const booked = Number(overlapRows[0].booked)
    const available = room.total_units - booked

    if (available < rooms_count) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'Aucune disponibilité pour ces dates', available })
    }

    const nights = nightsBetween(check_in, check_out)
    const subtotal = room.price * nights * rooms_count
    const tax = 200 * nights * rooms_count
    const total_price = subtotal + tax
    const reservation_number = generateReservationNumber()

    const { rows: bookingRows } = await client.query(
      `INSERT INTO bookings
        (reservation_number, room_id, customer_id, guest_name, guest_email, guest_phone,
         check_in, check_out, adults, children, rooms_count, status, payment_status, total_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'en_attente','non_paye',$12)
       RETURNING *`,
      [reservation_number, room.id, customer_id, guest_name, guest_email, guest_phone,
       check_in, check_out, adults, children, rooms_count, total_price]
    )

    await client.query('COMMIT')
    res.status(201).json({
      ...bookingRows[0],
      room_name: room.name,
      nights,
      subtotal,
      tax,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ error: 'Erreur lors de la création de la réservation' })
  } finally {
    client.release()
  }
})

// GET /api/bookings — liste (admin uniquement), filtrable par statut
router.get('/', requireAdmin, async (req, res) => {
  const { status } = req.query
  const params = []
  let query = `
    SELECT b.*, r.name AS room_name, r.slug AS room_slug
    FROM bookings b JOIN rooms r ON r.id = b.room_id`
  if (status) {
    params.push(status)
    query += ` WHERE b.status = $1`
  }
  query += ' ORDER BY b.created_at DESC LIMIT 200'
  const { rows } = await pool.query(query, params)
  res.json(rows)
})

// GET /api/bookings/mine — réservations du client connecté
router.get('/mine', requireCustomer, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.*, r.name AS room_name, r.slug AS room_slug
     FROM bookings b JOIN rooms r ON r.id = b.room_id
     WHERE b.customer_id = $1
     ORDER BY b.check_in DESC`,
    [req.customer.id]
  )
  res.json(rows)
})

// GET /api/bookings/:reservationNumber — suivi d'une réservation (public)
router.get('/:reservationNumber', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.*, r.name AS room_name
     FROM bookings b JOIN rooms r ON r.id = b.room_id
     WHERE b.reservation_number = $1`,
    [req.params.reservationNumber]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Réservation introuvable' })
  res.json(rows[0])
})

// PATCH /api/bookings/:id — mettre à jour statut / paiement (admin uniquement)
router.patch('/:id', requireAdmin, async (req, res) => {
  const { status, payment_status } = req.body
  const allowedStatus = ['confirme', 'en_attente', 'termine', 'annule']
  const allowedPayment = ['paye', 'partiel', 'non_paye', 'rembourse']

  if (status && !allowedStatus.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' })
  }
  if (payment_status && !allowedPayment.includes(payment_status)) {
    return res.status(400).json({ error: 'Statut de paiement invalide' })
  }

  const { rows } = await pool.query(
    `UPDATE bookings SET
       status = COALESCE($1, status),
       payment_status = COALESCE($2, payment_status)
     WHERE id = $3 RETURNING *`,
    [status ?? null, payment_status ?? null, req.params.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Réservation introuvable' })
  res.json(rows[0])
})

export default router
