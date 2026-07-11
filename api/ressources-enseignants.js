// Passerelle entre le site et Airtable pour la page Enseignants & AESH.
// La clé d'accès reste ici, côté serveur (variables d'environnement
// Vercel) : elle n'est jamais envoyée au navigateur.

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
      const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent('Ressources enseignants')}`)
      if (offset) url.searchParams.set('offset', offset)
      const reponse = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!reponse.ok) throw new Error(`Airtable « Ressources enseignants » : ${reponse.status}`)
      const json = await reponse.json()
      records.push(...json.records)
      offset = json.offset
    } while (offset)

    const ressources = records
      .filter((r) => r.fields['Titre'] && r.fields['Contenu'])
      .map((r) => ({
        id: r.id,
        titre: r.fields['Titre'] ?? '',
        type: r.fields['Type'] ?? '',
        troubleConcerne: r.fields['Trouble concerné'] ?? [],
        contenu: r.fields['Contenu'] ?? '',
        publicCible: r.fields['Public cible'] ?? [],
        lienTelechargeable: r.fields['Lien téléchargeable'] ?? '',
        source: r.fields['Source'] ?? '',
        lienSource: r.fields['Lien source'] ?? '',
        datePublication: formaterDate(r.fields['Date de publication']),
      }))

    // Le résultat peut être resservi pendant 5 minutes sans réinterroger
    // Airtable : plus rapide, et on reste loin des limites de leur API.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')
    res.status(200).json({ ressources })
  } catch (erreur) {
    console.error('Lecture Airtable impossible :', erreur.message)
    res.status(502).json({ erreur: 'Lecture Airtable impossible' })
  }
}
