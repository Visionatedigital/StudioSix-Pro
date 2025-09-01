const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const PayPalService = {
  async loadSdk(clientId) {
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
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=buttons,hosted-fields&intent=capture&currency=USD&enable-funding=card`;
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
  }
};

export default PayPalService;


