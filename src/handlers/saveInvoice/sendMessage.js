const AWS = require('aws-sdk');
const sqsQueue = new AWS.SQS();

function sendMessage(id) {
  const params = {
    MessageBody: `${id}`,
    MessageDeduplicationId: "invoice",
    MessageGroupId: "Group1",
    QueueUrl: process.env.SQS_QUEUE_URL
  };

  sqsQueue.sendMessage(params, function(err, data) {
    if (err) {
      console.log("Error", err);
    } else {
      console.log("Success", data.MessageId);
    }
  });
}

module.exports = sendMessage;
