import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../db.js'
import { requireCustomer } from '../middleware/auth.js'

const router = Router()

function signCustomerToken(customer) {
  return jwt.sign(
    { type: 'customer', id: customer.id, name: customer.name, email: customer.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, phone, password } = req.body
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nom, email et mot de passe sont requis' })
  }

  const { rows: existing } = await pool.query('SELECT id FROM customers WHERE email = $1', [email])
  if (existing[0]) return res.status(409).json({ error: 'Cet email est déjà utilisé' })

  const hash = await bcrypt.hash(password, 10)
  const { rows } = await pool.query(
    `INSERT INTO customers (name, email, phone, password_hash) VALUES ($1,$2,$3,$4)
     RETURNING id, name, email, phone`,
    [name, email, phone ?? null, hash]
  )

  const customer = rows[0]
  res.status(201).json({ customer, token: signCustomerToken(customer) })
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' })

  const { rows } = await pool.query('SELECT * FROM customers WHERE email = $1', [email])
  const customer = rows[0]
  if (!customer) return res.status(401).json({ error: 'Identifiants incorrects' })

  const valid = await bcrypt.compare(password, customer.password_hash)
  if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' })

  const { password_hash, ...safeCustomer } = customer
  res.json({ customer: safeCustomer, token: signCustomerToken(safeCustomer) })
})

// GET /api/auth/me
router.get('/me', requireCustomer, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, phone FROM customers WHERE id = $1', [req.customer.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Compte introuvable' })
  res.json(rows[0])
})

export default router
