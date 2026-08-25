import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// GET /api/offers — offres actives
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM offers WHERE active = true ORDER BY created_at DESC`
  )
  res.json(rows)
})

export default router
