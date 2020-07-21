import * as yup from 'yup'

import { ulid } from 'ulid'
import { BlackJackEntity } from '../../../models'
import { NowRequest, NowResponse } from '@vercel/node'
import { createHandler, handleValidationError, to } from '../../../helpers'

const schema = yup.object().shape({
  players: yup.number().integer().min(1).max(10).default(1)
})

const post = async (req: NowRequest, res: NowResponse) => {
  const { body } = req

  const [validationError, result] = await to(schema.validate(body, { abortEarly: false, stripUnknown: true }))

  if (validationError) {
    return handleValidationError(res, validationError)
  }

  const players = {
    dealer: {
      hand: [],
      values: []
    }
  }

  for (let player = 0; player < result.players; player++) {
    players[`player_${player}`] = {
      hand: [],
      values: []
    }
  }

  const gameId = ulid()

  const [databaseError] = await to(BlackJackEntity.put({
    id: gameId,
    players
  }, {
    conditions: {
      attr: 'PK',
      exists: false
    }
  }))

  if (databaseError) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An internal server error occurred try again later'
    })
  }

  const game = BlackJackEntity.parse(BlackJackEntity.putParams({ id: gameId, players }).Item)

  game.cards = {
    main: {
      remaining: game.cards.main.length
    },
    discard: {
      remaining: game.cards.discard.length
    }
  }

  game.players.count = Object.keys(game.players).length - 1

  res.json(game)
}

const methods = {
  post
}

export default createHandler(methods)