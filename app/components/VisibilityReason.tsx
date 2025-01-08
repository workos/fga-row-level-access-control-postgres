interface VisibilityReasonProps {
  role: string;
  isCreator: boolean;
  isAssignee: boolean;
}

export function VisibilityReason({ role, isCreator, isAssignee }: VisibilityReasonProps) {
  let reason = '';
  let color = '';

  if (role === 'ADMIN') {
    reason = 'Visible as Admin';
    color = 'bg-purple-50 text-purple-700 border-purple-200';
  } else if (role === 'AGENT') {
    reason = 'Visible as Agent';
    color = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (isCreator) {
    reason = 'You created this';
    color = 'bg-green-50 text-green-700 border-green-200';
  } else if (isAssignee) {
    reason = 'Assigned to you';
    color = 'bg-yellow-50 text-yellow-700 border-yellow-200';
  }

  if (!reason) return null;

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded border ${color}`}>
      {reason}
    </span>
  );
} 