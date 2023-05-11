const statusConfig = {
  1: 'APPROVED',
  2: 'PENDING',
  3: 'DENIED',
}

function processPayment() {
  const status = Math.floor(Math.random() * 3) + 1;

  return statusConfig[status];
}

module.exports = processPayment;