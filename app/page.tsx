'use client';

import { useState, useEffect } from 'react';
import { UserSwitcher, USER_CHANGE_EVENT } from './components/UserSwitcher';

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
}

export default function Home() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const userId = localStorage.getItem('currentUserId');
      if (!userId) return;

      const response = await fetch('/api/tickets', {
        headers: {
          'X-User-Id': userId
        }
      });
      const data = await response.json();
      setTickets(data.tickets);
    } catch (err) {
      setError('Failed to load tickets');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    
    // Listen for user changes
    const handleUserChange = () => {
      loadTickets();
    };
    
    window.addEventListener(USER_CHANGE_EVENT, handleUserChange);
    return () => window.removeEventListener(USER_CHANGE_EVENT, handleUserChange);
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      <UserSwitcher />
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Tickets</h1>
          
          {loading && (
            <p className="text-gray-500">Loading tickets...</p>
          )}

          {error && (
            <p className="text-red-500">{error}</p>
          )}

          {!loading && !error && tickets.length === 0 && (
            <p className="text-gray-500">No tickets found.</p>
          )}

          <div className="grid gap-6">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white shadow rounded-lg p-6"
              >
                <div className="flex justify-between items-start">
                  <h2 className="text-lg font-medium text-gray-900">{ticket.title}</h2>
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
