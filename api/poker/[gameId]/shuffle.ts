import * as yup from 'yup'

import { PokerDeckEntity } from '../../../models'
import { NowRequest, NowResponse } from '@vercel/node'
import { createHandler, convertDeckKeys, to, isULID, shuffle, handleValidationError, config } from '../../../helpers'

const schema = yup.object().shape({
  piles: yup.array(yup.string().min(1).max(35)).default(['main'])
})

const get = async (req: NowRequest, res: NowResponse) => {
  let { query: { gameId } } = req

  if (Array.isArray(gameId)) {
    gameId = gameId.find(id => isULID(id))
  }

  if (!isULID(gameId)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid gameId recieved',
      gameId
    })
  }

  const body = {
    piles: req.query.piles || req.body?.piles,
  }

  const [validationError, result] = await to(schema.validate(body, { abortEarly: false, stripUnknown: true }))

  if (validationError) {
    return handleValidationError(res, validationError)
  }

  result.piles = result.piles.map(pile => pile.replace(/ /g, ''))

  if (result.piles.length === 0) {
    return res.status(401).json({
      error: 'Bad Request',
      message: 'You must specify piles to shuffle',
      received: result.piles
    })
  }

  const [databaseError, game] = await to(PokerDeckEntity.get({
    id: gameId
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
      gameId
    })
  }

  const validPiles = Object.keys(game.Item.piles)

  if (result.piles.every(p => validPiles.includes(p)) === false) {
    return res.status(401).json({
      error: 'Bad Request',
      message: 'You must specify piles which exist on the game',
      received: result.piles,
      valid: validPiles
    })
  }

  let modifications = {}

  result.piles.forEach(pile => {
    modifications[pile] = shuffle(game.Item.piles[pile])
  })

  const [updateError] = await to(PokerDeckEntity.update({
    id: gameId,
    piles: {
      $set: modifications
    },
    TTL: Math.floor((Date.now() + config.dynamo.ttl) / 1000)
  }))

  if (updateError) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An internal server error occurred try again later'
    })
  }

  Object.keys(modifications).forEach(key => {
    modifications[key] = {
      remaining: modifications[key].length,
      shuffled: true
    }
  })

  Object.keys(game.Item.piles).forEach(pile => {
    if (!modifications[pile]) {
      modifications[pile] = {
        remaining: game.Item.piles[pile].length,
        shuffled: false
      }
    }
  })

  res.json({ piles: modifications, gameId })
}

const methods = {
  get,
  post: get
}

export default createHandler(methods)