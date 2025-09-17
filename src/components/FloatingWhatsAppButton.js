import React from 'react';

const FloatingWhatsAppButton = ({ phone, message, className = '', href }) => {
  const configuredPhone = phone || process.env.REACT_APP_WHATSAPP_PHONE || '';
  const defaultMessage = message || process.env.REACT_APP_WHATSAPP_TEXT || 'Hi! I need help with StudioSix Pro.';
  const envGroup = process.env.REACT_APP_WHATSAPP_GROUP_URL || '';
  const finalHref = href || envGroup || (configuredPhone
    ? `https://wa.me/${configuredPhone}?text=${encodeURIComponent(defaultMessage)}`
    : null);

  const iconSrc = encodeURI('/Social-icons/—Pngtree—whatsapp phone icon_8704826.png');

  const handleClick = (e) => {
    if (!finalHref) {
      e.preventDefault();
      alert('WhatsApp link not configured yet. Set REACT_APP_WHATSAPP_GROUP_URL or REACT_APP_WHATSAPP_PHONE.');
    }
  };

  return (
    <a
      href={finalHref || '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      aria-label="Chat on WhatsApp"
      className={`fixed bottom-6 right-8 z-[60] group ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-white shadow-xl ring-1 ring-emerald-500/40 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
        <img src={iconSrc} alt="WhatsApp" className="w-9 h-9" />
      </div>
      <div className="absolute -top-9 right-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <span className="px-2.5 py-1 text-xs rounded bg-emerald-600 text-white shadow whitespace-nowrap">
          WhatsApp us
        </span>
      </div>
    </a>
  );
};

export default FloatingWhatsAppButton;


