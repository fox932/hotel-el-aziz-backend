import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// POST /api/admin/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Identifiants requis' })

  const { rows } = await pool.query('SELECT * FROM admins WHERE username = $1', [username])
  const admin = rows[0]
  if (!admin) return res.status(401).json({ error: 'Identifiants incorrects' })

  const valid = await bcrypt.compare(password, admin.password_hash)
  if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' })

  const token = jwt.sign(
    { type: 'admin', id: admin.id, username: admin.username, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
  res.json({ admin: { id: admin.id, username: admin.username, role: admin.role }, token })
})

// GET /api/admin/me
router.get('/me', requireAdmin, (req, res) => {
  res.json(req.admin)
})

// GET /api/admin/stats — chiffres pour le tableau de bord
router.get('/stats', requireAdmin, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10)

  const [
    todayBookings, checkins, checkouts, occupied, totalUnits, revenueToday,
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM bookings WHERE created_at::date = $1`, [today]),
    pool.query(`SELECT COUNT(*) FROM bookings WHERE check_in = $1 AND status IN ('confirme','en_attente')`, [today]),
    pool.query(`SELECT COUNT(*) FROM bookings WHERE check_out = $1 AND status IN ('confirme','en_attente')`, [today]),
    pool.query(
      `SELECT COALESCE(SUM(rooms_count),0) FROM bookings
       WHERE status IN ('confirme','en_attente') AND check_in <= $1 AND check_out > $1`,
      [today]
    ),
    pool.query('SELECT COALESCE(SUM(total_units),0) FROM rooms'),
    pool.query(`SELECT COALESCE(SUM(total_price),0) FROM bookings WHERE created_at::date = $1`, [today]),
  ])

  const totalRoomUnits = Number(totalUnits.rows[0].coalesce)
  const occupiedUnits = Number(occupied.rows[0].coalesce)

  res.json({
    reservations_today: Number(todayBookings.rows[0].count),
    checkins_today: Number(checkins.rows[0].count),
    checkouts_today: Number(checkouts.rows[0].count),
    rooms_available: Math.max(0, totalRoomUnits - occupiedUnits),
    rooms_occupied: occupiedUnits,
    revenue_today: Number(revenueToday.rows[0].coalesce),
  })
})

export default router
