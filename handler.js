module.exports = {
  invoiceSave: require('./src/services/saveInvoice/invoice.save'),
  sqsTrigger: require('./src/services/sendConfirmation/sqs.trigger')
}
