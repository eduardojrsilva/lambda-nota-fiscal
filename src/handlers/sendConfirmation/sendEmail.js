const AWS = require('aws-sdk');
const sns = new AWS.SNS();

async function subscribeEmail() {
  const params = {
    Protocol: 'EMAIL',
    TopicArn: process.env.SNS_TOPIC_ARN,
    Endpoint: 'silva_eduardo@offerwise.com'
  }

  await sns.subscribe(params).promise();
}

async function sendEmailConfirmation(invoiceUrl) {
  const params = {
    Message: `
      Sua compra foi finalizada com sucesso!

      Segue o link da nota fiscal: ${invoiceUrl}
    `,
    TopicArn: process.env.SNS_TOPIC_ARN
  };

  await sns.publish(params).promise();
}

async function sendEmail(invoiceUrl) {
  // await subscribeEmail();

  await sendEmailConfirmation(invoiceUrl);
}

module.exports = sendEmail;
