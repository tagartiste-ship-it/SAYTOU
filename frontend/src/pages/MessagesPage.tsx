import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send, Inbox, CheckCheck, Mail, MailOpen } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

interface MessageRow {
  id: string;
  subject: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  sender: { id: string; name: string; email: string; role: string };
  recipient: { id: string; name: string; email: string; role: string };
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  role: string;
  sousLocalite?: { id: string; name: string } | null;
  section?: { id: string; name: string; sousLocalite?: { id: string; name: string } } | null;
}

export default function MessagesPage() {
  const { user } = useAuthStore();
  const isComitePedagogique = user?.role === 'COMITE_PEDAGOGIQUE';

  const [tab, setTab] = useState<'inbox' | 'compose' | 'sent'>('inbox');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<MessageRow | null>(null);

  // Compose state
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'SOUS_LOCALITE_ADMIN' | 'SECTION_USER'>('all');

  const fetchMessages = async (box: 'inbox' | 'sent') => {
    setIsLoading(true);
    try {
      const res = await api.get<{ messages: MessageRow[] }>('/messages', { params: { box } });
      setMessages(res.data.messages || []);
    } catch {
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecipients = async () => {
    try {
      const res = await api.get<{ recipients: Recipient[] }>('/messages/recipients');
      setRecipients(res.data.recipients || []);
    } catch {
      setRecipients([]);
    }
  };

  useEffect(() => {
    if (tab === 'inbox') fetchMessages('inbox');
    else if (tab === 'sent') fetchMessages('sent');
    else if (tab === 'compose' && isComitePedagogique) fetchRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const markAsRead = async (msg: MessageRow) => {
    if (msg.isRead) return;
    try {
      await api.put(`/messages/${msg.id}/read`);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: true, readAt: new Date().toISOString() } : m)));
      if (selectedMessage?.id === msg.id) {
        setSelectedMessage({ ...msg, isRead: true, readAt: new Date().toISOString() });
      }
    } catch {
      // silent
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/messages/read-all');
      setMessages((prev) => prev.map((m) => ({ ...m, isRead: true, readAt: new Date().toISOString() })));
      toast.success('Tous les messages marqués comme lus');
    } catch {
      toast.error('Erreur');
    }
  };

  const handleSend = async () => {
    if (!subject.trim()) { toast.error('Le sujet est requis'); return; }
    if (!body.trim()) { toast.error('Le contenu est requis'); return; }
    if (!selectedRecipientIds.length) { toast.error('Sélectionnez au moins un destinataire'); return; }

    setIsSending(true);
    try {
      const res = await api.post<{ message: string; count: number }>('/messages', {
        recipientIds: selectedRecipientIds,
        subject: subject.trim(),
        body: body.trim(),
      });
      toast.success(res.data.message || 'Message(s) envoyé(s)');
      setSubject('');
      setBody('');
      setSelectedRecipientIds([]);
      setTab('sent');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'envoi');
    } finally {
      setIsSending(false);
    }
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const filtered = filteredRecipients.map((r) => r.id);
    setSelectedRecipientIds((prev) => {
      const set = new Set(prev);
      filtered.forEach((id) => set.add(id));
      return Array.from(set);
    });
  };

  const deselectAllFiltered = () => {
    const filtered = new Set(filteredRecipients.map((r) => r.id));
    setSelectedRecipientIds((prev) => prev.filter((id) => !filtered.has(id)));
  };

  const filteredRecipients = recipientFilter === 'all'
    ? recipients
    : recipients.filter((r) => r.role === recipientFilter);

  const unreadCount = messages.filter((m) => !m.isRead).length;

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };

  const roleBadge = (role: string) => {
    if (role === 'SOUS_LOCALITE_ADMIN') return <Badge variant="secondary" className="text-xs">Sous-Loc.</Badge>;
    if (role === 'SECTION_USER') return <Badge variant="accent" className="text-xs">Section</Badge>;
    if (role === 'COMITE_PEDAGOGIQUE') return <Badge variant="default" className="text-xs">C. Péda.</Badge>;
    return <Badge variant="secondary" className="text-xs">{role}</Badge>;
  };

  if (isLoading && tab !== 'compose') {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Messages</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {isComitePedagogique ? 'Envoyez des messages aux sous-localités et sections' : 'Vos messages reçus'}
          </p>
        </div>
        {tab === 'inbox' && unreadCount > 0 && (
          <Badge variant="default" className="text-base px-4 py-2 bg-red-600">{unreadCount} non lu(s)</Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <Button
          variant={tab === 'inbox' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => { setTab('inbox'); setSelectedMessage(null); }}
        >
          <Inbox className="w-4 h-4 mr-2" />
          Boîte de réception
          {unreadCount > 0 && <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{unreadCount}</span>}
        </Button>
        {isComitePedagogique && (
          <>
            <Button
              variant={tab === 'compose' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => { setTab('compose'); setSelectedMessage(null); }}
            >
              <Send className="w-4 h-4 mr-2" />
              Nouveau message
            </Button>
            <Button
              variant={tab === 'sent' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => { setTab('sent'); setSelectedMessage(null); }}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Envoyés
            </Button>
          </>
        )}
        {tab === 'inbox' && unreadCount > 0 && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={markAllAsRead}>
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {/* Compose */}
      {tab === 'compose' && isComitePedagogique && (
        <Card className="p-0">
          <CardHeader>
            <CardTitle className="text-lg">Nouveau message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recipients filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Destinataires</label>
              <div className="flex gap-2 mb-2">
                <Button variant={recipientFilter === 'all' ? 'primary' : 'outline'} size="sm" onClick={() => setRecipientFilter('all')}>Tous</Button>
                <Button variant={recipientFilter === 'SOUS_LOCALITE_ADMIN' ? 'primary' : 'outline'} size="sm" onClick={() => setRecipientFilter('SOUS_LOCALITE_ADMIN')}>Sous-Localités</Button>
                <Button variant={recipientFilter === 'SECTION_USER' ? 'primary' : 'outline'} size="sm" onClick={() => setRecipientFilter('SECTION_USER')}>Sections</Button>
                <div className="ml-auto flex gap-1">
                  <Button variant="outline" size="sm" onClick={selectAllFiltered}>Tout sélect.</Button>
                  <Button variant="outline" size="sm" onClick={deselectAllFiltered}>Tout désélect.</Button>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
                {filteredRecipients.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Aucun destinataire disponible</p>
                ) : (
                  filteredRecipients.map((r) => (
                    <label key={r.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selectedRecipientIds.includes(r.id) ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-700' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selectedRecipientIds.includes(r.id)}
                        onChange={() => toggleRecipient(r.id)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.name}</span>
                      {roleBadge(r.role)}
                      {r.sousLocalite && <span className="text-xs text-gray-500">{r.sousLocalite.name}</span>}
                      {r.section && <span className="text-xs text-gray-500">{r.section.name} ({r.section.sousLocalite?.name})</span>}
                    </label>
                  ))
                )}
              </div>
              {selectedRecipientIds.length > 0 && (
                <p className="text-xs text-primary-600 mt-1">{selectedRecipientIds.length} destinataire(s) sélectionné(s)</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sujet</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet du message" className="mt-1" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Écrivez votre message..."
                rows={6}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSend} disabled={isSending}>
                <Send className="w-4 h-4 mr-2" />
                {isSending ? 'Envoi...' : 'Envoyer'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inbox / Sent list */}
      {(tab === 'inbox' || tab === 'sent') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Message list */}
          <div className="lg:col-span-1 space-y-2">
            {messages.length === 0 ? (
              <Card className="p-10 text-center">
                <MessageSquare className="w-14 h-14 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">
                  {tab === 'inbox' ? 'Aucun message reçu.' : 'Aucun message envoyé.'}
                </p>
              </Card>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => { setSelectedMessage(msg); if (tab === 'inbox') markAsRead(msg); }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedMessage?.id === msg.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : msg.isRead || tab === 'sent'
                        ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300'
                        : 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {tab === 'inbox' && !msg.isRead ? (
                      <Mail className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    ) : (
                      <MailOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span className={`text-sm font-semibold truncate ${!msg.isRead && tab === 'inbox' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                      {msg.subject}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{tab === 'inbox' ? `De: ${msg.sender.name}` : `À: ${msg.recipient.name}`}</span>
                    {roleBadge(tab === 'inbox' ? msg.sender.role : msg.recipient.role)}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(msg.createdAt)}</p>
                </div>
              ))
            )}
          </div>

          {/* Message detail */}
          <div className="lg:col-span-2">
            {selectedMessage ? (
              <Card className="p-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{selectedMessage.subject}</CardTitle>
                    {selectedMessage.isRead && <Badge variant="secondary" className="text-xs">Lu</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <span>De: <strong>{selectedMessage.sender.name}</strong></span>
                    {roleBadge(selectedMessage.sender.role)}
                    <span className="text-gray-400">→</span>
                    <span>À: <strong>{selectedMessage.recipient.name}</strong></span>
                    {roleBadge(selectedMessage.recipient.role)}
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(selectedMessage.createdAt)}</p>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{selectedMessage.body}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="p-10 text-center">
                <MessageSquare className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Sélectionnez un message pour le lire</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
