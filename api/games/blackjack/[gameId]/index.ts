import * as yup from 'yup'

import { ulid } from 'ulid'
import { BlackJackEntity, BlackJackGameStates } from '../../../../models'
import { NowRequest, NowResponse } from '@vercel/node'
import { createHandler, handleValidationError, isULID, to, PokerValues, convertDeckKeys } from '../../../../helpers'

const schema = yup.object().shape({
  gameId: yup.string().required().test("Valid", "gameId must be a valid ULID", isULID)
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

  game.Item.cards = {
    main: {
      remaining: game.Item.cards.main.length
    },
    discard: {
      remaining: game.Item.cards.discard.length
    }
  }

  game.Item.players.count = Object.keys(game.Item.players).length - 1

  res.json(game.Item)
}

const updateSchema = yup.object().shape({
  gameId: yup.string().required().test("Valid", "gameId must be a valid ULID", isULID),
  action: yup.string().oneOf(['restart', 'start']).required()
})

const post = async (req: NowRequest, res: NowResponse) => {
  const { query, body } = req

  const [validationError, result]: [Error, object & {
    gameId: string
    action: "restart" | "start"
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

  if (result.action === 'restart') {
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

    const modifications: any = {
      players: {},
      cards: {}
    }

    const players = Object.keys(game.Item.players)

    let currentPlayer: string = null

    players.forEach((player, index) => {
      const start = index * 2
      const draw = game.Item.cards.main.slice(start, start + 2)

      const drawValues = convertDeckKeys(draw)

      const values = [0, 0]

      drawValues.forEach(({ value }) => {
        const { blackjack } = PokerValues.find(item => item.value === value)

        values.forEach((v, i) => {
          values[i] = v + blackjack[i]
        })
      })

      modifications.players[player] = {
        hand: draw,
        values: values
      }

      if (!currentPlayer && player !== 'dealer') currentPlayer = player
    })

    modifications.cards = {
      $set: {
        main: game.Item.cards.main.slice(players.length * 2),
        discard: game.Item.cards.main.slice(0, players.length * 2)
      }
    }

    const [databaseError] = await to(BlackJackEntity.update({
      id: result.gameId,
      game: {
        $set: {
          state: BlackJackGameStates.playing,
          currentPlayer: currentPlayer
        }
      },
      rounds: {
        $append: [{ round: game.Item.rounds.length + 1, status: BlackJackGameStates.playing, winner: null }]
      },
      ...modifications
    }))

    if (databaseError) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An internal server error occurred try again later'
      })
    }

    modifications.players[currentPlayer].hand = convertDeckKeys(modifications.players[currentPlayer].hand)

    return res.json({
      id: result.gameId,
      rounds: game.Item.rounds.concat([{ round: game.Item.rounds.length + 1, status: BlackJackGameStates.playing, winner: null }]),
      game: {
        currentPlayer: {
          name: currentPlayer,
          ...modifications.players[currentPlayer]
        },
        otherPlayers: players.filter(player => player !== currentPlayer).map(player => {
          modifications.players[player].hand = convertDeckKeys(modifications.players[player].hand)

          return { name: player, ...modifications.players[player] }
        }),
        state: BlackJackGameStates.playing
      }
    })
  }
}

const methods = {
  get,
  post
}

export default createHandler(methods)