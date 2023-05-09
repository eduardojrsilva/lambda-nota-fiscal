const AWS = require('aws-sdk');
const sqsQueue = new AWS.SQS();
const dynamoDB = new AWS.DynamoDB({ params: { TableName: 'Invoice'}});

function deleteMessage(receiptHandle) {
  const deleteParams = {
    QueueUrl: process.env.SQS_QUEUE_URL,
    ReceiptHandle: receiptHandle
  };

  sqsQueue.deleteMessage(deleteParams, function(err, data) {
    if (err) {
      console.log("Delete Error", err);
    } else {
      console.log("Message Deleted", data);
    }
  });
}

async function getFirstMessage() {
  const params = {
    QueueUrl: process.env.SQS_QUEUE_URL,
    MaxNumberOfMessages: 1,
    VisibilityTimeout: 10,
    WaitTimeSeconds: 0
  };

  const { Messages } = await sqsQueue.receiveMessage(params).promise();

  const [ firstMessage ] = Messages;

  deleteMessage(firstMessage.ReceiptHandle);

  return firstMessage;
}

async function getInvoiceById(id) {
  const params = {
    TableName: 'Invoice',
    Key: {
      id: {
        S: id
      },
    }
  }

  const { Item } = await dynamoDB.getItem(params).promise();

  const invoice = AWS.DynamoDB.Converter.unmarshall(Item);

  return invoice;
}

async function getInvoice() {
  // const message = await getFirstMessage(); 

  // if (!message) return;

  const id = "e198bb12-2e66-4106-84a6-77e1ce43e688";

  const invoice = await getInvoiceById(id);

  return invoice;
}

module.exports = getInvoice;
