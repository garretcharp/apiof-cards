import table from './table'

import { Entity } from 'dynamodb-toolbox'
import { config, createDeck } from '../helpers'

export const BlackJackGameStates = {
  ready: 'ready',
  playing: 'playing'
}

export const BlackJackPlayerStates = {
  playing: 'playing',
  busted: 'busted',
  standing: 'standing'
}

export const BlackJackEntity = new Entity({
  name: 'BlackJack',

  timestamps: false,

  attributes: {
    PK: {
      partitionKey: true,
      hidden: true,
      prefix: 'BLACKJACK#',
      type: 'string',
      delimiter: '#'
    },
    SK: {
      sortKey: true,
      hidden: true,
      default: 'GAME'
    },

    id: ['PK', 0, { type: 'string', required: true, save: false }],

    cards: { type: 'map', default: () => ({ main: createDeck({ decks: 6 }), discard: [] }) },

    players: { type: 'map', required: true },

    game: { type: 'map', default: { state: BlackJackGameStates.ready, currentPlayer: null } },

    rounds: { type: 'list', default: [] },

    TTL: { type: 'number', hidden: true, default: () => Math.floor((Date.now() + config.dynamo.ttl) / 1000) }
  },

  table
})