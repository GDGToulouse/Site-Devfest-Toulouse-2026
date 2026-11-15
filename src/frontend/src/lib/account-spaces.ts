// The spaces where an invited person holds an account outside the back-office:
// sponsors (#362) and event-day volunteers (#640). Same sign-in, same password
// reset, same invitation mechanics; only the words and the addresses differ.
export interface AccountSpace {
  name: string;
  signupTitle: string;
  // The backend route family that opens an invited account.
  invitationApi: "sponsor-invitation" | "arrivals-invitation";
  loginPath: string;
  resetPath: string;
  resetLead: string;
}

export const SPONSOR_SPACE: AccountSpace = {
  name: "Espace partenaire",
  signupTitle: "Créer votre compte partenaire",
  invitationApi: "sponsor-invitation",
  loginPath: "/sponsor/login",
  resetPath: "/sponsor/reset-password",
  resetLead: "Choisissez un nouveau mot de passe pour votre espace partenaire.",
};

export const ARRIVALS_SPACE: AccountSpace = {
  name: "Accueil des participants",
  signupTitle: "Créer votre compte de bénévole",
  invitationApi: "arrivals-invitation",
  loginPath: "/arrivees/connexion",
  resetPath: "/arrivees/reset-password",
  resetLead: "Choisissez un nouveau mot de passe pour votre compte de bénévole.",
};
