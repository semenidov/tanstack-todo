import { Badge } from '#/components/ui/badge';
import { Button } from '#/components/ui/button';
import { Link } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';

interface TodoHeaderProps {
    completedCount: number;
    totalCount: number;
}

export function TodoHeader({ completedCount, totalCount }: TodoHeaderProps) {
    return (
        <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Todo List
                </h1>
                {totalCount > 0 && (
                    <Badge variant="secondary" className="tabular-nums">
                        {completedCount} / {totalCount} done
                    </Badge>
                )}
            </div>
            <Button asChild size="sm">
                <Link to="/new">
                    <PlusIcon />
                    Add
                </Link>
            </Button>
        </header>
    );
}
