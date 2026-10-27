import { getChecklistServer } from '#/server/checklists';
import { queryOptions } from '@tanstack/react-query';

export const checklistQueryOptions = (cardId: string) =>
    queryOptions({
        queryKey: ['checklist', cardId] as const,
        queryFn: () => getChecklistServer({ data: cardId }),
    });
