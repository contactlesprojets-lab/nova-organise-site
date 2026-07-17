/* ══════════════════════════════════════════════════════════════
   Cadenas email — logique partagée (toutes les pages)

   Une seule clé de stockage locale pour tout le site : une personne
   qui débloque une page ne doit pas avoir à ressaisir son email sur
   les 14 autres. On veut un vrai listing de personnes réellement
   intéressées, pas 14 sollicitations de la même personne.

   Pour changer le Google Form de destination : modifier uniquement
   CADENAS_CONFIG ci-dessous, un seul endroit pour tout le site.
   ══════════════════════════════════════════════════════════════ */
(function () {
  var CADENAS_CONFIG = {
    formAction: "https://docs.google.com/forms/d/e/1FAIpQLSfarwv0jFxzuBFfDdAESB1K5ZXRpJ42ZfKXEg2aBM6RbUEsow/formResponse",
    champEmail: "entry.885195692",
    champConsentement: "entry.495009272"
  };
  var CLE_STOCKAGE = 'novaOrganiseRessourcesDebloquees';

  var cadenas = document.getElementById('cadenas-verrou');
  var contenu = document.getElementById('verrou-contenu');
  var form = document.getElementById('form-cadenas');
  var merci = document.getElementById('cadenas-merci');
  if (!cadenas || !contenu || !form) return;

  function debloquer(sansAnimation) {
    contenu.hidden = false;
    form.hidden = true;
    if (merci) merci.hidden = false;
    if (!sansAnimation) {
      contenu.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* Déjà débloqué lors d'une visite précédente (n'importe quelle page) */
  try {
    if (localStorage.getItem(CLE_STOCKAGE) === 'oui') {
      debloquer(true);
    }
  } catch (e) { /* localStorage indisponible (navigation privée...) : pas grave, le formulaire réapparaît */ }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var champEmail = document.getElementById('cadenas-email');
    var champConsentement = document.getElementById('cadenas-consentement');
    var erreurEmail = document.getElementById('cadenas-erreur-email');
    var erreurConsentement = document.getElementById('cadenas-erreur-consentement');
    var email = champEmail.value.trim();
    var emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    erreurEmail.hidden = true;
    erreurConsentement.hidden = true;

    if (!emailValide) {
      erreurEmail.textContent = 'Merci de renseigner une adresse email valide.';
      erreurEmail.hidden = false;
      champEmail.focus();
      return;
    }
    if (!champConsentement.checked) {
      erreurConsentement.textContent = 'Merci de cocher la case pour continuer.';
      erreurConsentement.hidden = false;
      champConsentement.focus();
      return;
    }

    envoyerVersGoogleForm(email);

    try { localStorage.setItem(CLE_STOCKAGE, 'oui'); } catch (e) {}

    debloquer(false);
  });

  /* Envoi silencieux vers le Google Form configuré ci-dessus. Tant qu'il
     n'est pas rempli, cette fonction ne fait rien — le contenu se
     débloque quand même, mais rien n'est envoyé. */
  function envoyerVersGoogleForm(email) {
    if (!CADENAS_CONFIG.formAction || !CADENAS_CONFIG.champEmail) return;

    var nomIframe = 'cadenas-cible';
    var iframe = document.querySelector('iframe[name="' + nomIframe + '"]');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.name = nomIframe;
      iframe.style.display = 'none';
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);
    }

    var f = document.createElement('form');
    f.action = CADENAS_CONFIG.formAction;
    f.method = 'POST';
    f.target = nomIframe;
    f.style.display = 'none';

    var champ1 = document.createElement('input');
    champ1.type = 'hidden';
    champ1.name = CADENAS_CONFIG.champEmail;
    champ1.value = email;
    f.appendChild(champ1);

    if (CADENAS_CONFIG.champConsentement) {
      var champ2 = document.createElement('input');
      champ2.type = 'hidden';
      champ2.name = CADENAS_CONFIG.champConsentement;
      champ2.value = "Oui, j'autorise Nova-Organise à m'envoyer ce contenu et des actualités sur le projet.";
      f.appendChild(champ2);
    }

    document.body.appendChild(f);
    f.submit();
    document.body.removeChild(f);
  }
})();
