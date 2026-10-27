import type { Rencontre } from './types';

export const rencontreOrganiser = (rencontre: Rencontre) => {
  if (rencontre.orgUnitInstance) {
    const kind = rencontre.orgUnitInstance.definition.kind === 'CELLULE' ? 'Cellule' : 'Commission';
    return `${kind} : ${rencontre.orgUnitInstance.definition.name}`;
  }
  return rencontre.section?.name || (rencontre.scopeType === 'SOUS_LOCALITE' ? 'Sous-localité' : 'Localité');
};
