import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { pool } from '../db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(__dirname, '..', '..', 'sql', 'schema.sql')

async function migrate() {
  const sql = readFileSync(schemaPath, 'utf-8')
  console.log('→ Application du schéma...')
  await pool.query(sql)
  console.log('✓ Schéma appliqué avec succès.')
  await pool.end()
}

migrate().catch((err) => {
  console.error('✗ Échec de la migration :', err)
  process.exit(1)
})
