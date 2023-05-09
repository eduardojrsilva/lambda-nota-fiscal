function getCurrency(currency) {
  return `R$${currency.toFixed(2).replace('.', ',')}`;
}

module.exports = getCurrency;