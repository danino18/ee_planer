import type { GeneralRequirementProgress } from '../../domain/generalRequirements/types';
import { RequirementCard } from './RequirementCard';

interface Props {
  data: GeneralRequirementProgress[];
}

export function GeneralRequirementsPanel({ data }: Props) {
  if (data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-base font-bold text-gray-900 mb-3">דרישות כלליות</h2>
      <div className="flex flex-col gap-3">
        {data.map((req) => (
          <RequirementCard key={req.requirementId} req={req} />
        ))}
      </div>
    </div>
  );
}
