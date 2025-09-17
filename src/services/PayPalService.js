const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const PayPalService = {
  async loadSdk(clientId, options = {}) {
    if (!clientId) {
      try {
        const r = await fetch(`${API_BASE}/api/payments/paypal/client-id`);
        const j = await r.json();
        if (j.ok && j.clientId) clientId = j.clientId;
      } catch {}
    }
    if (!clientId) {
      throw new Error('Missing PayPal client ID');
    }
    if (window.paypal && window.paypal.Buttons) return;
    const intent = options.intent === 'subscription' ? 'subscription' : 'capture';
    const currency = options.currency || 'USD';
    const extra = intent === 'subscription' ? '&vault=true' : '&enable-funding=card';
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=buttons,hosted-fields&intent=${intent}&currency=${encodeURIComponent(currency)}${extra}`;
      s.onload = resolve;
      s.onerror = (e) => reject(new Error('PayPal SDK failed to load'));
      document.head.appendChild(s);
    });
    // Verify SDK objects are available
    if (!(window.paypal && window.paypal.Buttons)) {
      throw new Error('PayPal SDK loaded but Buttons API unavailable');
    }
  },

  async createOrder(amountUSD, tokens, userId, email) {
    const r = await fetch(`${API_BASE}/api/payments/paypal/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountUSD, tokens, userId, email })
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'create-order failed');
    const links = j.links || [];
    const approveLink = links.find(l => l && (l.rel === 'approve' || l.rel === 'payer-action'));
    return { id: j.id, approveUrl: approveLink && approveLink.href };
  },

  async captureOrder(orderId) {
    const r = await fetch(`${API_BASE}/api/payments/paypal/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'capture failed');
    return j.data;
  },

  async openSubscriptionModal(planId, clientId) {
    if (!planId) throw new Error('Missing PayPal plan ID');
    await this.loadSdk(clientId, { intent: 'subscription' });
    return new Promise((resolve, reject) => {
      try { const prev = document.getElementById('studiosix-subscription-overlay'); if (prev) prev.remove(); } catch {}
      const overlay = document.createElement('div');
      overlay.id = 'studiosix-subscription-overlay';
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.zIndex = '9999';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.background = 'rgba(2,6,23,0.75)';
      overlay.style.backdropFilter = 'blur(6px)';
      const panel = document.createElement('div');
      panel.style.background = '#ffffff';
      panel.style.border = '1px solid rgba(15,23,42,.12)';
      panel.style.borderRadius = '16px';
      panel.style.boxShadow = '0 20px 60px rgba(0,0,0,.5)';
      panel.style.padding = '20px';
      panel.style.width = 'min(520px, 92vw)';
      const title = document.createElement('div');
      title.style.color = '#0f172a';
      title.style.fontWeight = '600';
      title.style.marginBottom = '10px';
      title.innerText = 'Subscribe with PayPal (monthly)';
      const container = document.createElement('div');
      container.id = 'paypal-subscribe-container';
      panel.appendChild(title);
      panel.appendChild(container);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      const cleanup = () => { try { const el = document.getElementById('studiosix-subscription-overlay'); if (el) el.remove(); } catch {} };
      const buttons = window.paypal.Buttons({
        createSubscription: (_, actions) => actions.subscription.create({ plan_id: planId }),
        onApprove: (data) => { cleanup(); resolve({ subscriptionId: data.subscriptionID }); },
        onCancel: () => { cleanup(); reject(new Error('cancelled')); },
        onError: (err) => { cleanup(); reject(err); }
      });
      try { buttons.render('#paypal-subscribe-container'); } catch (e) { cleanup(); reject(e); }
    });
  }
};

export default PayPalService;


