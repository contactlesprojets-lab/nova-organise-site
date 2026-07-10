// Passerelle entre le site et Airtable pour la page Ressources.
// La clé d'accès reste ici, côté serveur (variables d'environnement
// Vercel) : elle n'est jamais envoyée au navigateur.

// Table Astuces (base Nova-Organise) : chaque astuce est déjà rattachée à
// l'une des 8 catégories thématiques ci-dessous. On les fait correspondre
// aux 5 catégories réelles du site (voir ressources.html / SERIES).
const CATEGORIE_VERS_SERIE = {
  'Droits et démarches': 'COMPRENDRE',
  'Ressources TND': 'COMPRENDRE',
  'AEEH': 'TON PARCOURS',
  'AAH': 'TON PARCOURS',
  'Emploi': 'TON PARCOURS',
  'Cartes et transport': 'TON PARCOURS',
  'Scolarisation': 'EN CLASSE',
  'PCH et aidants': 'POUR VOUS',
}

function nettoyer(valeur) {
  return (valeur || '').replace(/[﻿\r\n]/g, '').trim()
}

function formaterDate(dateIso) {
  if (!dateIso) return ''
  const [annee, mois, jour] = dateIso.split('-')
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
  return `${Number(jour)} ${MOIS[Number(mois) - 1]} ${annee}`
}

export default async function handler(req, res) {
  const token = nettoyer(process.env.AIRTABLE_TOKEN)
  const baseId = nettoyer(process.env.AIRTABLE_BASE_ID)

  if (!token || !baseId) {
    res.status(503).json({ erreur: 'Airtable non configuré' })
    return
  }

  try {
    const records = []
    let offset
    do {
      const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent('Astuces')}`)
      if (offset) url.searchParams.set('offset', offset)
      const reponse = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!reponse.ok) throw new Error(`Airtable « Astuces » : ${reponse.status}`)
      const json = await reponse.json()
      records.push(...json.records)
      offset = json.offset
    } while (offset)

    const astuces = records
      .filter((r) => r.fields['Titre'] && r.fields['Contenu'])
      .map((r) => {
        const categorie = r.fields['Catégorie'] || ''
        return {
          id: r.id,
          titre: r.fields['Titre'] ?? '',
          contenu: r.fields['Contenu'] ?? '',
          serie: CATEGORIE_VERS_SERIE[categorie] ?? 'COMPRENDRE',
          source: r.fields['Source'] ?? '',
          datePublication: formaterDate(r.fields['Date de publication']),
          lien: r.fields['Lien ressource site'] ?? '',
        }
      })

    // Le résultat peut être resservi pendant 5 minutes sans réinterroger
    // Airtable : plus rapide, et on reste loin des limites de leur API.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')
    res.status(200).json({ astuces })
  } catch (erreur) {
    console.error('Lecture Airtable impossible :', erreur.message)
    res.status(502).json({ erreur: 'Lecture Airtable impossible' })
  }
}
