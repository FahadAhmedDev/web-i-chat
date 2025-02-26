import React, { useEffect, useState } from 'react';
import { Users, Search, Download, Calendar, Phone, Mail, Link2, Unlink } from 'lucide-react';
import { format } from 'date-fns';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { initiateGHLAuth, isGHLConnected, syncContactToGHL, disconnectGHL } from '../lib/ghl';
import type { Database } from '../lib/database.types';

type Contact = Database['public']['Tables']['contacts']['Row'];

export default function Contacts() {
  const { webinars } = useStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedWebinar, setSelectedWebinar] = useState<string>('all');
  const [isGHLEnabled, setIsGHLEnabled] = useState(false);
  const [syncingContacts, setSyncingContacts] = useState<Set<string>>(new Set());
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchContacts();
    checkGHLStatus();
  }, []);

  const checkGHLStatus = async () => {
    const connected = await isGHLConnected();
    setIsGHLEnabled(connected);
  };

  const handleDisconnectGHL = async () => {
    setDisconnecting(true);
    try {
      const success = await disconnectGHL();
      if (success) {
        setIsGHLEnabled(false);
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (error) {
      setError('Failed to disconnect from GHL');
    } finally {
      setDisconnecting(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      setError('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncToGHL = async (contact: Contact) => {
    setSyncingContacts(prev => new Set([...prev, contact.id]));
    try {
      const success = await syncContactToGHL({
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
      });
      
      if (!success) {
        throw new Error('Failed to sync contact');
      }
    } catch (error) {
      console.error('Error syncing contact:', error);
      setError('Failed to sync contact to GHL');
    } finally {
      setSyncingContacts(prev => {
        const next = new Set(prev);
        next.delete(contact.id);
        return next;
      });
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.name.toLowerCase().includes(search.toLowerCase()) ||
      contact.email.toLowerCase().includes(search.toLowerCase()) ||
      (contact.phone && contact.phone.includes(search));
    
    const matchesWebinar = selectedWebinar === 'all' || contact.webinar_id === selectedWebinar;
    
    return matchesSearch && matchesWebinar;
  });

  const downloadCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Webinar', 'Joined At'];
    const rows = filteredContacts.map(contact => [
      contact.name,
      contact.email,
      contact.phone || '',
      webinars.find(w => w.id === contact.webinar_id)?.title || 'Unknown Webinar',
      format(new Date(contact.created_at), 'PPpp')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          </div>
          {isGHLEnabled ? (
            <button
              onClick={handleDisconnectGHL}
              disabled={disconnecting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              {disconnecting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              ) : (
                <Unlink className="w-4 h-4" />
              )}
              Disconnect GoHighLevel
            </button>
          ) : (
            <button
              onClick={initiateGHLAuth}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Link2 className="w-4 h-4" />
              Connect GoHighLevel
            </button>
          )}
        </div>
        <p className="text-gray-600 mt-1">
          Manage and track your webinar participants
        </p>
      </header>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="sm:w-64">
              <select
                value={selectedWebinar}
                onChange={(e) => setSelectedWebinar(e.target.value)}
                className="w-full border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
              >
                <option value="all">All Webinars</option>
                {webinars.map((webinar) => (
                  <option key={webinar.id} value={webinar.id}>
                    {webinar.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {error ? (
          <div className="p-6">
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">
              {error}
            </div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No contacts found</h3>
            <p className="text-gray-500">
              {search || selectedWebinar !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Contacts will appear here when people join your webinars'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact Info
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Webinar
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  {isGHLEnabled && (
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredContacts.map((contact) => {
                  const webinar = webinars.find(w => w.id === contact.webinar_id);
                  const isSyncing = syncingContacts.has(contact.id);
                  
                  return (
                    <tr key={contact.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="font-medium text-gray-900">{contact.name}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Mail className="w-4 h-4" />
                            <a href={`mailto:${contact.email}`} className="hover:text-blue-600">
                              {contact.email}
                            </a>
                          </div>
                          {contact.phone && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Phone className="w-4 h-4" />
                              <a href={`tel:${contact.phone}`} className="hover:text-blue-600">
                                {contact.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900">
                            {webinar?.title || 'Unknown Webinar'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-500">
                        {format(new Date(contact.created_at), 'PPp')}
                      </td>
                      {isGHLEnabled && (
                        <td className="py-4 px-6">
                          <button
                            onClick={() => handleSyncToGHL(contact)}
                            disabled={isSyncing}
                            className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors disabled:opacity-50"
                          >
                            {isSyncing ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-700 border-t-transparent"></div>
                            ) : (
                              <Link2 className="w-4 h-4" />
                            )}
                            Sync to GHL
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}