import jwt from 'jsonwebtoken'

function extractToken(req) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')
  return scheme === 'Bearer' ? token : null
}

/** Requires a valid JWT for an admin account. Attaches req.admin. */
export function requireAdmin(req, res, next) {
  const token = extractToken(req)
  if (!token) return res.status(401).json({ error: 'Authentification requise' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (payload.type !== 'admin') throw new Error('wrong token type')
    req.admin = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' })
  }
}

/** Requires a valid JWT for a customer account. Attaches req.customer. */
export function requireCustomer(req, res, next) {
  const token = extractToken(req)
  if (!token) return res.status(401).json({ error: 'Authentification requise' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (payload.type !== 'customer') throw new Error('wrong token type')
    req.customer = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' })
  }
}
