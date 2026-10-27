import { getLabelsServer } from '#/server/labels';
import { queryOptions } from '@tanstack/react-query';

// Not under ['boards']: cancelling or invalidating a board would hit labels.
export const labelsQueryOptions = (boardId: string) =>
    queryOptions({
        queryKey: ['labels', boardId] as const,
        queryFn: () => getLabelsServer({ data: boardId }),
    });
