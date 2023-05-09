const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const getCurrency = require('../../util/currency');

function createFileBody(invoice) {
  console.log(invoice);

  const fileContent = `
    ================ NOTA FISCAL ================

    Nome: ${invoice.fullName}
    Email: ${invoice.email}
    CPF: ${invoice.cpf}

    Nº cartão: ${invoice.cardNumber}
    Código verificador: ${invoice.securityCode}
    Validade: ${invoice.validity}

    Itens: ${invoice.items.map(({ name, amount, price }) => `
      ${name} - (${getCurrency(price)} x ${amount}) - ${getCurrency(price * amount)}
    `)}

    Total: ${getCurrency(invoice.total)}

    =============================================
  `;

  return fileContent;
}

async function uploadFile(payload, id) {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `${id}.txt`,
    Body: payload,
    ContentType: 'text/plain; charset=utf-8',
  }

  await s3.upload(params).promise();
} 

async function getPublicUrl(id) {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `${id}.txt`,
  }

  const url = new Promise((resolve, reject) => {
    s3.getSignedUrl('getObject', params, (err, url) => {
      if (err) reject(err);
      else resolve(url);
    })
  });

  return url;
}

async function uploadFile(invoice) {
  const invoiceBody = createFileBody(invoice);

  await uploadFile(invoiceBody, invoice.id);

  const invoicePublicUrl = await getPublicUrl(invoice.id);

  return invoicePublicUrl;
}

module.exports = uploadFile;