const getInvoice = require('./getInvoice');
const sendEmail = require('./sendEmail');
const saveFile = require('./saveFile');

class Handler {
  constructor(){}

  handlerError(data) {
    const response = {
      statusCode: data.statusCode || 501,
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({error: "Couldn't receive message!"})
    };

    return response;
  }

  async main() {
    try {
      const invoice = await getInvoice();

      const invoiceAccessUrl = await saveFile(invoice);

      await sendEmail(invoiceAccessUrl);  
    } catch (error) {
      console.log('Erro *** ', error.stack);

      return this.handlerError({ statusCode: 500 });
    }
  }
}

const handler = new Handler();

module.exports = handler.main.bind(handler)