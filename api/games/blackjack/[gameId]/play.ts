import * as yup from 'yup'

import { ulid } from 'ulid'
import { BlackJackEntity, BlackJackGameStates } from '../../../../models'
import { NowRequest, NowResponse } from '@vercel/node'
import { createHandler, handleValidationError, isULID, to } from '../../../../helpers'

const schema = yup.object().shape({
  gameId: yup.string().required().test('Valid', 'gameId must be a valid ULID', isULID)
})

const get = async (req: NowRequest, res: NowResponse) => {
  const { query } = req

  const [validationError, result] = await to(schema.validate(query, { abortEarly: false, stripUnknown: true }))

  if (validationError) {
    return handleValidationError(res, validationError)
  }

  const [databaseError, game] = await to(BlackJackEntity.get({
    id: result.gameId
  }))

  if (databaseError) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An internal server error occurred try again later'
    })
  }

  if (!game.Item) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'A game with the given id does not exist',
      gameId: result.gameId
    })
  }

  if (game.Item.game.state !== BlackJackGameStates.playing || !game.Item.game.currentPlayer) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'This game is not in the started state'
    })
  }

  const player = game.Item.game.currentPlayer

  res.json({
    currentPlayer: {
      name: player,
      ...game.Item.players[player]
    },
    cards: {
      main: {
        remaining: game.Item.cards.main.length
      },
      discard: {
        remaining: game.Item.cards.discard.length
      }
    }
  })
}

const updateSchema = yup.object().shape({
  gameId: yup.string().required().test('Valid', 'gameId must be a valid ULID', isULID),
  action: yup.string().oneOf(['hit', 'stay', 'start']).required()
})

const post = async (req: NowRequest, res: NowResponse) => {
  const { query, body } = req

  const [validationError, result]: [Error, object & {
    gameId: string
    action: 'hit' | 'stay' | 'start'
  }] = await to(updateSchema.validate({ ...query, ...body }, { abortEarly: false, stripUnknown: true }))

  if (validationError) {
    return handleValidationError(res, validationError)
  }

  const [databaseError, game]: [Error, object & { Item: any }] = await to(BlackJackEntity.get({
    id: result.gameId
  }))

  if (databaseError) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An internal server error occurred try again later'
    })
  }

  if (!game.Item) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'A game with the given id does not exist',
      gameId: result.gameId
    })
  }

  if (game.Item.game.state !== BlackJackGameStates.playing || !game.Item.game.currentPlayer) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'This game is not in the started state'
    })
  }

  const player = game.Item.game.currentPlayer

  const state = {
    name: player,
    ...game.Item.players[player]
  }

  return res.json(state)


  if (result.action === 'start') {
    const item = {
      id: result.gameId,
      players: Object.keys(game.Item.players).length - 1
    }

    const [databaseError] = await to(BlackJackEntity.put(item))

    if (databaseError) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An internal server error occurred try again later'
      })
    }

    const updated = BlackJackEntity.parse(BlackJackEntity.putParams(item))

    updated.cards = {
      main: {
        remaining: updated.cards.main.length
      },
      discard: {
        remaining: updated.cards.discard.length
      }
    }

    updated.players.count = Object.keys(updated.players).length - 1

    return res.json(updated)
  } else {
    if (game.Item.game.state === BlackJackGameStates.playing) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'This game is already in the started state'
      })
    }

    const [databaseError] = await to(BlackJackEntity.update({
      id: result.gameId,
      game: {
        $set: {
          state: BlackJackGameStates.playing,
          currentPlayer: 'player_0'
        }
      },
      rounds: {
        $append: [{ round: game.Item.rounds.length + 1, status: BlackJackGameStates.playing, winner: null }]
      }
    }))

    if (databaseError) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An internal server error occurred try again later'
      })
    }

    const updated = game.Item

    updated.cards = {
      main: {
        remaining: updated.cards.main.length
      },
      discard: {
        remaining: updated.cards.discard.length
      }
    }

    updated.players.count = Object.keys(updated.players).length - 1

    updated.game = {
      state: BlackJackGameStates.playing,
      currentPlayer: 'player_0'
    }

    updated.rounds = [...updated.rounds, { round: game.Item.rounds.length + 1, status: BlackJackGameStates.playing, winner: null }]

    return res.json(updated)
  }
}

const methods = {
  get,
  post
}

export default createHandler(methods)