import prisma from './prisma.js';

export const assignedMeetingUnits = async (userId: string) => {
  const assignments = await prisma.orgUnitAssignment.findMany({
    where: { userId, instance: { isVisible: true, definition: { isActive: true } } },
    select: { instanceId: true },
  });
  return [...new Set(assignments.map((a) => a.instanceId))];
};

export const canManageUnitMeeting = async (userId: string, meeting: { scopeType: string; scopeId: string; orgUnitInstanceId?: string | null }) => {
  if (meeting.scopeType !== 'ORG_UNIT' || !meeting.orgUnitInstanceId || meeting.scopeId !== meeting.orgUnitInstanceId) return false;
  return (await assignedMeetingUnits(userId)).includes(meeting.orgUnitInstanceId);
};

export const readableMeetingUnits = async (userId: string, role: string) => {
  if (role === 'ORG_UNIT_RESP') return assignedMeetingUnits(userId);
  if (role === 'OWNER') return null; // all institutions
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { localiteId: true, sectionId: true, sousLocaliteId: true,
      section: { select: { sousLocalite: { select: { localiteId: true } } } },
      sousLocalite: { select: { localiteId: true } } },
  });
  if (!actor) return [];
  let scope: any;
  if (role === 'LOCALITE' || role === 'COMITE_PEDAGOGIQUE') {
    const localiteId = actor.localiteId ?? actor.sousLocalite?.localiteId ?? actor.section?.sousLocalite?.localiteId;
    if (!localiteId) return [];
    const sections = await prisma.section.findMany({ where: { sousLocalite: { localiteId } }, select: { id: true } });
    scope = { OR: [{ scopeType: 'LOCALITE', scopeId: localiteId }, { scopeType: 'SECTION', scopeId: { in: sections.map((s) => s.id) } }] };
  } else if (role === 'SECTION_USER' && actor.sectionId) {
    scope = { scopeType: 'SECTION', scopeId: actor.sectionId };
  } else if (role === 'SOUS_LOCALITE_ADMIN' && actor.sousLocaliteId) {
    const sections = await prisma.section.findMany({ where: { sousLocaliteId: actor.sousLocaliteId }, select: { id: true } });
    scope = { scopeType: 'SECTION', scopeId: { in: sections.map((s) => s.id) } };
  } else return [];
  const instances = await prisma.orgUnitInstance.findMany({ where: scope, select: { id: true } });
  return instances.map((i) => i.id);
};
