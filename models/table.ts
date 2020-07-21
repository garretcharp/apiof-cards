import { DynamoDB } from 'aws-sdk'
import { Table } from 'dynamodb-toolbox'

import { config } from '../helpers'

const DocumentClient = new DynamoDB.DocumentClient({
  ...config.aws,
  endpoint: config.dynamo.endpoint,
  httpOptions: {
    timeout: 5000
  },
  maxRetries: 3
})

const table = new Table({
  name: config.dynamo.tableName,

  partitionKey: 'PK',
  sortKey: 'SK',
  entityField: 'entity',

  DocumentClient
})

export default table