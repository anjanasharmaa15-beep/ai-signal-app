import { useState } from 'react';
import { NavLink } from 'react-router-dom';

export default function Navbar({ role, industry, onChangeSelection }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="navShell">
      <div className="navInner">
        <div className="navLeft">
          <NavLink to="/" className="logo" onClick={closeMenu}>
            AI Signal
          </NavLink>
          <nav className="navLinks" aria-label="Primary">
            <NavLink
              to="/"
              className={({ isActive }) => (isActive ? 'navLink active' : 'navLink')}
              end
            >
              Browse
            </NavLink>
            <NavLink
              to="/foundations"
              className={({ isActive }) => (isActive ? 'navLink active' : 'navLink')}
            >
              Foundations
            </NavLink>
            <NavLink
              to="/search"
              className={({ isActive }) => (isActive ? 'navLink active' : 'navLink')}
            >
              Digest
            </NavLink>
          </nav>
        </div>

        <button
          type="button"
          className={`pill navPillDesktop${!role ? ' pillEmpty' : ''}`}
          onClick={onChangeSelection}
          title="Change role & industry"
        >
          <span className="pillPrimary">{role || 'Set up feed'}</span>
          <span className="pillDivider" aria-hidden="true">·</span>
          <span className="pillSecondary">{industry || '→'}</span>
        </button>

        {/* Hamburger button — mobile only */}
        <button
          type="button"
          className={`hamburger${menuOpen ? ' open' : ''}`}
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* Mobile overlay */}
      {menuOpen && (
        <div className="mobileMenu">
          <NavLink to="/" className="mobileMenuLink" onClick={closeMenu} end>Browse</NavLink>
          <NavLink to="/foundations" className="mobileMenuLink" onClick={closeMenu}>Foundations</NavLink>
          <NavLink to="/search" className="mobileMenuLink" onClick={closeMenu}>Digest</NavLink>
          <div className="mobileMenuDivider" />
          <button
            type="button"
            className="mobileMenuPill"
            onClick={() => { closeMenu(); onChangeSelection(); }}
          >
            <span className="pillPrimary">{role || 'Pick role'}</span>
            <span className="pillDivider"> · </span>
            <span className="pillSecondary">{industry || 'Pick industry'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
