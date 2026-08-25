import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import roomsRouter from './routes/rooms.js'
import bookingsRouter from './routes/bookings.js'
import offersRouter from './routes/offers.js'
import authRouter from './routes/auth.js'
import adminRouter from './routes/admin.js'

dotenv.config()

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'Hôtel El Aziz API' }))

app.use('/api/rooms', roomsRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/offers', offersRouter)
app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)

// 404
app.use((req, res) => res.status(404).json({ error: 'Route introuvable' }))

// gestion d'erreurs générique
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Erreur serveur' })
})

const port = process.env.PORT || 4000
app.listen(port, () => {
  console.log(`✓ API Hôtel El Aziz lancée sur http://localhost:${port}`)
})
