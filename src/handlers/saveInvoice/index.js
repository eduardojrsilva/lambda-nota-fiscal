const Joi = require('joi');
const decoratorValidator = require('../../util/decoratorValidator');
const globalEnum = require('../../util/globalEnum');
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
      createdAt: item.createdAt,
    };
  }
  
  getTotalPrice(items) {
    const total = items.reduce((acc, { price, amount }) => (
      acc + price * amount
    ), 0);
  
    return total;
  }
  
  async persistItem(data) {
    const params = {
      TableName: 'Invoice',
      Item: {
        id: uuid.v4(),
        ...data,
        total: this.getTotalPrice(data.items),
        createdAt: new Date().toISOString(),
      }
    }
    
    await this.dynamoDB.put(params).promise();
  
    const savedItem = this.formatItem(params.Item);
  
    return savedItem;
  }

  async sendMessage(id) {
    const params = {
      MessageBody: `${id}`,
      MessageDeduplicationId: `invoice-${id}`,
      MessageGroupId: "Invoices",
      QueueUrl: process.env.SQS_QUEUE_URL
    };
  
    await this.sqsQueue.sendMessage(params, function(err, data) {
      if (err) {
        console.log("Error", err);
      } else {
        console.log("Success ", data.MessageId);
      }
    }).promise();
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

      const invoice = await this.persistItem(data);

      await this.sendMessage(invoice.id);

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