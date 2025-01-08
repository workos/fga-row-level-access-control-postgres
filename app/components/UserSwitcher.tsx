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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const loadUsers = async () => {
      try {
        console.log('Loading users...');
        const response = await fetch('/api/users');
        const data = await response.json();
        console.log('Loaded users:', data);
        
        if (!mounted) return;
        
        if (Array.isArray(data) && data.length > 0) {
          setUsers(data);
          
          // Get saved user ID or default to admin
          const savedUserId = localStorage.getItem('currentUserId');
          console.log('Saved user ID:', savedUserId);
          
          // Try to find saved user, if not found or no saved ID, default to admin
          let initialUser = savedUserId 
            ? data.find((user: User) => user.id === savedUserId)
            : null;
            
          // If no saved user found, default to admin
          if (!initialUser) {
            initialUser = data.find((user: User) => user.email === 'admin@demo.com');
            if (initialUser) {
              localStorage.setItem('currentUserId', initialUser.id);
            }
          }
          
          console.log('Initial user:', initialUser);
          
          if (initialUser) {
            setCurrentUser(initialUser);
            // Dispatch event to notify other components
            window.dispatchEvent(new CustomEvent(USER_CHANGE_EVENT, { detail: initialUser.id }));
          }
        }
      } catch (error) {
        console.error('Failed to load users:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadUsers();
    return () => {
      mounted = false;
    };
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

  if (loading) {
    return <div className="flex items-center gap-4 p-4 bg-white border-b">Loading users...</div>;
  }

  if (!currentUser || users.length === 0) {
    return <div className="flex items-center gap-4 p-4 bg-white border-b">No users available</div>;
  }

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