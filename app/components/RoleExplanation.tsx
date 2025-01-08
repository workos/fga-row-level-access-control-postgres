interface RoleExplanationProps {
  role: string;
}

export function RoleExplanation({ role }: RoleExplanationProps) {
  const explanations = {
    ADMIN: {
      color: 'bg-purple-50 border-purple-200',
      text: 'As an admin, you can see all tickets in your organization.',
      permissions: ['View all tickets', 'Create tickets', 'Update any ticket', 'Delete tickets']
    },
    AGENT: {
      color: 'bg-blue-50 border-blue-200',
      text: 'As an agent, you can see all tickets in your organization and manage tickets assigned to you.',
      permissions: ['View all tickets', 'Create tickets', 'Update assigned tickets']
    },
    CUSTOMER: {
      color: 'bg-green-50 border-green-200',
      text: 'As a customer, you can see tickets you created and tickets assigned to you.',
      permissions: ['View created tickets', 'Create tickets', 'Update own tickets']
    }
  };

  const roleInfo = explanations[role as keyof typeof explanations];
  if (!roleInfo) return null;

  return (
    <div className={`rounded-lg border p-4 mb-6 ${roleInfo.color}`}>
      <h2 className="font-medium mb-2">Role: {role}</h2>
      <p className="text-sm mb-3">{roleInfo.text}</p>
      <div className="text-sm">
        <span className="font-medium">Permissions:</span>
        <ul className="list-disc list-inside mt-1">
          {roleInfo.permissions.map((permission) => (
            <li key={permission}>{permission}</li>
          ))}
        </ul>
      </div>
    </div>
  );
} 