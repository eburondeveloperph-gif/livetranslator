/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useUI } from '@/lib/state';
import cn from 'classnames';

export default function Header() {
  const { toggleSidebar, theme, toggleTheme, activeTab, setActiveTab } = useUI();

  // Dynamic palette that leverages the CSS variables defined for the active theme.
  const palette = [
    'var(--accent-blue)',  // Left Section Accent
    'var(--accent-green)', // Right Section Accent
    'var(--accent-red)'    // (Available for future expansion)
  ];

  const leftAccent = palette[0];
  const rightAccent = palette[1];

  return (
    <header>
      <div className="header-left">
        <h1 className="header-logo-text">
          Orbits
          <span 
            className="accent-dot" 
            style={{ 
              color: leftAccent,
              WebkitTextFillColor: leftAccent 
            }}
          >
            .
          </span>
        </h1>
        <nav className="header-tabs" style={{marginLeft: '2rem', display: 'flex', gap: '1rem'}}>
          <button 
            className={cn('tab-button', { active: activeTab === 'translator' })}
            onClick={() => setActiveTab('translator')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '99px',
              backgroundColor: activeTab === 'translator' ? 'var(--bg-panel-secondary)' : 'transparent',
              color: activeTab === 'translator' ? 'var(--text-main)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'translator' ? 700 : 400,
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
          >
            Translator
          </button>
          <button 
            className={cn('tab-button', { active: activeTab === 'broadcaster' })}
            onClick={() => setActiveTab('broadcaster')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '99px',
              backgroundColor: activeTab === 'broadcaster' ? 'var(--bg-panel-secondary)' : 'transparent',
              color: activeTab === 'broadcaster' ? 'var(--text-main)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'broadcaster' ? 700 : 400,
              fontSize: '0.9rem',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span className="material-symbols-outlined" style={{fontSize: '16px', color: 'var(--accent-red)'}}>sensors</span>
            Broadcaster
          </button>
        </nav>
      </div>
      <div className="header-right">
        <button 
          className="theme-button" 
          onClick={toggleTheme}
          aria-label="Toggle Theme"
        >
          <span 
            className="icon header-icon" 
            style={{ color: theme === 'dark' ? '#FDB813' : 'var(--Blue-800)' }}
          >
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
        <button
          className="settings-button"
          onClick={toggleSidebar}
          aria-label="Settings"
        >
          <span 
            className="icon header-icon settings-icon"
            style={{ color: rightAccent }}
          >
            settings
          </span>
        </button>
      </div>
    </header>
  );
}