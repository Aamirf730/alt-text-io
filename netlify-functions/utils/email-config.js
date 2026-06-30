function getEmailFrom() {
  return process.env.EMAIL_FROM || process.env.EMAIL_USER || 'help@wpgeared.com';
}

function getSupportEmail() {
  return process.env.SUPPORT_EMAIL || getEmailFrom();
}

module.exports = {
  getEmailFrom,
  getSupportEmail,
};
