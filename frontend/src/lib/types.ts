export type UserRole = 'LOCALITE' | 'SOUS_LOCALITE_ADMIN' | 'SECTION_USER';

export type ScopeType = 'LOCALITE' | 'SOUS_LOCALITE' | 'SECTION';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  sousLocaliteId?: string | null;
  sectionId?: string | null;
  sousLocalite?: SousLocalite | null;
  section?: Section | null;
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  mustChangePassword?: boolean;
  createdAt: string;
}

export interface Localite {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sousLocalites?: SousLocalite[];
}

export interface SousLocalite {
  id: string;
  name: string;
  localiteId: string;
  localite?: Localite;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  sections?: Section[];
  _count?: {
    sections: number;
    users: number;
  };
}

export interface Section {
  id: string;
  name: string;
  sousLocaliteId: string;
  sousLocalite?: SousLocalite;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    rencontres: number;
    users: number;
  };
}

export interface TrancheAge {
  id: string;
  name: string;
  ageMin: number;
  ageMax?: number | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface MembreParticipationRencontre {
  id: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  moderateur: string;
  moniteur: string;
  theme?: string | null;
  ordreDuJour?: OrdreDuJourItem[] | null;
}

export interface MembreParticipation extends Pick<Membre, 'id' | 'prenom' | 'nom' | 'genre' | 'fonction' | 'sectionId'> {
  count: number;
  rencontres: MembreParticipationRencontre[];
}

export interface MembresParticipationsResponse {
  typeId: string | null;
  sectionId: string;
  membres: MembreParticipation[];
}

export interface RencontreType {
  id: string;
  name: string;
  isReunion: boolean;
  trancheAgeId?: string | null;
  trancheAge?: TrancheAge | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrdreDuJourItem {
  ordre: number;
  titre: string;
  description?: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Membre {
  id: string;
  sectionId: string;
  section?: {
    id: string;
    name: string;
  };
  photo?: string;
  prenom: string;
  nom: string;
  genre?: 'HOMME' | 'FEMME';
  fonction?: string;
  corpsMetier?: string;
  groupeSanguin?: string;
  telephone?: string;
  numeroCNI?: string;
  adresse?: string | null;
  dateNaissance?: string | null;
  dateAdhesion?: string | null;
  numeroCarteElecteur?: string | null;
  lieuVote?: string | null;
  age?: number | null;
  isEligibleToVote?: boolean;
  ageTranche?: 'S1' | 'S2' | 'S3' | null;
  createdAt: string;
  updatedAt: string;
}

export interface Rencontre {
  id: string;
  typeId: string;
  type: RencontreType;
  sectionId: string;
  section: Section;
  scopeType: ScopeType;
  scopeId: string;
  lieuMembreId?: string | null;
  lieuMembre?: Membre | null;
  lieuTexte?: string | null;
  date: string;
  heureDebut: string;
  heureFin: string;
  moderateur: string;
  moniteur: string;
  theme?: string | null;
  ordreDuJour?: OrdreDuJourItem[] | null;
  developpement?: string | null;
  pvReunion?: string | null;
  membresPresents?: string[] | null;
  presenceHomme: number;
  presenceFemme: number;
  presenceTotale: number;
  observations?: string | null;
  attachments?: any;
  createdById: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  updatedById?: string | null;
  updatedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  totalRencontres: number;
  totalPresenceHomme: number;
  totalPresenceFemme: number;
  totalPresence: number;
  moyennePresenceHomme: number;
  moyennePresenceFemme: number;
  moyennePresence: number;
  parTrancheAge?: Array<{
    tranche: string;
    nombreRencontres: number;
    totalPresenceHomme: number;
    totalPresenceFemme: number;
    totalPresence: number;
  }>;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: User;
}
