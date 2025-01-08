import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  orgId: string;
}

// Custom event for user changes
export const USER_CHANGE_EVENT = 'user-changed';

export function UserSwitcher() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    // Load test users
    const loadUsers = async () => {
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(data);
      // Default to admin user if no user is selected
      const savedUserId = localStorage.getItem('currentUserId');
      const initialUser = savedUserId 
        ? data.find((user: User) => user.id === savedUserId)
        : data.find((user: User) => user.email === 'admin@demo.com');
      if (initialUser) {
        setCurrentUser(initialUser);
        localStorage.setItem('currentUserId', initialUser.id);
      }
    };
    loadUsers();
  }, []);

  const handleUserChange = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('currentUserId', userId);
      // Dispatch custom event for user change
      window.dispatchEvent(new CustomEvent(USER_CHANGE_EVENT, { detail: userId }));
    }
  };

  if (!currentUser) return null;

  return (
    <div className="flex items-center gap-4 p-4 bg-white border-b">
      <div className="flex-1">
        <span className="text-sm text-gray-500">Logged in as:</span>
        <select
          value={currentUser.id}
          onChange={(e) => handleUserChange(e.target.value)}
          className="ml-2 p-1 text-sm border rounded"
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.email})
            </option>
          ))}
        </select>
      </div>
      <div className="text-sm text-gray-500">
        Role: <span className="font-medium">{currentUser.email.split('@')[0].toUpperCase()}</span>
      </div>
    </div>
  );
} 