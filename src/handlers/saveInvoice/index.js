const Joi = require('joi');
const decoratorValidator = require('../../util/decoratorValidator');
const globalEnum = require('../../util/globalEnum');
const persistItem = require('./persistItem');
const sendMessage = require('./sendMessage');

class Handler {
  constructor(){}

  static validator() {
    return Joi.object({
      fullName: Joi.string().max(100).min(2).required(),
      cpf: Joi.string().max(14).min(11).required(),
      email: Joi.string().email().required(),
      cardNumber: Joi.number().required(),
      securityCode: Joi.number().required(),
      validity: Joi.string().max(8).required(),
      items: Joi.array().items(
        Joi.object({
          name: Joi.string().max(100).min(2).required(),
          price: Joi.number().required(),
          amount: Joi.number().min(1).required(),
        })
      ).required()
    });
  }

  handlerSuccess(data) {
    const response = {
      statusCode: 200,
      body: JSON.stringify(data)
    }

    return response;
  }

  handlerError(data) {
    const response = {
      statusCode: data.statusCode || 500,
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({error: "Couldn't create item!"})
    }

    return response;
  }

  async main(event) {
    try {
      const data = event.body;

      const invoice = await persistItem(data);

      sendMessage(invoice.id);

      return this.handlerSuccess(invoice);
    } catch (error) {
      console.log('Erro *** ', error.stack);

      return this.handlerError({ statusCode: 500 });
    }
  }
}

const handler = new Handler();

module.exports = decoratorValidator(
  handler.main.bind(handler),
  Handler.validator(),
  globalEnum.ARG_TYPE.BODY
);