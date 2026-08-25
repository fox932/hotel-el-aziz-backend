import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import { pool } from '../db.js'

dotenv.config()

const rooms = [
  {
    slug: 'chambre-simple',
    name: 'Chambre Simple',
    capacity_text: '1 personne',
    bed_text: '1 lit simple · 16 m²',
    guests: 1,
    price: 4500,
    total_units: 6,
    amenities: ['Wi-Fi gratuit', 'Salle de bain privée', 'Climatisation', 'TV'],
    description:
      "Une chambre simple et fonctionnelle, idéale pour un séjour d'affaires ou en solo. Tout le confort essentiel, à deux pas du centre de Thaniet El Had.",
  },
  {
    slug: 'chambre-double',
    name: 'Chambre Double',
    capacity_text: '2 personnes',
    bed_text: '1 lit double · 20 m²',
    guests: 2,
    price: 6500,
    total_units: 8,
    amenities: ['Wi-Fi gratuit', 'Salle de bain privée', 'Climatisation', 'TV', 'Parking'],
    description:
      'Une chambre lumineuse et confortable pensée pour deux personnes, avec vue dégagée sur les hauteurs de Thaniet El Had. Literie de qualité et tout le nécessaire pour un séjour reposant.',
  },
  {
    slug: 'chambre-twin',
    name: 'Chambre Twin',
    capacity_text: '2 personnes',
    bed_text: '2 lits simples · 20 m²',
    guests: 2,
    price: 7200,
    total_units: 5,
    amenities: ['Wi-Fi gratuit', 'Salle de bain privée', 'Climatisation', 'TV'],
    description:
      'Deux lits simples séparés, parfaite pour des amis ou collègues voyageant ensemble sans partager le même lit.',
  },
  {
    slug: 'chambre-familiale',
    name: 'Chambre Familiale',
    capacity_text: '4 personnes',
    bed_text: '2 chambres · 32 m²',
    guests: 4,
    price: 9800,
    total_units: 4,
    amenities: ['Wi-Fi gratuit', 'Salle de bain privée', 'Climatisation', 'TV', 'Parking'],
    description:
      "Deux chambres communicantes pour la famille, avec assez d'espace pour voyager avec des enfants en toute tranquillité.",
  },
  {
    slug: 'suite',
    name: 'Suite',
    capacity_text: '3 personnes',
    bed_text: 'Salon séparé · 38 m²',
    guests: 3,
    price: 12000,
    total_units: 3,
    amenities: ['Wi-Fi gratuit', 'Salle de bain privée', 'Climatisation', 'TV', 'Parking', 'Service de chambre'],
    description:
      "Notre hébergement le plus spacieux, avec un salon séparé pour se détendre après une journée de randonnée dans la forêt de cèdres.",
  },
]

const offers = [
  {
    title: 'Séjour week-end -15%',
    description: 'Réservez 2 nuits ou plus du jeudi au samedi et profitez de 15% de réduction.',
    discount_percent: 15,
  },
  {
    title: 'Réservation anticipée -10%',
    description: 'Réservez au moins 30 jours à l’avance et économisez 10% sur votre séjour.',
    discount_percent: 10,
  },
]

async function seed() {
  console.log('→ Insertion des chambres...')
  for (const r of rooms) {
    await pool.query(
      `INSERT INTO rooms (slug, name, capacity_text, bed_text, guests, price, total_units, amenities, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name, capacity_text = EXCLUDED.capacity_text, bed_text = EXCLUDED.bed_text,
         guests = EXCLUDED.guests, price = EXCLUDED.price, total_units = EXCLUDED.total_units,
         amenities = EXCLUDED.amenities, description = EXCLUDED.description`,
      [r.slug, r.name, r.capacity_text, r.bed_text, r.guests, r.price, r.total_units, r.amenities, r.description]
    )
  }

  console.log('→ Insertion des offres...')
  for (const o of offers) {
    await pool.query(
      `INSERT INTO offers (title, description, discount_percent) VALUES ($1,$2,$3)`,
      [o.title, o.description, o.discount_percent]
    )
  }

  const adminUser = process.env.SEED_ADMIN_USERNAME || 'admin'
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'changeme123'
  const hash = await bcrypt.hash(adminPass, 10)

  console.log('→ Création du compte admin...')
  await pool.query(
    `INSERT INTO admins (username, password_hash, role)
     VALUES ($1, $2, 'reception')
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [adminUser, hash]
  )

  console.log(`✓ Seed terminé. Compte admin : "${adminUser}" / mot de passe : "${adminPass}"`)
  await pool.end()
}

seed().catch((err) => {
  console.error('✗ Échec du seed :', err)
  process.exit(1)
})
