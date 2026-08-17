const DEFAULT_EMAIL_FROM = 'help@alt-text.pro';

function getEmailFrom() {
  return process.env.EMAIL_FROM || process.env.EMAIL_USER || DEFAULT_EMAIL_FROM;
}

function getSupportEmail() {
  return process.env.SUPPORT_EMAIL || getEmailFrom();
}

module.exports = {
  DEFAULT_EMAIL_FROM,
  getEmailFrom,
  getSupportEmail,
};
