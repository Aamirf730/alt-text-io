const DEFAULT_EMAIL_FROM = 'help@alt-text.pro';

function getEmailFrom() {
  return process.env.EMAIL_FROM || process.env.EMAIL_USER || DEFAULT_EMAIL_FROM;
}

// Sender for emails customers read: shows "Alt Text Pro" instead of the bare
// address. Left as is when EMAIL_FROM already carries a display name.
function getCustomerEmailFrom() {
  const from = getEmailFrom();
  return from.includes('<') ? from : `"Alt Text Pro" <${from}>`;
}

function getSupportEmail() {
  return process.env.SUPPORT_EMAIL || getEmailFrom();
}

module.exports = {
  DEFAULT_EMAIL_FROM,
  getEmailFrom,
  getCustomerEmailFrom,
  getSupportEmail,
};
