const getCurrency = require('../../util/currency');
const formatDate = require('../../util/date');
const processPayment = require('../../util/payment');

class Handler {
  constructor({ AWS, dynamoDB, s3, sns }){
    this.AWS = AWS;
    this.dynamoDB = dynamoDB;
    this.s3 = s3;
    this.sns = sns;
  }

  async getInvoiceById(id) {
    const params = {
      TableName: 'Invoice',
      Key: {
        id: {
          S: id
        },
      }
    }
  
    const { Item } = await this.dynamoDB.getItem(params).promise();
  
    const invoice = this.AWS.DynamoDB.Converter.unmarshall(Item);
  
    return invoice;
  }

  createFileBody(invoice) {
    const fileContent = `
      ================ NOTA FISCAL ================
  
      Nome: ${invoice.fullName}
      Email: ${invoice.email}
      CPF: ${invoice.cpf}
  
      Nº cartão: ${invoice.cardNumber}
      Data do pagamento: ${formatDate(invoice.createdAt)}
  
      Itens:
      ${invoice.items.map(({ name, amount, price }) => (
        `\t${name} - (${getCurrency(price)} x ${amount}) - ${getCurrency(price * amount)}\n`
      ))}
  
      Total: ${getCurrency(invoice.total)}
  
      =============================================
    `;
  
    return fileContent;
  }
  
  async uploadFile(payload, id) {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `${id}.txt`,
      Body: payload,
      ContentType: 'text/plain; charset=utf-8',
    }
  
    await this.s3.upload(params).promise();
  } 
  
  async getPublicUrl(id) {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `${id}.txt`,
    }
  
    const url = new Promise((resolve, reject) => {
      this.s3.getSignedUrl('getObject', params, (err, url) => {
        if (err) reject(err);
        else resolve(url);
      })
    });
  
    return url;
  }

  async subscribeEmail() {
    const params = {
      Protocol: 'EMAIL',
      TopicArn: process.env.SNS_TOPIC_ARN,
      Endpoint: 'silva_eduardo@offerwise.com'
    }
  
    await this.sns.subscribe(params).promise();
  }
  
  async sendApprovedEmail(invoiceUrl) {
    const params = {
      Message: `
        Sua compra foi finalizada com sucesso!
  
        Segue o link da nota fiscal: ${invoiceUrl}
      `,
      TopicArn: process.env.SNS_TOPIC_ARN
    };
  
    await this.sns.publish(params).promise();
  }

  async sendPendingEmail() {
    const params = {
      Message: `
        O pagamento da sua compra está pendente!

        Iremos reprocessar para que sua compra seja efetuada. Por favor, aguarde.
      `,
      TopicArn: process.env.SNS_TOPIC_ARN
    };
  
    await this.sns.publish(params).promise();
  }

  async sendDeniedEmail() {
    const params = {
      Message: `
        O pagamento da sua compra foi negado!

        Tente novamente mais tarde.
      `,
      TopicArn: process.env.SNS_TOPIC_ARN
    };
  
    await this.sns.publish(params).promise();
  }

  async handleApproved(invoiceId) {
    const invoice = await this.getInvoiceById(invoiceId);

    const invoiceBody = this.createFileBody(invoice);

    await this.uploadFile(invoiceBody, invoice.id);

    const invoicePublicUrl = await this.getPublicUrl(invoice.id);

    
    await this.sendApprovedEmail(invoicePublicUrl);
  }
  
  async handlePending(invoiceId, currentAttempt) {
    if (currentAttempt === 1)
      await this.sendPendingEmail();

    const status = processPayment();

    const nextAttempt = currentAttempt + 1;

    if (status === 'DENIED' || (status === 'PENDING' && nextAttempt >= this.maxReprocessAttempts))
      return await this.sendDeniedEmail();

    const params = {
      MessageBody: `${invoiceId}#${status}#${nextAttempt}`,
      MessageDeduplicationId: `invoice-${id}`,
      MessageGroupId: "Invoices",
      QueueUrl: process.env.SQS_QUEUE_URL
    };
  
    await this.sqsQueue.sendMessage(params).promise();
  }

  handlerByStatus = {
    'APPROVED': this.handleApproved.bind(this),
    'PENDING': this.handlePending.bind(this),
  };

  maxReprocessAttempts = 5;
  
  async main(event) {
    const [invoiceId, status, attempt] = event.Records[0].body.split('#');

    const currentAttempt = Number(attempt);
    
    // await this.subscribeEmail();

    const handler = this.handlerByStatus[status];

    await handler(invoiceId, currentAttempt);
  }
}

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB({ params: { TableName: 'Invoice'}});
const s3 = new AWS.S3();
const sns = new AWS.SNS();

const handler = new Handler({ AWS, dynamoDB, s3, sns });

module.exports = handler.main.bind(handler)