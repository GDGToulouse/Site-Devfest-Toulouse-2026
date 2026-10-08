// Draft questions of the FAQ (#111), written from what the site already knows
// for the team to review and publish. Nothing on refunds or what the ticket
// includes: the rule is written nowhere yet, and inventing it would be worse
// than a missing answer. Used by seed-dev; beta and production get them from
// the back-office.

type Theme = "VENUE" | "TICKETS" | "PROGRAMME" | "PRACTICAL" | "OTHER";

export const FAQ_DRAFTS: { theme: Theme; questionFr: string; questionEn: string; answerFr: string; answerEn: string }[] = [
  {
    theme: "VENUE",
    questionFr: "Où et quand a lieu le DevFest Toulouse 2026 ?",
    questionEn: "Where and when does DevFest Toulouse 2026 take place?",
    answerFr: "<p>Le jeudi 19 novembre 2026, au Centre de Congrès et d’Exposition Diagora, à Labège.</p>",
    answerEn: "<p>On Thursday 19 November 2026, at the Diagora congress and exhibition centre in Labège.</p>",
  },
  {
    theme: "VENUE",
    questionFr: "Comment venir sur place ?",
    questionEn: "How do I get there?",
    answerFr: "<p>Transports en commun, stationnement et itinéraire sont détaillés sur la page <a href=\"/fr/lieu\">Lieu &amp; infos pratiques</a>.</p>",
    answerEn: "<p>Public transport, parking and directions are on the <a href=\"/en/lieu\">venue page</a>.</p>",
  },
  {
    theme: "TICKETS",
    questionFr: "Où acheter mon billet ?",
    questionEn: "Where can I buy a ticket?",
    answerFr: "<p>Sur la page <a href=\"/fr/billetterie\">Billetterie</a>, qui mène à notre billetterie en ligne.</p>",
    answerEn: "<p>On the <a href=\"/en/billetterie\">tickets page</a>, which leads to our online ticket office.</p>",
  },
  {
    theme: "PROGRAMME",
    questionFr: "Quels formats de sessions sont proposés ?",
    questionEn: "What session formats are there?",
    answerFr: "<p>Des conférences de 45 minutes, des quickies de 15 minutes, des ateliers pratiques d’1 h 45 et des keynotes en ouverture et en clôture de la journée.</p>",
    answerEn: "<p>45-minute talks, 15-minute quickies, 1 h 45 hands-on workshops, and keynotes to open and close the day.</p>",
  },
  {
    theme: "PROGRAMME",
    questionFr: "Les conférences sont-elles en français ?",
    questionEn: "Are the talks in French?",
    answerFr: "<p>La plupart, oui. Certaines sont en anglais : la langue est indiquée sur chaque session du programme.</p>",
    answerEn: "<p>Most of them are. Some are in English: each session shows its language in the programme.</p>",
  },
  {
    theme: "PROGRAMME",
    questionFr: "Comment préparer ma journée ?",
    questionEn: "How can I plan my day?",
    answerFr: "<p>Sur le <a href=\"/fr/programme\">programme</a>, ajoutez les sessions qui vous intéressent à vos favoris, puis exportez-les dans votre agenda. Le jour J, le bouton « Prochain créneau » vous amène directement à la suite.</p>",
    answerEn: "<p>On the <a href=\"/en/programme\">schedule</a>, add the sessions you like to your favourites, then export them to your calendar. On the day, the “Next slot” button takes you straight to what comes next.</p>",
  },
  {
    theme: "PROGRAMME",
    questionFr: "Les conférences sont-elles filmées ?",
    questionEn: "Are the talks recorded?",
    answerFr: "<p>Les conférences des éditions précédentes sont à revoir sur la page <a href=\"/fr/replays\">Replays</a>.</p>",
    answerEn: "<p>The talks of previous editions can be watched on the <a href=\"/en/replays\">replays page</a>.</p>",
  },
  {
    theme: "PRACTICAL",
    questionFr: "Comment donner mon avis sur une session ?",
    questionEn: "How do I give feedback on a session?",
    answerFr: "<p>Le jour de l’événement et le lendemain, un formulaire d’avis apparaît sur la page de chaque conférence. Votre avis est anonyme ; vous pouvez aussi laisser un message que seuls le speaker et l’équipe liront.</p>",
    answerEn: "<p>On the day of the event and the day after, a feedback form appears on each talk’s page. It is anonymous; you can also leave a message that only the speaker and the team will read.</p>",
  },
  {
    theme: "PRACTICAL",
    questionFr: "Y a-t-il un code de conduite ?",
    questionEn: "Is there a code of conduct?",
    answerFr: "<p>Oui : chaque participant, speaker, sponsor et bénévole s’engage à respecter le <a href=\"/fr/code-de-conduite\">code de conduite</a>.</p>",
    answerEn: "<p>Yes: every attendee, speaker, sponsor and volunteer agrees to the <a href=\"/en/code-de-conduite\">code of conduct</a>.</p>",
  },
  {
    theme: "OTHER",
    questionFr: "Comment devenir sponsor ?",
    questionEn: "How can my company become a sponsor?",
    answerFr: "<p>Nos formules sont présentées sur la page <a href=\"/fr/devenir-sponsor\">Devenir sponsor</a>.</p>",
    answerEn: "<p>Our packages are on the <a href=\"/en/devenir-sponsor\">sponsorship page</a>.</p>",
  },
  {
    theme: "OTHER",
    questionFr: "Comment contacter l’équipe ?",
    questionEn: "How can I contact the team?",
    answerFr: "<p>Par le <a href=\"/fr/contact\">formulaire de contact</a>.</p>",
    answerEn: "<p>Through the <a href=\"/en/contact\">contact form</a>.</p>",
  },
];
