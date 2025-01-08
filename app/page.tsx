'use client';

import { useState, useEffect } from 'react';
import { UserSwitcher, USER_CHANGE_EVENT } from './components/UserSwitcher';
import { RoleExplanation } from './components/RoleExplanation';
import { VisibilityReason } from './components/VisibilityReason';

interface User {
  id: string;
  email: string;
  name: string;
  orgId: string;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: {
    id: string;
    name: string;
    email: string;
  } | null;
  creatorId: string;
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load current user
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const userId = localStorage.getItem('currentUserId');
        if (!userId) {
          setLoading(false);
          return;
        }

        const response = await fetch('/api/users');
        const users = await response.json();
        const user = users.find((u: User) => u.id === userId);
        if (user) {
          setCurrentUser(user);
          const role = user.email.includes('admin') ? 'admin' :
                      user.email.includes('agent') ? 'agent' : 'creator';
          loadTickets(user.id, role);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        setError('Failed to load user');
        setLoading(false);
      }
    };
    loadCurrentUser();
  }, []);

  const loadTickets = async (userId: string, role: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/tickets?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load tickets');
      }
      
      const data = await response.json();
      setTickets(data || []);
    } catch (err) {
      console.error('Error loading tickets:', err);
      setError('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Listen for user changes
    const handleUserChange = async (event: Event) => {
      const { userId, role } = (event as CustomEvent).detail;
      if (!userId || !role) return;

      try {
        const response = await fetch('/api/users');
        const users = await response.json();
        const user = users.find((u: User) => u.id === userId);
        if (user) {
          setCurrentUser(user);
          loadTickets(user.id, role);
        }
      } catch (error) {
        console.error('Error handling user change:', error);
        setError('Failed to update user');
      }
    };
    
    window.addEventListener(USER_CHANGE_EVENT, handleUserChange);
    return () => window.removeEventListener(USER_CHANGE_EVENT, handleUserChange);
  }, []);

  const role = currentUser?.email.includes('admin')
    ? 'ADMIN'
    : currentUser?.email.includes('agent')
    ? 'AGENT'
    : 'CUSTOMER';

  return (
    <main className="min-h-screen bg-gray-50">
      <UserSwitcher />
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {role && <RoleExplanation role={role} />}
          
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Tickets</h1>
            <div className="text-sm text-gray-500">
              Showing {tickets?.length || 0} ticket{(tickets?.length || 0) !== 1 ? 's' : ''}
            </div>
          </div>
          
          {loading && (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading tickets...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-500">{error}</p>
            </div>
          )}

          {!loading && !error && tickets.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No tickets found.</p>
            </div>
          )}

          <div className="grid gap-6">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white shadow rounded-lg p-6"
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">{ticket.title}</h2>
                    {currentUser && (
                      <div className="mt-1">
                        <VisibilityReason
                          role={role || ''}
                          isCreator={ticket.creatorId === currentUser.id}
                          isAssignee={ticket.assignee?.id === currentUser.id}
                        />
                      </div>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    ticket.status === 'OPEN' ? 'bg-green-100 text-green-800' :
                    ticket.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {ticket.status}
                  </span>
                </div>
                <p className="mt-2 text-gray-600">{ticket.description}</p>
                <div className="mt-4 flex justify-between items-center text-sm text-gray-500">
                  <div>
                    Priority: <span className="font-medium">{ticket.priority}</span>
                  </div>
                  {ticket.assignee && (
                    <div>
                      Assigned to: <span className="font-medium">{ticket.assignee.name}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
