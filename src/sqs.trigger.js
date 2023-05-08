class Handler {
  constructor({ dynamoDbSvc, sqsSvc, s3Svc }){
    this.dynamoDbSvc = dynamoDbSvc;
    this.sqsSvc = sqsSvc;
    this.s3Svc = s3Svc;
  }

  async getItem(params) {
    return this.dynamoDbSvc.getItem(params).promise();
  }

  prepareDbData(id) {
    const params = {
      TableName: 'Invoice',
      Key: {
        id: {
          S: id
        },
      }
    }

    return params;
  }

  getMessageParams() {
    const params = {
      QueueUrl: process.env.SQS_QUEUE_URL,
      MaxNumberOfMessages: 1,
      VisibilityTimeout: 10,
      WaitTimeSeconds: 0
    };

    return params
  }

  deleteMessage() {
    const deleteParams = {
      QueueUrl: process.env.SQS_QUEUE_URL,
      ReceiptHandle: data.Messages[0].ReceiptHandle
    };

    this.sqsSvc.deleteMessage(deleteParams, function(err, data) {
      if (err) {
        console.log("Delete Error", err);
      } else {
        console.log("Message Deleted", data);
      }
    });
  }

  createFilePayload() {
    const fileContent = `
      ================ NOTA FISCAL ================

      Nome: João da Silva
      Email: joao@email.com
      CPF: 123.456.789.10

      Nº cartão: 1
      Código verificador: 1
      Validade: 1

      Itens:
      Item1 - R$100
      Item2 - R$200
      Item3 - R$300

      Total - R$600

      =============================================
    `;

    return fileContent;
  }

  getS3Params(payload, id) {
    const params = {
      Bucket: 'ejrs-invoice-bucket',
      Key: id+'.txt',
      Body: payload,
      ContentType: 'text/plain',
    }

    return params;
  }

  async uploadFile(payload, id) {
    const params = this.getS3Params(payload, id);

    await this.s3Svc.upload(params).promise();
  } 

  async getPublicUrl(id) {
    const params = {
      Bucket: 'ejrs-invoice-bucket',
      Key: id+'.txt',
    }

    const url = new Promise((resolve, reject) => {
      this.s3Svc.getSignedUrl('getObject', params, (err, url) => {
        if (err) reject(err);
        else resolve(url);
      })
    });

    return url;
  }

  handlerError(data) {
    const response = {
      statusCode: data.statusCode || 501,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Couldn\'t receive message!'
    }

    return response;
  }

  async main() {
    try {
      // const params = this.getMessageParams();

      // const {Messages} = await this.sqsSvc.receiveMessage(params);

      // const dbParams = this.prepareDbData(Messages);
      // const item = await this.getItem(dbParams);

      // console.log(item)

      // this.deleteMessage();
      const invoicePayload = this.createFilePayload();

      const id = 'teste2';

      await this.uploadFile(invoicePayload, id)

      const publicUrl = await this.getPublicUrl(id);
      console.log('publicUrl ====> ', publicUrl)
    } catch (error) {
      console.log('Erro *** ', error.stack);

      return this.handlerError({ statusCode: 500 });
    }
  }
}

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB({ params: { TableName: 'Invoice'}});
const sqsQueue = new AWS.SQS();
const s3 = new AWS.S3();

const handler = new Handler({
  dynamoDbSvc: dynamoDB,
  sqsSvc: sqsQueue,
  s3Svc: s3
});

module.exports = handler.main.bind(handler)