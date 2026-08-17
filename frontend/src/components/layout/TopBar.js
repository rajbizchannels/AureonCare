import React from 'react';
import { Bell, Bot, HelpCircle, LogOut, Menu, MessageSquare, Moon, Search, Settings, Sun } from 'lucide-react';

/**
 * The app-shell top bar. Spans all three panes and owns the global actions
 * (search, notifications, help, assistant, theme, profile, sign out).
 */
const TopBar = ({
  theme,
  user,
  notificationCount = 0,
  messageCount = 0,
  onLogoClick,
  onToggleMobileNav,
  onSearch,
  onMessages,
  onNotifications,
  onHelp,
  onAssistant,
  onSettings,
  onProfile,
  onLogout,
  onToggleTheme,
}) => {
  const dark = theme === 'dark';
  const isPatient = user?.role === 'patient';

  const iconButton = `p-2 rounded-lg transition-colors ${
    dark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-100' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
  }`;

  const initials = (() => {
    if (user?.avatar) return user.avatar;
    const first = user?.firstName || user?.first_name || '';
    const last = user?.lastName || user?.last_name || '';
    if (first && last) return (first.charAt(0) + last.charAt(0)).toUpperCase();
    if (first) return first.substring(0, 2).toUpperCase();
    return 'U';
  })();

  const fullName = `${user?.first_name || user?.firstName || ''} ${user?.last_name || user?.lastName || ''}`.trim() || 'User';

  return (
    <header
      className={`flex-shrink-0 h-16 flex items-center gap-3 px-3 sm:px-4 border-b ${
        dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'
      }`}
    >
      <button
        onClick={onToggleMobileNav}
        className={`${iconButton} lg:hidden`}
        title="Menu"
        aria-label="Toggle navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      <button onClick={onLogoClick} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <img
          src="/assets/aureoncare-logo-wide.png"
          alt="AureonCare"
          className="h-9 w-auto object-contain"
          style={{ aspectRatio: '3/1' }}
        />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-1 sm:gap-2">
        <button onClick={onSearch} className={iconButton} title="Search">
          <Search className="w-5 h-5" />
        </button>

        {/* Unlike the notification dot, this carries a number: an inbox is
            something you work through, so how many are waiting is the whole
            point. Past 9 it reads "9+" — the exact figure stops mattering and
            a wide pill would push the row around. */}
        {onMessages && (
          <button
            onClick={onMessages}
            className={`${iconButton} relative`}
            title={messageCount > 0 ? `Messages (${messageCount} unread)` : 'Messages'}
            aria-label={messageCount > 0 ? `Messages, ${messageCount} unread` : 'Messages'}
          >
            <MessageSquare className="w-5 h-5" />
            {messageCount > 0 && (
              <span className={`absolute -top-0.5 -right-0.5 min-w-[1.15rem] h-[1.15rem] px-1 flex items-center justify-center rounded-full text-[0.65rem] font-semibold leading-none text-white bg-gradient-to-r from-cyan-500 to-blue-500 ring-2 ${
                dark ? 'ring-slate-900' : 'ring-white'
              }`}>
                {messageCount > 9 ? '9+' : messageCount}
              </span>
            )}
          </button>
        )}

        <button onClick={onNotifications} className={`${iconButton} relative`} title="Notifications">
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>

        <button onClick={onHelp} className={iconButton} title="Help & Documentation">
          <HelpCircle className="w-5 h-5" />
        </button>

        <button onClick={onAssistant} className={iconButton} title="AI Assistant">
          <Bot className="w-5 h-5" />
        </button>

        {!isPatient && (
          <button onClick={onSettings} className={iconButton} title="Settings">
            <Settings className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={onToggleTheme}
          className={iconButton}
          title={`Switch to ${dark ? 'Light' : 'Dark'} Mode`}
        >
          {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className={`hidden sm:block w-px h-6 mx-1 ${dark ? 'bg-slate-800' : 'bg-gray-200'}`} />

        <button
          onClick={onProfile}
          className={`flex items-center gap-2.5 p-1.5 rounded-lg transition-colors ${
            isPatient ? 'cursor-default' : dark ? 'hover:bg-slate-800' : 'hover:bg-gray-100'
          }`}
          title={`${fullName} (${user?.role || 'user'})`}
        >
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
            {initials}
          </div>
          <div className="hidden md:block text-left">
            <p className={`text-sm font-medium leading-tight ${dark ? 'text-white' : 'text-gray-900'}`}>{fullName}</p>
            <p className={`text-xs capitalize leading-tight ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
              {user?.role || 'user'}
            </p>
          </div>
        </button>

        <button onClick={onLogout} className={iconButton} title="Logout">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default TopBar;
