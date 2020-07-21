import table from './table'

import { Entity } from 'dynamodb-toolbox'
import { config } from '../helpers'

export const PokerDeckEntity = new Entity({
  name: 'PokerDeck',

  timestamps: false,

  attributes: {
    PK: {
      partitionKey: true,
      hidden: true,
      prefix: 'POKER#',
      type: 'string',
      delimiter: '#'
    },
    SK: {
      sortKey: true,
      hidden: true,
      default: 'DECK'
    },

    id: ['PK', 0, { type: 'string', required: true, save: false }],

    piles: { type: 'map', required: true },

    counts: {
      type: 'map', default: (data) => {
        const result = {}
        Object.keys(data.piles).forEach(key => {
          result[key] = data.piles[key].length
        })

        return result
      }
    },

    discard: { type: 'string' },

    TTL: { type: 'number', hidden: true, default: () => Math.floor((Date.now() + config.dynamo.ttl) / 1000) }
  },

  table
})