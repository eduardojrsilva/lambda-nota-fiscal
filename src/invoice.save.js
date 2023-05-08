const uuid = require('uuid');
const Joi = require('joi');
const decoratorValidator = require('./util/decoratorValidator');
const globalEnum = require('./util/globalEnum');

class Handler {
  constructor({ dynamoDbSvc, sqsSvc }){
    this.dynamoDbSvc = dynamoDbSvc;
    this.sqsSvc = sqsSvc;
  }

  static validator() {
    return Joi.object({
      fullName: Joi.string().max(100).min(2).required(),
      cpf: Joi.string().max(14).min(11).required(),
      email: Joi.string().email().required(),
      cardNumber: Joi.number().required(),
      securityCode: Joi.number().required(),
      validity: Joi.string().max(8).required(),
      total: Joi.number().required(),
      items: Joi.array().items(
        Joi.object({
          name: Joi.string().max(100).min(2).required(),
          price: Joi.number().required(),
          amount: Joi.number().min(1).required(),
        })
      ).required()
    })
  }

  async insertItem(params) {
    return this.dynamoDbSvc.put(params).promise();
  }

  prepareData(data) {
    const params = {
      TableName: 'Invoice',
      Item: {
        id: uuid.v4(),
        ...data,
        createdAt: new Date().toISOString()
      }
    }

    return params;
  }

  getMessageParams(id) {
    const params = {
      MessageBody: `${id}`,
      MessageDeduplicationId: "invoice",
      MessageGroupId: "Group1",
      QueueUrl: process.env.SQS_QUEUE_URL
    };

    return params
  }

  handlerSuccess(data) {
    const params = this.getMessageParams(data.id);

    this.sqsSvc.sendMessage(params, function(err, data) {
      if (err) {
        console.log("Error", err);
      } else {
        console.log("Success", data.MessageId);
      }
    });

    const response = {
      statusCode: 200,
      body: JSON.stringify(data)
    }

    return response;
  }

  handlerError(data) {
    const response = {
      statusCode: data.statusCode || 501,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Couldn\'t create item!'
    }

    return response;
  }

  async main(event) {
    try {
      const data = event.body;

      const dbParams = this.prepareData(data);
      await this.insertItem(dbParams);

      return this.handlerSuccess(dbParams.Item);
    } catch (error) {
      console.log('Erro *** ', error.stack);

      return this.handlerError({ statusCode: 500 });
    }
  }
}

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient({ params: { TableName: 'Invoice'}});
const sqsQueue = new AWS.SQS();
const handler = new Handler({
  dynamoDbSvc: dynamoDB,
  sqsSvc: sqsQueue
});

module.exports = decoratorValidator(
  handler.main.bind(handler),
  Handler.validator(),
  globalEnum.ARG_TYPE.BODY
);