const Joi = require('joi');
const decoratorValidator = require('../../util/decoratorValidator');
const globalEnum = require('../../util/globalEnum');
const processPayment = require('../../util/payment');
const uuid = require('uuid');

class Handler {
  constructor({ dynamoDB, sqsQueue }){
    this.dynamoDB = dynamoDB;
    this.sqsQueue = sqsQueue;
  }

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

  formatItem(item) {
    return {
      id: item.id,
      fullName: item.fullName,
      email: item.email,
      cpf: item.cpf,
      items: item.items,
      total: item.total,
      status: item.status,
      createdAt: item.createdAt,
    };
  }
  
  getTotalPrice(items) {
    const total = items.reduce((acc, { price, amount }) => (
      acc + price * amount
    ), 0);
  
    return total;
  }
  
  async persistItem(data, status) {
    const params = {
      TableName: 'Invoice',
      Item: {
        id: uuid.v4(),
        ...data,
        total: this.getTotalPrice(data.items),
        status,
        createdAt: new Date().toISOString(),
      }
    }
    
    await this.dynamoDB.put(params).promise();
  
    const savedItem = this.formatItem(params.Item);
  
    return savedItem;
  }

  async sendMessage(id, status) {
    const params = {
      MessageBody: JSON.stringify({ id, status, attempt: 1 }),
      MessageDeduplicationId: uuid.v4(),
      MessageGroupId: `invoices-${status}`,
      QueueUrl: process.env.SQS_QUEUE_URL
    };
  
    await this.sqsQueue.sendMessage(params).promise();
  }

  handlePaymentError() {
    const response = {
      statusCode: 402, // Payment Required
      body: JSON.stringify({ error: "Payment denied!"})
    }

    return response;
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

      const paymentStatus = processPayment();

      if (paymentStatus === 'DENIED') return this.handlePaymentError();

      const invoice = await this.persistItem(data, paymentStatus);

      await this.sendMessage(invoice.id, paymentStatus);

      return this.handlerSuccess(invoice);
    } catch (error) {
      console.log('Erro *** ', error.stack);

      return this.handlerError({ statusCode: 500 });
    }
  }
}

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient({ params: { TableName: 'Invoice'}});
const sqsQueue = new AWS.SQS();

const handler = new Handler({ dynamoDB, sqsQueue });

module.exports = decoratorValidator(
  handler.main.bind(handler),
  Handler.validator(),
  globalEnum.ARG_TYPE.BODY
);