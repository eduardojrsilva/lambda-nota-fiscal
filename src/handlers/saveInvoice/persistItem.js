const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient({ params: { TableName: 'Invoice'}});
const uuid = require('uuid');

function formatItem(item) {
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

function getTotalPrice(items) {
  const total = items.reduce((acc, { price, amount }) => (
    acc + price * amount
  ), 0);

  return total;
}

async function persistItem(data) {
  const params = {
    TableName: 'Invoice',
    Item: {
      id: uuid.v4(),
      ...data,
      total: getTotalPrice(data.items),
      createdAt: new Date().toISOString(),
    }
  }
  
  await dynamoDB.put(params).promise();

  const savedItem = formatItem(params.Item);

  return savedItem;
}

module.exports = persistItem;
