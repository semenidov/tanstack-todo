import { getLabelsServer } from '#/server/labels';
import { queryOptions } from '@tanstack/react-query';

// Labels of a board (#120): a cache of their own, apart from the board's, so a
// label edit doesn't touch the board and board refetches don't touch labels.
// Not under ['boards', ...]: cancelling or invalidating a board would hit it.
export const labelsQueryOptions = (boardId: string) =>
    queryOptions({
        queryKey: ['labels', boardId] as const,
        queryFn: () => getLabelsServer({ data: boardId }),
    });
