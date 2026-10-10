/* Leegend Cars — données du site */
(function () {
  const CFG = {
    brand: "Leegend Cars",
    tagline: "Location de voitures de luxe dans tous les aéroports du Maroc",
    city: "Maroc",
    phonePrimary: "+212 6 28 39 49 47",
    phonePrimaryTel: "+212628394947",
    phoneSecondary: "+212 6 60 81 98 57",
    phoneSecondaryTel: "+212660819857",
    address: "Maroc — livraison dans tous les aéroports du pays",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Tanger%2C%20Maroc",
    hours: "7j/7 · 24h/24",
    year: new Date().getFullYear(),
  };

  const NAV = [
    { label: "Véhicules", href: "#/vehicules" },
    { label: "Aéroports", href: "#/aeroports" },
    { label: "Prix & promos", href: "#/prix-promos" },
    { label: "FAQ", href: "#/faq" },
    { label: "À propos", href: "#/a-propos" },
    { label: "Contact", href: "#/contact" },
  ];

  const FEATURES = [
    "Assurance incluse",
    "Assistance disponible 24h/24",
    "Climatisation",
    "Véhicules récents et entretenus",
    "Livraison gratuite aéroports / hôtels",
    "Kilométrage raisonnable",
  ];

  const EXCLUDED = ["Carburant", "Amendes et infractions"];

  const VEHICLE_FAQ = [
    {
      q: "Quels documents pour louer ce véhicule ?",
      a: "Permis de conduire valide (≥ 2 ans) et pièce d'identité (CIN ou passeport). Une caution vous sera demandée.",
    },
    {
      q: "Comment se passe la livraison à l'aéroport ?",
      a: "Vous nous envoyez votre numéro de vol et heure d'arrivée. Un agent vous accueille à la sortie du terminal de l'aéroport de votre vol, partout au Maroc, sans frais supplémentaires.",
    },
    {
      q: "Comment fonctionne le carburant ?",
      a: "La voiture est livrée avec un niveau de carburant convenu, et doit être restituée au même niveau. Le carburant n'est pas inclus dans le tarif.",
    },
  ];

  const VEHICLES = [
    {
      id: "mercedes-a-class",
      slug: "mercedes-a-class",
      name: "Mercedes A-Class",
      tagline: "Berline premium · Automatique",
      transmission: "Automatique",
      fuel: "Essence",
      doors: 5,
      seats: 5,
      priceFrom: 900,
      deposit: 7500,
      approx: 83,
      badge: "Premium",
      accent:
        "radial-gradient(ellipse at 50% 70%, rgba(122,18,10,0.32), transparent 65%)",
      gallery: [
        "cars/Mercedes/Mercedes_pic1.jpg",
        "cars/Mercedes/Mercedes_pic2.jpg",
        "cars/Mercedes/Mercedes_pic3.jpg",
        "cars/Mercedes/Mercedes_pic4.jpg",
        "cars/Mercedes/Mercedes_pic5.jpg",
      ],
      description: [
        "La Mercedes A-Class allie élégance et confort : un intérieur soigné, une boîte automatique fluide et une tenue de route remarquable, idéale pour rouler avec style à Tanger comme sur la route de la côte.",
        "Premium, silencieuse et agréable à conduire, elle convient aux séjours exigeants comme aux transferts aéroport jusqu'à votre hôtel.",
      ],
      idealFor: [
        "Arrivées VIP & transferts aéroport",
        "Couples et voyageurs exigeants",
        "Locations courtes et moyennes",
      ],
      tiers: [
        { label: "1 à 2 jours", days: 1, price: 900 },
        { label: "3 à 6 jours", days: 3, price: 850 },
        { label: "7 à 13 jours", days: 7, price: 800 },
        { label: "14 à 29 jours", days: 14, price: 750 },
        { label: "30 jours et plus", days: 30, price: 700 },
      ],
    },
    {
      id: "vw-t-roc-r-line",
      slug: "vw-t-roc-r-line",
      name: "Volkswagen T-Roc R-Line",
      tagline: "SUV compact · Pack R-Line",
      transmission: "Automatique",
      fuel: "Essence",
      doors: 5,
      seats: 5,
      priceFrom: 800,
      deposit: 5000,
      approx: 74,
      badge: "SUV",
      accent:
        "radial-gradient(ellipse at 50% 70%, rgba(167,17,7,0.28), transparent 65%)",
      gallery: [
        "cars/volkswagen/volkswagen_pic1.jpg",
        "cars/volkswagen/volkswagen_pic2.jpg",
        "cars/volkswagen/volkswagen_pic3.jpg",
        "cars/volkswagen/volkswagen_pic4.jpg",
        "cars/volkswagen/volkswagen_pic5.jpg",
        "cars/volkswagen/volkswagen_pic6.jpg",
      ],
      description: [
        "Le Volkswagen T-Roc Pack R-Line est un compact SUV au style affirmé : finitions R-Line, position de conduite haute et boîte automatique pour une conduite facile en ville comme sur l'autoroute.",
        "Confortable, polyvalent et sobre, il est parfait pour explorer le Nord du Maroc, de Tanger à Chefchaouen.",
      ],
      idealFor: [
        "Couples et petites familles",
        "Road trips le long de la côte",
        "Budget maîtrisé sans renoncer au style",
      ],
      tiers: [
        { label: "1 à 2 jours", days: 1, price: 800 },
        { label: "3 à 6 jours", days: 3, price: 760 },
        { label: "7 à 13 jours", days: 7, price: 720 },
        { label: "14 à 29 jours", days: 14, price: 680 },
        { label: "30 jours et plus", days: 30, price: 640 },
      ],
    },
    {
      id: "cupra-formentor",
      slug: "cupra-formentor",
      name: "Cupra Formentor",
      tagline: "SUV coupé sportif · Automatique",
      transmission: "Automatique",
      fuel: "Essence",
      doors: 5,
      seats: 5,
      priceFrom: 1000,
      deposit: 10000,
      approx: 92,
      badge: "Sport",
      accent:
        "radial-gradient(ellipse at 50% 70%, rgba(188,39,22,0.25), transparent 65%)",
      gallery: [
        "cars/cupra/cupra_pic1.jpg",
        "cars/cupra/cupra_pic2.jpg",
        "cars/cupra/cupra_pic3.jpg",
        "cars/cupra/cupra_pic4.jpg",
        "cars/cupra/cupra_pic5.jpg",
      ],
      description: [
        "La Cupra Formentor est notre SUV coupé le plus sportif : lignes affirmées, intérieur premium et conduite dynamique avec boîte automatique.",
        "Idéale pour ceux qui veulent du caractère et du confort sur la route, entre Tanger, Tétouan et les routes panoramiques du Rif.",
      ],
      idealFor: [
        "Passionnés de conduite",
        "Sorties, événements et weekends",
        "Locations courtes et moyennes",
      ],
      tiers: [
        { label: "1 à 2 jours", days: 1, price: 1000 },
        { label: "3 à 6 jours", days: 3, price: 950 },
        { label: "7 à 13 jours", days: 7, price: 900 },
        { label: "14 à 29 jours", days: 14, price: 850 },
        { label: "30 jours et plus", days: 30, price: 800 },
      ],
    },
  ];

  const TRUST = [
    {
      icon: "shield",
      title: "Assurance incluse",
      text: "Couverture comprise dans le tarif affiché. Caution expliquée à l'avance, libérée à la restitution.",
    },
    {
      icon: "truck",
      title: "Livraison gratuite",
      text: "Aéroports du Maroc. 24h/24, 7j/7. Restitution flexible.",
    },
    {
      icon: "tag",
      title: "Prix transparents",
      text: "Le prix annoncé par écrit est le prix final. Aucun frais surprise au moment de la prise en charge.",
    },
    {
      icon: "sparkles",
      title: "Voitures soignées",
      text: "Flotte premium récente, entretenue et nettoyée avant chaque location. Climatisation incluse.",
    },
  ];

  const PROCESS = [
    {
      num: "01",
      dur: "~ 2 min",
      title: "Vous faites la réservation",
      text: "Sur le site : dates, lieu de prise en charge, retour et véhicule souhaité. Aucun compte à créer.",
    },
    {
      num: "02",
      dur: "< 5 min",
      title: "On vous contacte par téléphone",
      text: "Nous vous appelons pour confirmer la disponibilité et le tarif final. Une avance vous est demandée pour valider la réservation.",
    },
    {
      num: "03",
      dur: "24h/24",
      title: "Voiture livrée",
      text: "Aéroport, hôtel ou centre-ville, à l'heure et à l'endroit convenus : on vous accueille avec votre voiture propre, prête à rouler, assurance déjà incluse.",
    },
  ];

  const DESTINATIONS = [
    {
      name: "Tanger",
      km: "TNG · 15 km",
      desc: "Cap Spartel, grottes d'Hercule et la marina.",
    },
    {
      name: "Chefchaouen",
      km: "TNG · 110 km",
      desc: "La ville bleue au cœur des montagnes du Rif.",
    },
    {
      name: "Tétouan",
      km: "TNG · 60 km",
      desc: "La perle du Nord et sa médina classée à l'UNESCO.",
    },
    {
      name: "Fès",
      km: "FEZ · 25 km",
      desc: "La capitale spirituelle et la plus grande médina du monde.",
    },
    {
      name: "Marrakech",
      km: "RAK · 15 km",
      desc: "Jemaa el-Fna, la palmeraie et la route des Atlas.",
    },
    {
      name: "Agadir",
      km: "AGA · 20 km",
      desc: "La plage, le climat doux et la région de Souss-Massa.",
    },
    {
      name: "Casablanca",
      km: "CMN · 25 km",
      desc: "La corniche, les affaires et les environs.",
    },
    {
      name: "Dakhla",
      km: "DKH · 15 km",
      desc: "Le désert, les dunes et la route du Grand Sud.",
    },
  ];

  const REVIEWS = [
    {
      name: "Karim B.",
      car: "Cupra Formentor",
      rating: 5,
      text: "Livraison à l'aéroport Ibn Battouta pile à l'heure, voiture impeccable. Prix annoncé respecté. Je recommande vivement.",
      grad: "linear-gradient(135deg, #d8392a, #7a120a)",
    },
    {
      name: "Sophie L.",
      car: "Mercedes A-Class",
      rating: 5,
      text: "Excellente expérience. Réponse en 5 minutes et caution claire dès le début. Service au top.",
      grad: "linear-gradient(135deg, #25d366, #1ebe5b)",
    },
    {
      name: "Mehdi A.",
      car: "Volkswagen T-Roc R-Line",
      rating: 5,
      text: "Loué pour une semaine entre Tanger et Chefchaouen. Voiture récente, propre, assurance bien expliquée. Rien à redire.",
      grad: "linear-gradient(135deg, #fbbf24, #b45309)",
    },
    {
      name: "Émilie R.",
      car: "Cupra Formentor",
      rating: 5,
      text: "Premier voyage au Maroc, je cherchais une agence sérieuse. Leegend Cars a tenu toutes ses promesses.",
      grad: "linear-gradient(135deg, #818cf8, #4338ca)",
    },
    {
      name: "Yassine M.",
      car: "Mercedes A-Class",
      rating: 4,
      text: "Bon contact, voiture propre. Petit retard à la livraison mais l'équipe a été très réactive.",
      grad: "linear-gradient(135deg, #f472b6, #831843)",
    },
    {
      name: "Claire D.",
      car: "Volkswagen T-Roc R-Line",
      rating: 5,
      text: "Tarif imbattable et confirmation écrite avant de payer. C'est ce qui m'a rassurée. Merci à toute l'équipe.",
      grad: "linear-gradient(135deg, #38bdf8, #0c4a6e)",
    },
  ];

  const GUIDE = [
    {
      span: true,
      title: "Pourquoi louer une voiture au Maroc ?",
      text: "Le Maroc se découvre en voiture : plages, médinas, routes de montagne etdéserts. Vous gagnez en liberté, vous économisez sur les trajets et vous.evitez les transports à chaque étape.",
    },
    {
      title: "Location voiture dans tous les aéroports du Maroc",
      text: "Nous livrons 7j/7 dans tous les aéroports : Tanger (TNG), Nador (NDR), Casablanca (CMN), Marrakech (RAK), Agadir (AGA), Fès (FEZ), Oujda (OUJ) et les autres. Vous recevez votre voiture dès la sortie du terminal, sans file d'attente ni surcoût caché.",
    },
    {
      title: "Tarifs transparents",
      text: "Le prix affiché est le prix final. Pas de frais surprise au moment de la prise en charge. Tout est confirmé par écrit.",
    },
    {
      title: "Où récupérer votre voiture ?",
      text: "Tous les aéroports du Maroc, les hôtels, les riads et les centres-villes. Vous choisissez le lieu et l'horaire.",
    },
    {
      title: "Sans caution exagérée",
      text: "La caution est expliquée clairement avant la signature, adaptée au véhicule premium et libérée rapidement à la restitution.",
    },
    {
      title: "Réservation rapide",
      text: "Envoyez vos dates et votre lieu, recevez un devis en quelques minutes, confirmez si cela vous convient. Simple.",
    },
    {
      span: true,
      title: "Que visiter depuis Tanger ?",
      text: "Cap Spartel, grottes d'Hercule, Chefchaouen, Tétouan, Akchour, Asilah, Ouazzane et les routes panoramiques du Rif. La région est riche.",
    },
  ];

  const HOME_FAQ = [
    {
      q: "Quels documents sont nécessaires pour louer ?",
      a: "Un permis de conduire valide (depuis au moins 2 ans) et une pièce d'identité (CIN ou passeport) du conducteur principal. Pour les paiements par carte, la carte du conducteur principal peut être demandée pour la caution.",
    },
    {
      q: "Y a-t-il une limite de kilométrage ?",
      a: "Le kilométrage est inclus selon les conditions de location, qui vous sont communiquées par écrit avant validation.",
    },
    {
      q: "Comment fonctionne le carburant ?",
      a: "La voiture est livrée avec un niveau de carburant convenu, et doit être restituée au même niveau. Le carburant n'est pas inclus dans le tarif.",
    },
    {
      q: "Comment se passe la livraison à l'aéroport ?",
      a: "Vous nous indiquez votre numéro de vol et l'heure d'arrivée. Un agent vous attend à la sortie du terminal avec votre voiture, dans n'importe quel aéroport du Maroc.",
    },
    {
      q: "Quels moyens de paiement acceptez-vous ?",
      a: "Paiement possible en MAD ou EUR, en espèces ou par carte. Aucun paiement en ligne : vous validez uniquement après confirmation écrite.",
    },
  ];

  const FAQ_CATS = [
    {
      title: "Conditions de location",
      items: [
        {
          q: "Quels documents sont nécessaires ?",
          a: "Permis de conduire valide, pièce d'identité (CIN ou passeport), et un justificatif de domicile de moins de 3 mois.",
        },
        {
          q: "Un conducteur additionnel, c'est possible ?",
          a: "Oui, sans frais. Le conducteur additionnel doit respecter les mêmes conditions (âge, permis ≥ 2 ans) et présenter ses documents à la signature.",
        },
      ],
    },
    {
      title: "Paiement",
      items: [
        {
          q: "Quels moyens de paiement acceptez-vous ?",
          a: "Paiement possible en MAD (Dirham) ou EUR (Euros). Espèces, carte bancaire ou virement. Aucun paiement en ligne : vous validez seulement après confirmation écrite.",
        },
        {
          q: "Les prix affichés sont-ils les prix finaux ?",
          a: "Oui. Le tarif affiché est le tarif final hors carburant. Tout vous est confirmé par écrit avant validation.",
        },
      ],
    },
    {
      title: "Assurance & sinistre",
      items: [
        {
          q: "L'assurance est-elle incluse dans le prix ?",
          a: "Oui, l'assurance de base (responsabilité civile) est incluse dans tous nos tarifs. Aucun supplément à payer sur place.",
        },
        {
          q: "Que faire en cas d'accident ou de panne ?",
          a: "Une assistance est disponible 24h/24, 7j/7 par téléphone. On vous guide étape par étape et on s'occupe de la suite.",
        },
      ],
    },
    {
      title: "Réservation, annulation & modification",
      items: [
        {
          q: "Comment réserver ?",
          a: "Envoyez-nous vos dates, le lieu de prise en charge et le véhicule souhaité. Nous vous renvoyons une confirmation écrite avec le prix final en moins de 5 minutes.",
        },
        {
          q: "Annulation : ai-je des frais ?",
          a: "Aucun frais. Vous pouvez annuler gratuitement jusqu'à 48h avant la prise en charge. Il suffit de nous prévenir par téléphone.",
        },
        {
          q: "Puis-je modifier ma réservation ?",
          a: "Oui, dates, lieu ou véhicule peuvent être modifiés sous réserve de disponibilité. Prévenez-nous au plus tôt.",
        },
      ],
    },
    {
      title: "Livraison & restitution",
      items: [
        {
          q: "La livraison à l'aéroport est-elle gratuite ?",
          a: "Oui, 100% gratuite dans tous les aéroports du Maroc, 24h/24. Vous nous indiquez votre numéro de vol et l'heure d'arrivée. Un agent vous attend à la sortie du terminal.",
        },
        {
          q: "Et la restitution à l'aéroport ?",
          a: "Également gratuite. Prévenez-nous 24h avant, on récupère la voiture à l'endroit convenu.",
        },
        {
          q: "Livraison à l'hôtel, au riad ou dans une autre ville ?",
          a: "Livraison gratuite dans tous les aéroports du Maroc ainsi qu'à l'hôtel, au riad ou au centre-ville, partout où nous vous livrons. Au-delà, une participation peut être proposée — toujours annoncée à l'avance.",
        },
      ],
    },
    {
      title: "Carburant & véhicule",
      items: [
        {
          q: "Comment fonctionne le carburant ?",
          a: "Politique plein pour plein : la voiture est livrée avec un niveau convenu, et doit être restituée au même niveau. Le carburant n'est pas inclus dans le tarif.",
        },
        {
          q: "Vos véhicules sont-ils récents ?",
          a: "Oui, notre flotte premium est récente et entretenue. Tous nos véhicules sont vérifiés et nettoyés avant chaque location.",
        },
        {
          q: "Y a-t-il une limite de kilométrage ?",
          a: "Le kilométrage est inclus selon des conditions raisonnables, communiquées par écrit avant validation. Pour les trajets très longs, prévenez-nous afin que nous adaptions le contrat.",
        },
      ],
    },
  ];

  const CONDITIONS = [
    {
      title: "Conducteur & documents",
      list: [
        "Âge minimum : 23 ans pour nos véhicules premium.",
        "Permis de conduire : valide depuis au moins 2 ans.",
        "Pièce d'identité : carte d'identité (CIN) ou passeport en cours de validité.",
        "Justificatif de domicile : facture récente (moins de 3 mois).",
      ],
      note: "Tous les documents sont vérifiés à la prise en charge. Le conducteur enregistré doit être présent.",
    },
    {
      title: "Caution",
      text: "Une caution est demandée à la prise en charge, dont le montant dépend du véhicule (entre 5 000 et 15 000 MAD environ). Elle est communiquée par écrit avant signature et intégralement restituée au retour si le véhicule est rendu dans l'état initial.",
      note: "Modes acceptés : espèces, empreinte de carte bancaire, ou virement.",
    },
    {
      title: "Paiement",
      list: [
        "Paiement accepté en MAD (Dirham) ou EUR (Euros).",
        "Espèces, carte bancaire, ou virement.",
        "Aucun paiement en ligne : tout est réglé à la prise en charge, après confirmation écrite et signature du contrat.",
      ],
    },
    {
      title: "Assurance",
      text: "L'assurance responsabilité civile (au tiers) est incluse dans tous nos tarifs. Une franchise peut s'appliquer en cas de sinistre responsable. Des options complémentaires (rachat de franchise, tous risques) peuvent être ajoutées sur demande.",
      note: "La couverture, la franchise et les exclusions précises vous sont communiquées par écrit avant validation, pour chaque véhicule.",
    },
    {
      title: "Kilométrage",
      text: "Kilométrage inclus selon les conditions du contrat, communiquées par écrit avant validation. Pour les très longues distances ou les traversées du Maroc, prévenez-nous afin que nous adaptions le kilométrage et l'assurance.",
    },
    {
      title: "Carburant",
      text: "Politique : plein pour plein. Le véhicule est livré avec un niveau de carburant convenu, et doit être restitué au même niveau. Tout manquant est facturé au prix coûtant du carburant + 100 MAD de service.",
    },
    {
      title: "Livraison & restitution",
      list: [
        "Gratuite dans tous les aéroports du Maroc, ainsi qu'à l'hôtel, au riad ou dans le centre-ville.",
        "Horaire libre, 24h/24, 7j/7.",
        "Restitution possible au même lieu ou ailleurs (à convenir avant).",
        "Tout dépassement d'horaire de plus de 1h sans accord préalable est facturé au tarif journalier.",
      ],
    },
    {
      title: "Annulation & modification",
      text: "Annulation gratuite jusqu'à 48h avant la prise en charge. L'annulation se fait simplement par téléphone. Toute modification (dates, lieu, véhicule) est possible sous réserve de disponibilité.",
    },
    {
      title: "Infractions & amendes",
      text: "Les contraventions, amendes et frais administratifs associés restent à la charge du conducteur, et lui sont refacturés sans majoration sur la base du procès-verbal officiel.",
    },
    {
      title: "Sortie du territoire marocain",
      text: "Toute sortie du Maroc (Espagne, Algérie, Mauritanie, etc.) est interdite sans accord écrit préalable.",
    },
    {
      title: "Conducteur additionnel",
      text: "Possible sans frais supplémentaire. Le conducteur additionnel doit respecter les mêmes conditions (âge, permis valide ≥ 2 ans) et présenter ses documents à la signature.",
    },
    {
      title: "Litiges",
      text: "Tout litige relève des tribunaux de Tanger, Maroc. Notre objectif reste de discuter et trouver une solution rapide par téléphone.",
    },
  ];

  const COUNTRY_CODES = [
    { label: "Maroc (+212)", code: "+212" },
    { label: "France (+33)", code: "+33" },
    { label: "Belgique (+32)", code: "+32" },
    { label: "Suisse (+41)", code: "+41" },
    { label: "Espagne (+34)", code: "+34" },
    { label: "Royaume-Uni (+44)", code: "+44" },
    { label: "Allemagne (+49)", code: "+49" },
    { label: "Italie (+39)", code: "+39" },
    { label: "Pays-Bas (+31)", code: "+31" },
    { label: "Canada (+1)", code: "+1" },
    { label: "États-Unis (+1)", code: "+1" },
    { label: "Autre", code: "" },
  ];

  const BABY_SEAT_DAILY = 99;

  const PICKUP_LOCATIONS = [
    "Aéroport Tanger Ibn Battouta (TNG)",
    "Aéroport Nador Al Massira (NDR)",
    "Aéroport Casablanca Mohammed V (CMN)",
    "Aéroport Marrakech Menara (RAK)",
    "Aéroport Agadir Al Massira (AGA)",
    "Aéroport Fès Saïss (FEZ)",
    "Aéroport Rabat Salé (RBA)",
    "Aéroport Oujda Angads (OUJ)",
    "Aéroport Essaouira (ESU)",
    "Aéroport Ouarzazate (OZZ)",
    "Aéroport Errachidia (ERZ)",
    "Aéroport Dakhla (DKH)",
    "Aéroport Laâyoune (LAY)",
    "Tanger",
    "Tétouan",
    "Chefchaouen",
    "Asilah",
    "Larache",
    "Al Hoceï",
    "Nador",
    "Kénitra",
    "Rabat",
    "Casablanca",
    "Oujda",
    "Autre lieu",
  ];

window.DATA = {
      CFG,
      NAV,
    FEATURES,
    EXCLUDED,
    VEHICLE_FAQ,
    VEHICLES,
    TRUST,
    PROCESS,
    DESTINATIONS,
    REVIEWS,
    GUIDE,
    HOME_FAQ,
    FAQ_CATS,
    CONDITIONS,
    COUNTRY_CODES,
    PICKUP_LOCATIONS,
    BABY_SEAT_DAILY,
  };
})();
