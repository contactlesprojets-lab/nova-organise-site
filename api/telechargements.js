// Passerelle entre le site et Airtable pour la page Fiches à imprimer.
// La clé d'accès reste ici, côté serveur (variables d'environnement
// Vercel) : elle n'est jamais envoyée au navigateur. Réutilise les mêmes
// variables (AIRTABLE_TOKEN, AIRTABLE_BASE_ID) que /api/ressources.js,
// puisque la table Fiches imprimables vit dans la même base Airtable.

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
      const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent('Fiches imprimables')}`)
      if (offset) url.searchParams.set('offset', offset)
      const reponse = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!reponse.ok) throw new Error(`Airtable « Fiches imprimables » : ${reponse.status}`)
      const json = await reponse.json()
      records.push(...json.records)
      offset = json.offset
    } while (offset)

    // Une fiche en réserve (Visible décoché) ne doit jamais atteindre le
    // navigateur : c'est ce filtre, pas juste un masquage côté affichage,
    // qui garantit qu'elle reste vraiment invisible tant qu'Anne Laure n'a
    // pas coché la case dans Airtable.
    const fiches = records
      .filter((r) => r.fields['Visible'] && r.fields['Titre'] && (r.fields['Fichier PDF'] || [])[0])
      .map((r) => {
        const piece = r.fields['Fichier PDF'][0]
        return {
          id: r.id,
          titre: r.fields['Titre'] ?? '',
          description: r.fields['Description'] ?? '',
          ficheFamille: r.fields['Fiche (famille)'] ?? '',
          trancheAge: r.fields["Tranche d'âge"] ?? '',
          categorieSite: r.fields['Catégorie site'] ?? '',
          // Le champ pièce jointe « Fichier PDF » renvoie une URL re-signée
          // par Airtable à chaque lecture ; le champ texte « Lien PDF » est
          // une URL figée collée une fois, qui expire au bout de quelques
          // heures. Ne jamais revenir à ce dernier pour le téléchargement.
          lienPdf: piece.url,
          imageCouverture: piece.thumbnails?.large?.url ?? '',
          datePublication: formaterDate(r.fields['Date de publication']),
        }
      })

    // Le résultat peut être resservi pendant 5 minutes sans réinterroger
    // Airtable : plus rapide, et on reste loin des limites de leur API.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')
    res.status(200).json({ fiches })
  } catch (erreur) {
    console.error('Lecture Airtable impossible :', erreur.message)
    res.status(502).json({ erreur: 'Lecture Airtable impossible' })
  }
}
