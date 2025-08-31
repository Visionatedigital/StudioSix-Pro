const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

const PayPalService = {
  async loadSdk(clientId) {
    if (window.paypal) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=buttons,hosted-fields&intent=capture&currency=USD&enable-funding=card`;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  },

  async createOrder(amountUSD, tokens, userId, email) {
    const r = await fetch(`${API_BASE}/api/payments/paypal/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountUSD, tokens, userId, email })
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'create-order failed');
    return j.id;
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


