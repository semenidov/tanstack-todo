import { getChecklistServer } from '#/server/checklists';
import { queryOptions } from '@tanstack/react-query';

// The checklist of a card (#120), null - none. Its own cache: items are not
// loaded with the board, the card window prefetches them in its loader.
export const checklistQueryOptions = (cardId: string) =>
    queryOptions({
        queryKey: ['checklist', cardId] as const,
        queryFn: () => getChecklistServer({ data: cardId }),
    });
