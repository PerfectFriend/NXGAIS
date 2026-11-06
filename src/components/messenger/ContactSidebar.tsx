import React from 'react';
import { 
  Menu, Search, Star, QrCode, HardDrive, 
  ShieldCheck, ShieldAlert 
} from 'lucide-react';

export interface ContactItem {
  id: string;
  name: string;
  isVault?: boolean;
  onionAddress: string;
  avatarColor: string;
  status: 'online' | 'relay_connected' | 'encrypted_vault';
  lastSeen: string;
  unreadCount?: number;
}

export interface ContactSidebarProps {
  className?: string;
  contacts: ContactItem[];
  selectedId: string;
  searchQuery: string;
  totalUsedGb: number;
  personalVaultQuotaGb: number;
  onSelectContact: (id: string) => void;
  onSearchChange: (query: string) => void;
  onOpenDrawer: () => void;
  onOpenContactModal: () => void;
}

/**
 * ContactSidebar displays the left-hand navigation pane containing sovereign contacts,
 * search filters, and the encrypted personal vault quick-access badge.
 *
 * @param {ContactSidebarProps} props - Component properties and callbacks.
 * @returns {React.ReactElement} The rendered contact sidebar.
 */
export const ContactSidebar: React.FC<ContactSidebarProps> = ({
  className = '',
  contacts,
  selectedId,
  searchQuery,
  totalUsedGb,
  personalVaultQuotaGb,
  onSelectContact,
  onSearchChange,
  onOpenDrawer,
  onOpenContactModal,
}) => {
  return (
    <div className={`w-full md:w-80 lg:w-96 border-r border-slate-800 flex-col bg-slate-900/40 shrink-0 h-full ${className}`}>
      {/* Top Header & Search Bar */}
      <div className="p-3 sm:p-4 border-b border-slate-800 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenDrawer}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base font-bold font-mono text-white tracking-wide">
              Чаты & Хранилище
            </h1>
          </div>

          <button
            type="button"
            onClick={onOpenContactModal}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
            title="Контакты & QR-Визитка"
          >
            <QrCode className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Поиск по контактам и .onion..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      {/* Contacts & Favorites List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
        {/* Pinned "Избранное (Хранилище)" item */}
        <div
          onClick={() => onSelectContact('vault_favorites')}
          className={`p-3 sm:p-3.5 flex items-center justify-between cursor-pointer transition ${
            selectedId === 'vault_favorites'
              ? 'bg-slate-800/80 border-l-2 border-amber-400'
              : 'hover:bg-slate-800/40'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-bold shadow-md shrink-0">
              <Star className="w-5 h-5 fill-slate-950" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-white truncate">
                <span>⭐️ Избранное</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 border border-amber-500/30 text-amber-300">
                  Сейф
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 truncate flex items-center gap-1 mt-0.5">
                <HardDrive className="w-3 h-3 text-amber-400" />
                <span>
                  {totalUsedGb.toFixed(2)} GB / {personalVaultQuotaGb.toFixed(1)} GB
                </span>
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-950/50 border border-amber-500/20">
            RF=6×
          </span>
        </div>

        {/* Regular Peer Contacts */}
        {contacts
          .filter(c => c.id !== 'vault_favorites')
          .map(contact => {
            const isSelected = selectedId === contact.id;
            return (
              <div
                key={contact.id}
                onClick={() => onSelectContact(contact.id)}
                className={`p-3 sm:p-3.5 flex items-center justify-between cursor-pointer transition ${
                  isSelected
                    ? 'bg-slate-800/80 border-l-2 border-emerald-400'
                    : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${contact.avatarColor} flex items-center justify-center text-slate-950 font-bold font-mono text-xs shadow-md shrink-0`}
                  >
                    {contact.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-white truncate">
                      <span className="truncate">{contact.name}</span>
                      {contact.status === 'online' ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                      {contact.onionAddress}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 pl-2">
                  <div className="text-[10px] font-mono text-slate-500">
                    {contact.lastSeen}
                  </div>
                  {contact.unreadCount ? (
                    <span className="inline-block px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 font-mono text-[10px] font-bold mt-1">
                      {contact.unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
