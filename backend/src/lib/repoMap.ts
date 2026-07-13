import { prisma } from './prisma';

export interface ClientRepoMapping {
  slackChannelId: string;
  defaultRepo: string;
}

// The repo and channel a task targets always come from this table, keyed by
// clientId. The client-facing form must never be able to pick a repo itself
// (that would let anyone point a Cursor agent at an arbitrary repository).
export async function getClientRepoMapping(clientId: string): Promise<ClientRepoMapping | null> {
  const mapping = await prisma.clientRepoMap.findUnique({ where: { clientId } });
  if (!mapping) return null;
  return { slackChannelId: mapping.slackChannelId, defaultRepo: mapping.defaultRepo };
}
