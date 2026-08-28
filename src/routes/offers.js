import { Router } from 'express'
import { pool } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /api/offers — offres actives (public)
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM offers WHERE active = true ORDER BY created_at DESC`
  )
  res.json(rows)
})

// GET /api/offers/all — toutes les offres, actives ou non (admin)
router.get('/all', requireAdmin, async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM offers ORDER BY created_at DESC`)
  res.json(rows)
})

// POST /api/offers — créer une offre (admin)
router.post('/', requireAdmin, async (req, res) => {
  const { title, description = '', discount_percent = null, valid_until = null, image_url = null } = req.body

  if (!title) return res.status(400).json({ error: 'Le titre est requis' })

  const { rows } = await pool.query(
    `INSERT INTO offers (title, description, discount_percent, valid_until, image_url, active)
     VALUES ($1,$2,$3,$4,$5,true) RETURNING *`,
    [title, description, discount_percent, valid_until, image_url]
  )
  res.status(201).json(rows[0])
})

// PATCH /api/offers/:id — modifier une offre (admin)
router.patch('/:id', requireAdmin, async (req, res) => {
  const allowedFields = ['title', 'description', 'discount_percent', 'valid_until', 'image_url', 'active']
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
    `UPDATE offers SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  )
  if (!rows[0]) return res.status(404).json({ error: 'Offre introuvable' })
  res.json(rows[0])
})

// DELETE /api/offers/:id — supprimer une offre (admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('DELETE FROM offers WHERE id = $1 RETURNING id', [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Offre introuvable' })
  res.status(204).end()
})

export default router
